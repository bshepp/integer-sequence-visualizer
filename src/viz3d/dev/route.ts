// src/viz3d/dev/route.ts
import { registerAll } from '../../viz/all';
import { lookupById } from '../../sequence/oeisClient';
import { SequenceView } from '../../sequence/sequence';
import { geometryFor } from '../geometry';
import { createScene } from './scene';

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

  let scene;
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

  const seq = new SequenceView(await lookupById('A000002'));
  const geometry = geometryFor('turtle', seq, { angle: 90, k: 4 }, { step: 0.5 });
  if (geometry) scene.setGeometry(geometry);
}
