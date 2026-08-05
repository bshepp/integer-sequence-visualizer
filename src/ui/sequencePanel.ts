import type { Sequence } from '../sequence/sequence';
import { lookupById, search, fetchBFile, withTerms } from '../sequence/oeisClient';
import { sequenceFromPaste } from '../sequence/pasteParser';
import { sequenceFromFormula, validateFormula } from '../sequence/formula';
import { PRESETS } from '../sequence/presets';

interface Handlers {
  onSequence(seq: Sequence): void;
  onError(msg: string): void;
}

export function buildSequencePanel(handlers: Handlers): { el: HTMLElement; setInfo(seq: Sequence): void } {
  const el = document.createElement('div');
  el.className = 'sequence-panel';

  function sectionLabel(text: string): HTMLElement {
    const label = document.createElement('div');
    label.className = 'section-label';
    label.textContent = text;
    return label;
  }

  // --- tabs ---
  el.appendChild(sectionLabel('Load a sequence'));
  const tabBar = document.createElement('div');
  tabBar.className = 'tab-bar';
  const panes: Record<string, HTMLElement> = {};
  for (const name of ['A-number', 'Search', 'Custom']) {
    const btn = document.createElement('button');
    btn.className = 'tab-button';
    btn.textContent = name;
    btn.addEventListener('click', () => {
      for (const [k, pane] of Object.entries(panes)) pane.hidden = k !== name;
      tabBar.querySelectorAll('.tab-button').forEach((b) => b.classList.toggle('active', b === btn));
    });
    if (name === 'A-number') btn.classList.add('active');
    tabBar.appendChild(btn);
    const pane = document.createElement('div');
    pane.className = 'tab-pane';
    pane.hidden = name !== 'A-number';
    panes[name] = pane;
  }
  el.appendChild(tabBar);

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
    pane.append(input, btn);
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
            status.textContent = '';
          }
        });
    };
    btn.addEventListener('click', run);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
    pane.append(input, btn, status, results);
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
    formula.addEventListener('input', () => {
      formulaErr.textContent = formula.value ? validateFormula(formula.value) ?? '' : '';
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
    pane.append(ta, pasteBtn, formula, formulaErr, count, formulaBtn);
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
        fetchBFile(seq.aNumber!, Number(cap.value))
          .then((terms) => handlers.onSequence(withTerms(seq, terms)))
          .catch((e) => handlers.onError(e instanceof Error ? e.message : String(e)))
          .finally(() => { btn.disabled = false; });
      });
      info.append(btn, cap);
    }
  }

  return { el, setInfo };
}
