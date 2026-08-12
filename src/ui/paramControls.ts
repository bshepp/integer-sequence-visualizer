import type { ParamSpec, ParamValue, Params } from '../viz/types';
import { mulberry32 } from '../nullmodel/rng';

/**
 * A fresh draw for every numeric parameter of the current view.
 *
 * Exploration rather than measurement: NCurve's own loop is "press it and
 * look", and a knob you can spin is how you find a shape you would never have
 * typed coordinates for. Sweep answers the systematic question - how does one
 * parameter change things - and cannot answer this one.
 *
 * Seeded from mulberry32 like everything else here, not Math.random. The
 * project keeps no unseeded randomness in src/, and the same discipline pays
 * off twice over: the sequence of draws is reproducible in a test, and the
 * result lands in the address anyway, so any shape found this way can be
 * shared and returned to.
 *
 * Selects and booleans are left alone. Randomising which visualizer parameter
 * is a colour mode or a scale type would change what the picture *is* rather
 * than where it sits in a continuum.
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
