// src/viz3d/dev/route.ts
import { registerAll } from '../../viz/all';
import { lookupById, fetchBFile, type BFileResult } from '../../sequence/oeisClient';
import { SequenceView, type Sequence } from '../../sequence/sequence';
import { getVisualizer } from '../../viz/registry';
import { defaultParams } from '../../viz/types';
import { geometryFor } from '../geometry';
import { colorsFor } from '../colors';
import { createScene, type Scene3D } from './scene';
import { buildControls, type ControlState } from './controls';
import { surrogateView } from './panels';
import { runBench, gpuName } from './bench';
import { overBudget, estimatedVertices, MEASURED_CEILING } from '../budget';

/** `lookupById`'s own shape, isolated so a test can substitute a fake loader with controllable timing. */
export type SequenceLoader = (aNumber: string) => Promise<Sequence>;

/**
 * `fetchBFile`'s own shape, isolated the same way `SequenceLoader` isolates
 * `lookupById` above - so a test can substitute a fake b-file fetch with its
 * own controllable timing, independent of the primary load's.
 */
export type BFileLoader = (aNumber: string, cap: number) => Promise<BFileResult>;

/**
 * What a rebuild actually drew, as distinct from what the control state
 * asked for. `lookupById` reads the site's inline shard data, which caps
 * every sequence at 80 terms regardless of what the term-count control
 * says - so "requested 5,000, drew 80" has to reach the reader, not pass
 * silently as if 5,000 had been honoured.
 */
export interface LoadReport {
  /** `state.terms` for this rebuild. */
  requested: number;
  /** Terms actually behind the drawn geometry. */
  loaded: number;
  /** Whether those terms came from the inline shard data or a b-file fetch. */
  source: 'inline' | 'bfile';
  /**
   * Only meaningful when `source` is `'bfile'`: false means the b-file
   * itself ran out before `requested`, not that the cap did - the same
   * distinction `fetchBFile` reports and `sequencePanel.ts` reads.
   */
  truncated?: boolean;
  /** Set when a b-file fetch was attempted and failed; `source` is then `'inline'`. */
  error?: string;
}

/**
 * What an over-budget estimate names, so the reader can be told what was
 * actually asked for rather than just a bare vertex count.
 */
export interface OverBudgetInfo {
  /** Combined vertex count across both objects, when the null model is on. */
  vertices: number;
  /** The request this estimate was computed for. */
  state: ControlState;
}

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
 *
 * There are now TWO awaits in the happy path: the inline load, and - when the
 * requested term count needs more than the inline data provides - a b-file
 * fetch. Both are checked against `generation` after they resolve. Checking
 * only the first would reopen exactly the bug this guard exists for: a slow
 * b-file fetch from an old request resolving after a newer request has
 * already drawn, and overwriting it. The same check also guards the b-file
 * fetch's REJECTION, not just its success - a superseded rebuild whose
 * b-file fetch fails must stay just as silent as one whose b-file fetch
 * succeeds; otherwise a slow failure from an old request can still overwrite
 * a newer request's already-drawn geometry with a stale error report.
 *
 * The whole body runs inside a try/catch so a load failure - most commonly
 * `lookupById` throwing on a typo'd A-number - reports through `onLoadError`
 * instead of becoming an unhandled rejection that `void rebuild(state)`
 * swallows silently. That catch is generation-checked too: a superseded
 * request's failure must say nothing, the same as its success would.
 */
