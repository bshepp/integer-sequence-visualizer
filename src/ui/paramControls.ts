import type { ParamSpec, ParamValue, Params } from '../viz/types';

export function buildParamControls(
  specs: ParamSpec[],
  values: Params,
  onChange: (id: string, value: ParamValue) => void,
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'param-controls';
  for (const spec of specs) {
    const field = document.createElement('label');
    field.className = 'param-field';
    const title = document.createElement('span');
    title.textContent = spec.label;
    field.appendChild(title);

    if (spec.kind === 'number') {
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(spec.min);
      input.max = String(spec.max);
      input.step = String(spec.step);
      input.value = String(values[spec.id] ?? spec.default);
      const val = document.createElement('span');
      val.className = 'param-value';
      val.textContent = input.value;
      input.addEventListener('input', () => {
        val.textContent = input.value;
        onChange(spec.id, Number(input.value));
      });
      field.append(input, val);
    } else if (spec.kind === 'select') {
      const sel = document.createElement('select');
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
      cb.checked = Boolean(values[spec.id] ?? spec.default);
      cb.addEventListener('change', () => onChange(spec.id, cb.checked));
      field.appendChild(cb);
    }
    wrap.appendChild(field);
  }
  return wrap;
}
