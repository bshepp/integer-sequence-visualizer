// src/viz3d/dev/controls.ts
import { SUPPORTED_3D } from '../geometry';

export interface ControlState {
  vizId: string;
  aNumber: string;
  terms: number;
  step: number;
  /** Whether the null-model panel is drawn beside the real object. Defaults to true. */
  nullOn: boolean;
  /**
   * View parameters laid over the view's own defaults. Only the address sets
   * these - there is no control for them - and they exist because the curve
   * view defaults to mod 7 while NCurve's drawings are all mod 360 - 180.
   */
  params?: Record<string, number>;
}

/** Address keys the route reads for itself; anything else numeric is a view parameter. */
const FRAME_KEYS = new Set(['3d', 'bench', 'viz', 'seq', 'terms', 'step', 'null']);

const TERMS_MIN = 2, TERMS_MAX = 100000;

/**
 * The starting state the address asks for, over `base`.
 *
 *   ?3d&viz=polyarc&seq=A000217&terms=2160&angle=1&modulus=360&offset=-180
 *
 * Anything missing or unreadable keeps its value from `base` rather than
 * failing, so a mistyped address still opens the tool.
 */
export function stateFromQuery(search: string, base: ControlState): ControlState {
  const q = new URLSearchParams(search);
  const state: ControlState = { ...base };

  const viz = q.get('viz');
  if (viz && (SUPPORTED_3D as readonly string[]).includes(viz)) state.vizId = viz;

  const seq = q.get('seq')?.trim();
  if (seq) state.aNumber = seq;

  const terms = Number(q.get('terms') ?? NaN);
  if (Number.isFinite(terms)) state.terms = Math.min(TERMS_MAX, Math.max(TERMS_MIN, Math.round(terms)));

  const step = Number(q.get('step') ?? NaN);
  if (Number.isFinite(step)) state.step = step;

  if (q.has('null')) state.nullOn = q.get('null') !== '0';

  const params: Record<string, number> = {};
  for (const [key, value] of q) {
    if (FRAME_KEYS.has(key) || value === '') continue;
    const n = Number(value);
    if (Number.isFinite(n)) params[key] = n;
  }
  if (Object.keys(params).length > 0) state.params = params;

  return state;
}

/**
 * The dev route's controls. Plain DOM, no three, no GL - so the wiring is
 * testable in jsdom even though the drawing is not.
 */
export function buildControls(initial: ControlState, onChange: (s: ControlState) => void): HTMLElement {
  let state = { ...initial };
  const el = document.createElement('div');
  el.className = 'controls3d';
  el.style.cssText = 'position:fixed;left:12px;top:12px;z-index:10;display:flex;gap:8px;align-items:center;font:13px system-ui;color:#ddd;background:#1a1a1ecc;padding:8px 10px;border-radius:6px';

  const emit = (patch: Partial<ControlState>): void => {
    state = { ...state, ...patch };
    onChange(state);
  };

  const viz = document.createElement('select');
  viz.className = 'viz';
  for (const id of SUPPORTED_3D) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = id;
    viz.appendChild(option);
  }
  viz.value = state.vizId;
  // Overrides were written for the view the address named; carrying a curve
  // view's angle into the turtle walk would be a setting nobody chose.
  viz.addEventListener('change', () => emit({ vizId: viz.value, params: undefined }));

  const aNumber = document.createElement('input');
  aNumber.className = 'anumber';
  aNumber.value = state.aNumber;
  aNumber.size = 8;
  aNumber.addEventListener('change', () => emit({ aNumber: aNumber.value.trim() }));

  const terms = document.createElement('input');
  terms.className = 'terms';
  terms.type = 'number';
  terms.min = String(TERMS_MIN);
  terms.max = String(TERMS_MAX);
  terms.value = String(state.terms);
  terms.addEventListener('change', () => emit({ terms: Math.min(TERMS_MAX, Math.max(TERMS_MIN, Number(terms.value) || TERMS_MIN)) }));

  const step = document.createElement('input');
  step.className = 'step';
  step.type = 'range';
  step.min = '0';
  step.max = '3';
  step.step = '0.05';
  step.value = String(state.step);
  step.addEventListener('input', () => emit({ step: Number(step.value) }));

  const flat = document.createElement('button');
  flat.className = 'flat';
  flat.type = 'button';
  flat.textContent = 'Flat';
  flat.addEventListener('click', () => {
    step.value = '0';
    emit({ step: 0 });
  });

  const nullToggleLabel = document.createElement('label');
  const nullToggle = document.createElement('input');
  nullToggle.className = 'nulltoggle';
  nullToggle.type = 'checkbox';
  nullToggle.checked = state.nullOn;
  nullToggle.addEventListener('change', () => emit({ nullOn: nullToggle.checked }));
  nullToggleLabel.append(nullToggle, document.createTextNode('null'));

  el.append(viz, aNumber, terms, step, flat, nullToggleLabel);
  return el;
}
