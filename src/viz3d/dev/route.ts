// src/viz3d/dev/route.ts
import { registerAll } from '../../viz/all';
import { lookupById } from '../../sequence/oeisClient';
import { SequenceView, type Sequence } from '../../sequence/sequence';
import { getVisualizer } from '../../viz/registry';
import { defaultParams } from '../../viz/types';
import { geometryFor } from '../geometry';
import { colorsFor } from '../colors';
import { createScene, type Scene3D } from './scene';
import { buildControls, type ControlState } from './controls';
import { surrogateView } from './panels';
import { runBench, gpuName } from './bench';

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
  scene: Pick<Scene3D, 'setGeometry' | 'setNullGeometry'>,
  loader: SequenceLoader = lookupById,
  // Reports the real (non-null-model) sequence behind each winning rebuild,
  // so the route can resolve a picked term index to its value without
  // re-fetching or duplicating the generation guard below.
  onSequence?: (seq: SequenceView) => void,
): (state: ControlState) => Promise<void> {
  let generation = 0;
  return async function rebuild(state: ControlState): Promise<void> {
    const mine = ++generation;
    const loaded = await loader(state.aNumber);
    if (mine !== generation) return; // a newer rebuild started while this was in flight
    const seq = new SequenceView({ ...loaded, terms: loaded.terms.slice(0, state.terms) });
    onSequence?.(seq);
    const defaults = defaultParams(getVisualizer(state.vizId).params);
    const geometry = geometryFor(state.vizId, seq, defaults, { step: state.step });
    if (geometry) scene.setGeometry(geometry, colorsFor(geometry, seq.length));

    // Same view, params and lift as the real object, fed the same sequence
    // scrambled by the site's own permutation null model - so the only
    // difference between the two panels is the scrambling, not the geometry
    // pipeline that draws them.
    const nullGeometry = state.nullOn
      ? geometryFor(state.vizId, surrogateView(seq, 'permutation', 1), defaults, { step: state.step })
      : null;
    scene.setNullGeometry(nullGeometry, nullGeometry ? colorsFor(nullGeometry, seq.length) : undefined);
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

  // Bottom-right, clear of the controls (top-left). Built ahead of
  // createScene so the pick callback below can close over it; it is only
  // appended to the DOM once the WebGL guard has passed.
  const readout = document.createElement('div');
  readout.className = 'readout3d';
  readout.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:10;font:13px system-ui;color:#ddd';

  // The real (non-null-model) sequence behind what's currently drawn, kept so
  // a picked term index can be resolved to its value. Set by createRebuilder's
  // onSequence hook, which only fires for the winning rebuild.
  let seqRef: SequenceView | undefined;

  let scene: Scene3D;
  try {
    scene = createScene(canvas, (term) => {
      readout.textContent = seqRef ? `term ${term} = ${seqRef.term(term)}` : `term ${term}`;
    });
  } catch {
    const p = document.createElement('p');
    p.textContent = 'This browser has no WebGL context, so the 3D tool cannot run. The engine is unaffected.';
    root.replaceChildren(p);
    return;
  }

  // Benchmark mode: measure frame time against vertex count on this GPU and
  // print the results, rather than mounting the normal controls. The guard's
  // scene above was only created to prove WebGL works, so it's disposed here
  // rather than left running alongside runBench's own scene on the same
  // canvas.
  if (new URLSearchParams(location.search).has('bench')) {
    scene.dispose();
    const rows = await runBench(canvas);
    console.table(rows);
    console.log('GPU:', gpuName(canvas));
    return;
  }

  scene.resize();
  window.addEventListener('resize', () => scene.resize());

  let state: ControlState = { vizId: 'turtle', aNumber: 'A000002', terms: 500, step: 0.5, nullOn: true };
  const rebuild = createRebuilder(scene, undefined, (seq) => { seqRef = seq; });

  root.appendChild(buildControls(state, (next) => {
    state = next;
    void rebuild(state);
  }));
  root.appendChild(readout);
  await rebuild(state);
}
