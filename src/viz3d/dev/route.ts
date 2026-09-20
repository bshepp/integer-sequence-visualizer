// src/viz3d/dev/route.ts
import { registerAll } from '../../viz/all';
import { lookupById } from '../../sequence/oeisClient';
import { SequenceView } from '../../sequence/sequence';
import { getVisualizer } from '../../viz/registry';
import { defaultParams } from '../../viz/types';
import { geometryFor } from '../geometry';
import { createScene, type Scene3D } from './scene';
import { buildControls, type ControlState } from './controls';

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

  async function rebuild(): Promise<void> {
    const loaded = await lookupById(state.aNumber);
    const seq = new SequenceView({ ...loaded, terms: loaded.terms.slice(0, state.terms) });
    const defaults = defaultParams(getVisualizer(state.vizId).params);
    const geometry = geometryFor(state.vizId, seq, defaults, { step: state.step });
    if (geometry) scene.setGeometry(geometry);
  }

  root.appendChild(buildControls(state, (next) => {
    state = next;
    void rebuild();
  }));
  await rebuild();
}
