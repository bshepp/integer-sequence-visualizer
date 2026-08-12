import type { ParamSpec, ParamValue, Params } from '../viz/types';
import { mulberry32 } from '../nullmodel/rng';

/**
 * A fresh draw for every numeric parameter of the current view.
 *
 * Exploration rather than measurement. Sweep answers the systematic question -
 * how does one parameter change things - and cannot answer this one: which
 * corner of a three-dimensional space is worth looking at at all. That became
 * a real question when the polyarc modulus opened to 360, because the reachable
 * space went from a few dozen settings to hundreds of thousands.
 *
 * Seeded from mulberry32, not Math.random. src/ keeps no unseeded randomness,
 * and the discipline pays twice: the run of draws is reproducible in a test,
 * and the result lands in the address, so a shape found this way can be shared
 * and returned to.
 *
 * Selects and booleans are left alone. Randomising a colour mode or a scale
 * type changes what the picture IS, not where it sits in a continuum.
 */
export function randomiseNumbers(specs: ParamSpec[], seed: number): Params {
  const rand = mulberry32(seed);
  const out: Params = {};
  for (const spec of specs) {
    if (spec.kind !== 'number') continue;
    const steps = Math.floor((spec.max - spec.min) / spec.step);
    out[spec.id] = spec.min + Math.round(rand() * steps) * spec.step;
  }
  return out;
}

// Ids have to be unique in the document for <label for> to resolve, and the
// controls are rebuilt every time the visualizer changes. Same reasoning as
// the uid prefixes in app.ts and buildSequencePanel.
let fieldSeq = 0;

/** How many decimals a step implies, so nudging cannot drift off the grid. */
function decimalsOf(step: number): number {
  const s = String(step);
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : s.length - dot - 1;
}

export function buildParamControls(
  specs: ParamSpec[],
  values: Params,
  onChange: (id: string, value: ParamValue) => void,
  onRandomise?: () => void,
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'param-controls';
  for (const spec of specs) {
    // A div, not a label: the numeric fields contain buttons, and a button
    // inside a label also activates the label's control when clicked.
    const field = document.createElement('div');
    field.className = 'param-field';
    const id = `param-${++fieldSeq}`;
    const title = document.createElement('label');
    title.htmlFor = id;
    title.textContent = spec.label;
    field.appendChild(title);

    if (spec.kind === 'number') {
      const input = document.createElement('input');
      input.type = 'range';
      input.id = id;
      input.min = String(spec.min);
      input.max = String(spec.max);
      input.step = String(spec.step);
      input.value = String(values[spec.id] ?? spec.default);
      const val = document.createElement('span');
      val.className = 'param-value';
      val.textContent = input.value;

      const places = decimalsOf(spec.step);
      const clamp = (n: number): number => {
        const onGrid = spec.min + Math.round((n - spec.min) / spec.step) * spec.step;
        return Number(Math.min(spec.max, Math.max(spec.min, onGrid)).toFixed(places));
      };
      const atEnds = () => {
        down.disabled = Number(input.value) <= spec.min;
        up.disabled = Number(input.value) >= spec.max;
      };
      const apply = (n: number): void => {
        input.value = String(n);
        val.textContent = input.value;
        atEnds();
        onChange(spec.id, n);
      };

      // Single steps by pointer. A range input is already keyboard-steppable
      // with the arrow keys, but dragging one that spans 2 to 360 cannot land
      // on an exact value, and these views are often read at one specific
      // setting rather than swept.
      const nudge = (dir: -1 | 1): HTMLButtonElement => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `param-step param-step--${dir < 0 ? 'down' : 'up'}`;
        b.textContent = dir < 0 ? '−' : '+';
        b.setAttribute('aria-label', `${dir < 0 ? 'Decrease' : 'Increase'} ${spec.label} by ${spec.step}`);
        b.addEventListener('click', () => apply(clamp(Number(input.value) + dir * spec.step)));
        return b;
      };
      const down = nudge(-1);
      const up = nudge(1);

      input.addEventListener('input', () => {
        val.textContent = input.value;
        atEnds();
        onChange(spec.id, Number(input.value));
      });
      atEnds();
      field.append(down, input, up, val);
    } else if (spec.kind === 'select') {
      const sel = document.createElement('select');
      sel.id = id;
      for (const opt of spec.options) {
        const o = document.createElement('option');
        o.value = o.textContent = opt;
        sel.appendChild(o);
      }
      sel.value = String(values[spec.id] ?? spec.default);
      sel.addEventListener('change', () => onChange(spec.id, sel.value));
      field.appendChild(sel);
    } else {
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = id;
      cb.checked = Boolean(values[spec.id] ?? spec.default);
      cb.addEventListener('change', () => onChange(spec.id, cb.checked));
      field.appendChild(cb);
    }
    wrap.appendChild(field);
  }

  // Last in the row rather than after it. Appended outside .param-controls it
  // became a flex item of the topbar and dropped to a line of its own under
  // the first slider; inside, it flows after the final parameter the way any
  // other item in the row does.
  if (onRandomise && specs.some((s) => s.kind === 'number')) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'randomise-params';
    b.textContent = 'Random';
    b.title = 'Draw new values for every numeric parameter of this view';
    b.addEventListener('click', onRandomise);
    wrap.appendChild(b);
  }
  return wrap;
}
