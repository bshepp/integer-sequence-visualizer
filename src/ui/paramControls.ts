import type { ParamSpec, ParamValue, Params } from '../viz/types';

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
  return wrap;
}
