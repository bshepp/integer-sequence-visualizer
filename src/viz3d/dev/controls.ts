// src/viz3d/dev/controls.ts
import { SUPPORTED_3D } from '../geometry';

export interface ControlState {
  vizId: string;
  aNumber: string;
  terms: number;
  step: number;
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
  viz.addEventListener('change', () => emit({ vizId: viz.value }));

  const aNumber = document.createElement('input');
  aNumber.className = 'anumber';
  aNumber.value = state.aNumber;
  aNumber.size = 8;
  aNumber.addEventListener('change', () => emit({ aNumber: aNumber.value.trim() }));

  const terms = document.createElement('input');
  terms.className = 'terms';
  terms.type = 'number';
  terms.min = '2';
  terms.max = '100000';
  terms.value = String(state.terms);
  terms.addEventListener('change', () => emit({ terms: Math.max(2, Number(terms.value) || 2) }));

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

  el.append(viz, aNumber, terms, step, flat);
  return el;
}
