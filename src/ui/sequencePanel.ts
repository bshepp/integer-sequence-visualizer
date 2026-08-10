import type { Sequence } from '../sequence/sequence';
import { lookupById, search, fetchBFile, withTerms } from '../sequence/oeisClient';
import { sequenceFromPaste } from '../sequence/pasteParser';
import { sequenceFromFormula, validateFormula } from '../sequence/formula';
import { PRESETS } from '../sequence/presets';
import { labelledControl } from './a11y';

interface Handlers {
  onSequence(seq: Sequence): void;
  onError(msg: string): void;
}

// Panel instances get distinct id prefixes. Only one panel exists in the
// running app, but hardcoded ids like "seqpane-0" silently collide the moment
// two coexist in one document -- and duplicate ids break aria-controls /
// aria-labelledby resolution, which is the exact wiring this pattern depends
// on. Cheap to make correct; expensive to debug later.
let panelSeq = 0;

export function buildSequencePanel(handlers: Handlers): { el: HTMLElement; setInfo(seq: Sequence): void } {
  const uid = `sp${++panelSeq}`;
  const el = document.createElement('div');
  el.className = 'sequence-panel';

  // A real heading, not a styled div: these are the only landmarks in the
  // sidebar, and without them there is no structure to navigate by.
  function sectionLabel(text: string): HTMLElement {
    const label = document.createElement('h2');
    label.className = 'section-label';
    label.textContent = text;
    return label;
  }

  // --- tabs (WAI-ARIA tab pattern) ---
  el.appendChild(sectionLabel('Load a sequence'));
  const tabBar = document.createElement('div');
  tabBar.className = 'tab-bar';
  tabBar.setAttribute('role', 'tablist');
  tabBar.setAttribute('aria-label', 'How to load a sequence');

  const panes: Record<string, HTMLElement> = {};
  const tabNames = ['A-number', 'Search', 'Custom'];
  const tabs: HTMLButtonElement[] = [];

  function selectTab(index: number, moveFocus: boolean): void {
    tabNames.forEach((name, i) => {
      const chosen = i === index;
      const tab = tabs[i]!;
      tab.setAttribute('aria-selected', String(chosen));
      // Roving tabindex: only the selected tab is reachable by Tab, so the
      // whole tablist is one stop rather than three - arrow keys move within.
      tab.tabIndex = chosen ? 0 : -1;
      tab.classList.toggle('active', chosen);
      panes[name]!.hidden = !chosen;
    });
    if (moveFocus) tabs[index]!.focus();
  }

  tabNames.forEach((name, i) => {
    const btn = document.createElement('button');
    btn.className = 'tab-button';
    btn.type = 'button';
    btn.textContent = name;
    btn.id = `${uid}-tab-${i}`;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-controls', `${uid}-pane-${i}`);
    btn.addEventListener('click', () => selectTab(i, false));
    btn.addEventListener('keydown', (e) => {
      const last = tabNames.length - 1;
      let next: number | null = null;
      if (e.key === 'ArrowRight') next = i === last ? 0 : i + 1;
      else if (e.key === 'ArrowLeft') next = i === 0 ? last : i - 1;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = last;
      if (next === null) return;
      e.preventDefault();
      selectTab(next, true);
    });
    tabBar.appendChild(btn);
    tabs.push(btn);

    const pane = document.createElement('div');
    pane.className = 'tab-pane';
    pane.id = `${uid}-pane-${i}`;
    pane.setAttribute('role', 'tabpanel');
    pane.setAttribute('aria-labelledby', btn.id);
    // Focusable so a keyboard user reaches the panel's content directly after
    // the tablist, per the ARIA authoring practices.
    pane.tabIndex = 0;
    panes[name] = pane;
  });

  el.appendChild(tabBar);
  selectTab(0, false);

  const load = (p: Promise<Sequence>) =>
    p.then(handlers.onSequence).catch((e) => handlers.onError(e instanceof Error ? e.message : String(e)));

  // A-number pane
  {
    const pane = panes['A-number']!;
    const input = document.createElement('input');
    input.placeholder = 'A000045';
    const btn = document.createElement('button');
    btn.textContent = 'Load';
    btn.addEventListener('click', () => load(lookupById(input.value)));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') load(lookupById(input.value)); });
    pane.append(labelledControl('OEIS A-number', input), btn);
    el.appendChild(pane);
  }

  // Search pane
  {
    const pane = panes['Search']!;
    const input = document.createElement('input');
    input.placeholder = 'e.g. partition numbers';
    const btn = document.createElement('button');
    btn.textContent = 'Search';
    const status = document.createElement('div');
    status.className = 'search-status';
    status.setAttribute('role', 'status');
    const results = document.createElement('ul');
    results.className = 'search-results';
    // The search index is tens of MB uncompressed and is fetched at most
    // once (oeisClient caches it module-wide); only that first, genuinely
    // slow fetch should disable the button and show a loading message -
    // subsequent searches reuse the cached index and stay instant.
    let indexLoaded = false;
    const run = () => {
      const firstLoad = !indexLoaded;
      if (firstLoad) {
        btn.disabled = true;
        status.textContent = 'Loading search index…';
      }
      search(input.value)
        .then((hits) => {
          indexLoaded = true;
          results.replaceChildren();
          // Announce the outcome; without this a screen-reader user gets a
          // silently repopulated list and no sign anything happened.
          status.textContent = `${hits.length} match${hits.length === 1 ? '' : 'es'}`;
          if (hits.length === 0) { handlers.onError('No matches.'); return; }
          for (const hit of hits.slice(0, 12)) {
            const li = document.createElement('li');
            const a = document.createElement('button');
            a.textContent = `${hit.aNumber} - ${hit.name}`;
            a.addEventListener('click', () => load(lookupById(hit.aNumber)));
            li.appendChild(a);
            results.appendChild(li);
          }
        })
        .catch((e) => handlers.onError(e instanceof Error ? e.message : String(e)))
        .finally(() => {
          if (firstLoad) {
            btn.disabled = false;
            // Only clear the "Loading search index…" placeholder if the
            // result handler did not already replace it with a count.
            if (status.textContent === 'Loading search index…') status.textContent = '';
          }
        });
    };
    btn.addEventListener('click', run);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
    pane.append(labelledControl('Search OEIS by keyword', input), btn, status, results);
    el.appendChild(pane);
  }

  // Custom pane (paste + formula)
  {
    const pane = panes['Custom']!;
    const ta = document.createElement('textarea');
    ta.placeholder = 'Paste terms: 0, 1, 1, 2, 3, 5, …';
    const pasteBtn = document.createElement('button');
    pasteBtn.textContent = 'Load pasted';
    pasteBtn.addEventListener('click', () => {
      try { handlers.onSequence(sequenceFromPaste(ta.value)); }
      catch (e) { handlers.onError(e instanceof Error ? e.message : String(e)); }
    });

    const formula = document.createElement('input');
    formula.placeholder = 'Formula in n, e.g. n*n + n + 41';
    const formulaErr = document.createElement('div');
    formulaErr.className = 'formula-error';
    formulaErr.id = `${uid}-formula-error`;
    formulaErr.setAttribute('aria-live', 'polite');
    formula.setAttribute('aria-describedby', formulaErr.id);
    formula.setAttribute('aria-invalid', 'false');
    formula.addEventListener('input', () => {
      const message = formula.value ? validateFormula(formula.value) ?? '' : '';
      formulaErr.textContent = message;
      formula.setAttribute('aria-invalid', String(message.length > 0));
    });
    const count = document.createElement('input');
    count.type = 'number';
    count.value = '200';
    const formulaBtn = document.createElement('button');
    formulaBtn.textContent = 'Generate';
    formulaBtn.addEventListener('click', () => {
      try { handlers.onSequence(sequenceFromFormula(formula.value, Number(count.value))); }
      catch (e) { handlers.onError(e instanceof Error ? e.message : String(e)); }
    });
    pane.append(
      labelledControl('Paste sequence terms', ta),
      pasteBtn,
      labelledControl('Formula in n', formula),
      formulaErr,
      labelledControl('Number of terms to generate', count),
      formulaBtn,
    );
    el.appendChild(pane);
  }

  // --- b-file fetch, part of "Load a sequence" rather than of the info card ---
  // It belongs with loading, not with reporting what is loaded, and it is the
  // single most valuable action in the panel: the stored snapshot caps terms
  // per sequence, so the default view is a short prefix, and short prefixes
  // are where these pictures are least interesting.
  //
  // Built once and rebound by setInfo rather than recreated per sequence, so
  // it can sit above the info card and keep a stable identity for its label.
  let loadedSeq: Sequence | null = null;

  const bfileBox = document.createElement('div');
  bfileBox.className = 'bfile-box';

  const bfileBtn = document.createElement('button');
  bfileBtn.className = 'bfile-button';
  bfileBtn.type = 'button';
  bfileBtn.textContent = 'Load all terms (b-file)';

  const bfileCap = document.createElement('input');
  bfileCap.type = 'number';
  bfileCap.value = '10000';
  bfileCap.className = 'bfile-cap';

  // A slider as well as the box, because the useful range spans three orders
  // of magnitude and "how many terms" is a question you answer by feel rather
  // than by typing an exact figure. Log-scaled: on a linear slider everything
  // under a thousand would be crushed into the first 1% of travel, and the
  // difference between 200 and 2000 terms changes these pictures far more
  // than the difference between 90,000 and 100,000 does.
  const CAP_MIN = 50, CAP_MAX = 100000;
  const capToSlider = (n: number): number =>
    Math.round(1000 * (Math.log10(n) - Math.log10(CAP_MIN))
      / (Math.log10(CAP_MAX) - Math.log10(CAP_MIN)));
  const sliderToCap = (t: number): number => {
    const raw = 10 ** (Math.log10(CAP_MIN)
      + (t / 1000) * (Math.log10(CAP_MAX) - Math.log10(CAP_MIN)));
    // Rounded to something a person would have typed, at a precision that
    // scales with the magnitude: 1-unit steps are meaningless at 90,000.
    const step = raw < 1000 ? 10 : raw < 10000 ? 100 : 1000;
    return Math.max(CAP_MIN, Math.round(raw / step) * step);
  };

  const bfileSlider = document.createElement('input');
  bfileSlider.type = 'range';
  bfileSlider.className = 'bfile-slider';
  bfileSlider.min = '0';
  bfileSlider.max = '1000';
  bfileSlider.step = '1';
  bfileSlider.value = String(capToSlider(10000));

  // Says the cap is set but not yet fetched. Only appears once the control has
  // actually been moved: shown from the start it would be permanent furniture
  // reading as an error, and a message that is always on says nothing.
  const bfilePending = document.createElement('p');
  bfilePending.className = 'bfile-pending';
  bfilePending.hidden = true;
  bfilePending.setAttribute('role', 'status');

  let capDirty = false;
  const showPending = (): void => {
    const n = Math.max(1, Number(bfileCap.value) || 1);
    bfilePending.hidden = !capDirty;
    bfilePending.textContent = `Press "Load all terms" to fetch up to ${n.toLocaleString()} terms.`;
  };
  const setCap = (n: number, from: 'slider' | 'box'): void => {
    const clamped = Math.max(1, Math.min(CAP_MAX, Math.round(n) || 1));
    if (from !== 'box') bfileCap.value = String(clamped);
    if (from !== 'slider') bfileSlider.value = String(capToSlider(Math.max(CAP_MIN, clamped)));
    capDirty = true;
    showPending();
  };
  bfileSlider.addEventListener('input', () => setCap(sliderToCap(Number(bfileSlider.value)), 'slider'));
  bfileCap.addEventListener('input', () => setCap(Number(bfileCap.value), 'box'));

  const bfileHint = document.createElement('p');
  bfileHint.className = 'bfile-hint';
  bfileHint.textContent = 'Most sequences only get interesting with more terms - this fetches the full list from OEIS.';

  bfileBtn.addEventListener('click', () => {
    const seq = loadedSeq;
    if (!seq?.aNumber) return;
    bfileBtn.disabled = true;
    // Number('') === 0 for a cleared field, and parseBFile(text, 0) used to
    // silently return a one-term sequence instead of erroring - guard here too
    // so the common "cleared the input, clicked load" slip doesn't even reach
    // that path. Math.max(1, …) only catches that specific case: non-numeric
    // garbage still coerces to NaN (Math.max with NaN is NaN), which
    // parseBFile's own Number.isFinite guard then rejects with a banner
    // instead of a silent 1-term result.
    fetchBFile(seq.aNumber, Math.max(1, Number(bfileCap.value)))
      .then((terms) => handlers.onSequence(withTerms(seq, terms)))
      .catch((e) => handlers.onError(e instanceof Error ? e.message : String(e)))
      .finally(() => {
        // Cleared whether the fetch succeeded or failed: on failure the banner
        // says what went wrong, and leaving "press Load" up underneath it
        // would read as if nothing had been tried.
        capDirty = false;
        showPending();
        syncBfile();
      });
  });

  function syncBfile(): void {
    const available = loadedSeq?.source === 'oeis' && Boolean(loadedSeq.aNumber);
    bfileBtn.disabled = !available;
    bfileCap.disabled = !available;
    bfileSlider.disabled = !available;
    bfileBtn.title = available ? '' : 'Load an OEIS sequence first';
  }

  bfileBox.append(
    bfileBtn,
    labelledControl('Maximum terms to fetch', bfileCap),
    labelledControl('Maximum terms to fetch (slider)', bfileSlider, { visible: false }),
    bfilePending,
    bfileHint,
  );
  el.appendChild(bfileBox);
  syncBfile();

  // info card
  el.appendChild(sectionLabel('Loaded'));
  const info = document.createElement('div');
  info.className = 'info-card';
  el.appendChild(info);

  // presets shelf
  el.appendChild(sectionLabel('Presets'));
  const shelf = document.createElement('div');
  shelf.className = 'presets-shelf';
  for (const p of PRESETS) {
    const b = document.createElement('button');
    b.className = 'preset-button';
    b.textContent = p.label;
    b.title = p.aNumber;
    b.addEventListener('click', () => load(lookupById(p.aNumber)));
    shelf.appendChild(b);
  }
  el.appendChild(shelf);

  function setInfo(seq: Sequence): void {
    loadedSeq = seq;
    syncBfile();
    info.replaceChildren();
    // Identity first. OEIS names run long -- A000002's is a full sentence and
    // wraps to three lines -- which pushed the A-number and term count out of
    // sight beneath it. Those are the two facts you actually check.
    const meta = document.createElement('div');
    meta.className = 'info-meta';
    if (seq.aNumber) {
      const a = document.createElement('a');
      a.href = `https://oeis.org/${seq.aNumber}`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = seq.aNumber;
      meta.appendChild(a);
    }
    meta.append(`${seq.aNumber ? ' · ' : ''}${seq.terms.length} terms · ${seq.source}`);
    info.appendChild(meta);

    const name = document.createElement('div');
    name.className = 'info-name';
    name.textContent = seq.name;
    info.appendChild(name);
  }

  return { el, setInfo };
}