export function createRebuilder(
  scene: Pick<Scene3D, 'setGeometry' | 'setNullGeometry'>,
  loader: SequenceLoader = lookupById,
  // Reports the real (non-null-model) sequence behind each winning rebuild,
  // so the route can resolve a picked term index to its value without
  // re-fetching or duplicating the generation guard below.
  onSequence?: (seq: SequenceView) => void,
  // Reports an estimate past MEASURED_CEILING for the build that was about to
  // happen - the build has NOT happened yet at this point, unlike the geometry
  // this used to report after the fact. Call `buildAnyway` to proceed with
  // this exact request despite the estimate.
  onOverBudget?: (info: OverBudgetInfo, buildAnyway: () => void) => void,
  // Reports what was actually loaded for the winning rebuild - see LoadReport.
  onLoadReport?: (report: LoadReport) => void,
  // `fetchBFile`'s production default, isolated so a test can substitute a
  // fake with controllable timing without touching the network.
  bfileLoader: BFileLoader = fetchBFile,
  // Reports a load failure - most commonly a typo'd A-number throwing out of
  // `lookupById` - for the winning rebuild only. The route wires this into
  // the readout; the last object already on screen is left alone.
  onLoadError?: (message: string) => void,
): (state: ControlState, force?: boolean) => Promise<void> {
  let generation = 0;
  const rebuild = async (state: ControlState, force = false): Promise<void> => {
    const mine = ++generation;
    try {
      const loaded = await loader(state.aNumber);
      if (mine !== generation) return; // a newer rebuild started while this was in flight

      // The inline data (lookupById's shard entry) caps every sequence at 80
      // terms. Reach further the same way the engine's own b-file button does
      // (sequencePanel.ts): fetch the b-file, capped at what was actually
      // asked for. A fetch failure degrades to the inline terms rather than
      // failing the draw - the dev route is a tool, not a gate.
      let terms = loaded.terms;
      let report: LoadReport;
      if (state.terms > terms.length) {
        try {
          const bfile = await bfileLoader(state.aNumber, state.terms);
          // Second await, second staleness check - see the doc comment above.
          if (mine !== generation) return;
          terms = bfile.terms;
          report = { requested: state.terms, loaded: terms.length, source: 'bfile', truncated: bfile.truncated };
        } catch (e) {
          // Same guard as the success branch above: a superseded request's
          // b-file REJECTION must not reach onLoadReport/onSequence/setGeometry
          // either, or a slow failure from an old request can overwrite a
          // newer request's already-drawn geometry.
          if (mine !== generation) return;
          report = {
            requested: state.terms,
            loaded: terms.length,
            source: 'inline',
            error: e instanceof Error ? e.message : String(e),
          };
        }
      } else {
        report = { requested: state.terms, loaded: Math.min(state.terms, terms.length), source: 'inline' };
      }
      onLoadReport?.(report);

      const seq = new SequenceView({ ...loaded, terms: terms.slice(0, state.terms) });
      onSequence?.(seq);
      const defaults = defaultParams(getVisualizer(state.vizId).params);

      // Estimated BEFORE geometryFor runs, not after - the whole point of the
      // gate. The null model draws the same view at the same term count, so
      // it costs exactly as much as the real object and is counted too.
      const perObject = estimatedVertices(state.vizId, seq, defaults);
      const totalVertices = perObject * (state.nullOn ? 2 : 1);
      if (overBudget(totalVertices) && !force) {
        onOverBudget?.({ vertices: totalVertices, state }, () => { void rebuild(state, true); });
        return;
      }

      const geometry = geometryFor(state.vizId, seq, defaults, { step: state.step });
      if (geometry) {
        scene.setGeometry(geometry, colorsFor(geometry, seq.length));
      }

      // Same view, params and lift as the real object, fed the same sequence
      // scrambled by the site's own permutation null model - so the only
      // difference between the two panels is the scrambling, not the geometry
      // pipeline that draws them.
      const nullGeometry = state.nullOn
        ? geometryFor(state.vizId, surrogateView(seq, 'permutation', 1), defaults, { step: state.step })
        : null;
      scene.setNullGeometry(nullGeometry, nullGeometry ? colorsFor(nullGeometry, seq.length) : undefined);
    } catch (e) {
      // A superseded request's failure must be exactly as silent as a
      // superseded request's success - otherwise a stale rejection (a typo'd
      // A-number from three edits ago, resolving late) could overwrite the
      // readout for a request that has already won and drawn.
      if (mine !== generation) return;
      onLoadError?.(e instanceof Error ? e.message : String(e));
    }
  };
  return rebuild;
}

/**
 * Turns a LoadReport into the sentence the readout shows, so "asked for
 * 5,000, got 80" is something the reader sees rather than something they
 * have to notice on their own.
 */
export function describeLoad(report: LoadReport): string {
  const requested = report.requested.toLocaleString();
  const loaded = report.loaded.toLocaleString();
  if (report.error) {
    return `loaded ${loaded} terms (the b-file fetch failed: ${report.error} - showing the inline data instead).`;
  }
  if (report.source === 'bfile') {
    if (!report.truncated && report.loaded < report.requested) {
      return `loaded ${loaded} of ${requested} requested terms - the b-file itself only has ${loaded}.`;
    }
    return `loaded ${loaded} terms from the b-file.`;
  }
  if (report.loaded < report.requested) {
    return `loaded ${loaded} of ${requested} requested terms.`;
  }
  return `loaded ${loaded} terms.`;
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
  // What the last rebuild actually loaded, kept so an over-budget warning -
  // which fires after the load report, for the same rebuild - can be shown
  // alongside it instead of erasing it.
  let loadStatus = '';
  const rebuild = createRebuilder(
    scene,
    undefined,
    (seq) => { seqRef = seq; },
    // The build has NOT happened at this point - see createRebuilder's doc
    // comment. No window.confirm/alert: this project drives Chrome through
    // automation, and a modal dialog blocks it. The control is an ordinary
    // button in the readout instead.
    ({ vertices, state: asked }, buildAnyway) => {
      readout.replaceChildren();
      const message = document.createElement('span');
      message.textContent =
        `${loadStatus} ${asked.vizId} / ${asked.aNumber} / ${asked.terms.toLocaleString()} terms` +
        `${asked.nullOn ? ' + null model' : ''} would draw ${vertices.toLocaleString()} vertices - ` +
        `past the measured ceiling (${MEASURED_CEILING.toLocaleString()}).`;
      const proceed = document.createElement('button');
      proceed.type = 'button';
      proceed.textContent = 'Build anyway';
      proceed.addEventListener('click', () => {
        readout.textContent = 'building...';
        buildAnyway();
      });
      readout.append(message, document.createElement('br'), proceed);
    },
    (report) => {
      loadStatus = describeLoad(report);
      readout.textContent = loadStatus;
    },
    undefined,
    (message) => {
      // The spec's promise: show the message, leave the last object on
      // screen. Nothing here touches the scene.
      readout.textContent = `couldn't load ${state.aNumber}: ${message}`;
    },
  );

  root.appendChild(buildControls(state, (next) => {
    state = next;
    void rebuild(state);
  }));
  root.appendChild(readout);
  await rebuild(state);
}
