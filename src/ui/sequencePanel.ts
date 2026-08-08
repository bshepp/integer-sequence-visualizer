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
      // whole tablist is one stop rather than three — arrow keys move within.
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
    // slow fetch should disable the button and show a loading message —
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
            a.textContent = `${hit.aNumber} — ${hit.name}`;
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

  // presets shelf
  el.appendChild(sectionLabel('Gallery'));
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

  // info card
  el.appendChild(sectionLabel('Loaded'));
  const info = document.createElement('div');
  info.className = 'info-card';
  el.appendChild(info);

  function setInfo(seq: Sequence): void {
    info.replaceChildren();
    const name = document.createElement('div');
    name.className = 'info-name';
    name.textContent = seq.name;
    info.appendChild(name);
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
    meta.append(` · ${seq.terms.length} terms · ${seq.source}`);
    info.appendChild(meta);
    if (seq.source === 'oeis' && seq.aNumber) {
      const cap = document.createElement('input');
      cap.type = 'number';
      cap.value = '10000';
      cap.className = 'bfile-cap';
      const btn = document.createElement('button');
      btn.className = 'bfile-button';
      btn.textContent = 'Load all terms (b-file)';
      btn.addEventListener('click', () => {
        btn.disabled = true;
        // Number('') === 0 for a cleared field, and parseBFile(text, 0) used
        // to silently return a one-term sequence instead of erroring — guard
        // here too so the common "cleared the input, clicked load" slip
        // doesn't even reach that path. Math.max(1, …) only catches that
        // specific case: non-numeric garbage still coerces to NaN (Math.max
        // with NaN is NaN), which parseBFile's own `Number.isFinite` guard
        // then rejects with a banner instead of a silent 1-term result.
        fetchBFile(seq.aNumber!, Math.max(1, Number(cap.value)))
          .then((terms) => handlers.onSequence(withTerms(seq, terms)))
          .catch((e) => handlers.onError(e instanceof Error ? e.message : String(e)))
          .finally(() => { btn.disabled = false; });
      });
      const hint = document.createElement('p');
      hint.className = 'bfile-hint';
      // The stored snapshot caps terms per sequence, so the default view is a
      // short prefix -- and short prefixes are where these pictures are least
      // interesting. Worth saying out loud rather than hoping it is discovered.
      hint.textContent = 'Most sequences only get interesting with more terms — this fetches the full list from OEIS.';
      info.append(btn, labelledControl('Maximum terms to fetch', cap), hint);
    }
  }

  return { el, setInfo };
}
