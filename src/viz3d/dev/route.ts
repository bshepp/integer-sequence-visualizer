// src/viz3d/dev/route.ts
import { registerAll } from '../../viz/all';
import { lookupById } from '../../sequence/oeisClient';
import { SequenceView, type Sequence } from '../../sequence/sequence';
import { getVisualizer } from '../../viz/registry';
import { defaultParams } from '../../viz/types';
import { geometryFor } from '../geometry';
import { createScene, type Scene3D } from './scene';
import { buildControls, type ControlState } from './controls';

/** `lookupById`'s own shape, isolated so a test can substitute a fake loader with controllable timing. */
export type SequenceLoader = (aNumber: string) => Promise<Sequence>;

/**
 * Builds a rebuild function for one mounted scene, stamped with a
 * request-generation token: every call bumps `generation`, and a call whose
 * fetch resolves after a newer call has started is dropped rather than
 * allowed to call `setGeometry`.
 *
 * Without this, two rebuilds can be in flight at once - a fast slider drag,
 * or typing an A-number, then another, then back to the first - and whichever
 * fetch happens to resolve LAST wins, even when it is the stale one: the
 * screen can end up showing a sequence the controls no longer name.
 */
export function createRebuilder(
  scene: Pick<Scene3D, 'setGeometry'>,
  loader: SequenceLoader = lookupById,
): (state: ControlState) => Promise<void> {
  let generation = 0;
  return async function rebuild(state: ControlState): Promise<void> {
    const mine = ++generation;
    const loaded = await loader(state.aNumber);
    if (mine !== generation) return; // a newer rebuild started while this was in flight
    const seq = new SequenceView({ ...loaded, terms: loaded.terms.slice(0, state.terms) });
    const defaults = defaultParams(getVisualizer(state.vizId).params);
    const geometry = geometryFor(state.vizId, seq, defaults, { step: state.step });
    if (geometry) scene.setGeometry(geometry);
  };
}

/**
 * The dev-only 3D route. Mounted from main.ts under import.meta.env.DEV, at
 * ?3d, and never reachable from the shipped site.
 */
export async function mount3dRoute(root: HTMLElement): Promise<void> {
  registerAll();
  root.replaceChildren();

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100vw;height:100vh;display:block';
  root.appendChild(canvas);

  let scene: Scene3D;
  try {
    scene = createScene(canvas);
  } catch {
    const p = document.createElement('p');
    p.textContent = 'This browser has no WebGL context, so the 3D tool cannot run. The engine is unaffected.';
    root.replaceChildren(p);
    return;
  }
  scene.resize();
  window.addEventListener('resize', () => scene.resize());

  let state: ControlState = { vizId: 'turtle', aNumber: 'A000002', terms: 500, step: 0.5 };
  const rebuild = createRebuilder(scene);

  root.appendChild(buildControls(state, (next) => {
    state = next;
    void rebuild(state);
  }));
  await rebuild(state);
}
