// src/viz3d/dev/scene.ts
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Geometry3D } from '../types';
import { decimate } from '../pick';
import { framingFor, frustumFor, type Framing } from '../frame';

export interface Scene3D {
  setGeometry(g: Geometry3D, colors?: Uint8Array): void;
  setNullGeometry(g: Geometry3D | null, colors?: Uint8Array): void;
  resize(): void;
  /** Re-renders the current frame without touching the canvas size or the
   *  camera - what a benchmark loop wants between frames. `resize()` is for
   *  an actual window resize: it reassigns the canvas size and reallocates
   *  the drawing buffer, which is wasted work (and a real cost) when nothing
   *  about the viewport has changed. */
  render(): void;
  dispose(): void;
}

/** Vertex cap for the invisible picking proxy - see `decimate` in ../pick.ts. */
const MAX_PICK_VERTICES = 20_000;

/**
 * The only file in this repository that knows a GPU exists.
 *
 * Orthographic, because an orthographic camera has no vanishing point to
 * invent convergence and looking down z is exactly the 2D picture. Depth test
 * off, because occlusion could otherwise make a difference between the real
 * and null panels that is about the camera rather than the numbers.
 *
 * `onPick`, if given, is called with a term index when the viewer clicks a
 * vertex of the REAL object (never the null model - see the click handler
 * below). It is optional so existing callers that only want to draw, not
 * pick, still compile.
 */
export function createScene(canvas: HTMLCanvasElement, onPick?: (term: number) => void): Scene3D {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0b0d);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10_000, 10_000);
  // Straight down z: the canonical zero, where the object is the flat drawing.
  camera.position.set(0, 0, 100);
  camera.lookAt(0, 0, 0);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false;

  // THREE.Line for mode 'lines', THREE.Points for mode 'points' - see
  // buildDrawable() below, which is the one place that decides between them.
  let object: THREE.Line | THREE.Points | null = null;
  let material: THREE.LineBasicMaterial | THREE.PointsMaterial | null = null;
  // The null-model object, tracked and disposed the same way as `object` /
  // `material` above - two objects sharing this one scene and camera, not a
  // second scene, so a single drag rotates both identically.
  let nullObject: THREE.Line | THREE.Points | null = null;
  let nullMaterial: THREE.LineBasicMaterial | THREE.PointsMaterial | null = null;
  // The half-extent reframe() last computed, remembered so resize() can
  // rebuild the frustum for the new aspect ratio without moving the camera or
  // the orbit target - that would throw away the angle the viewer had chosen.
  let halfExtent = 1;
  // The bounds and x-offset reframe() needs to recompute the union framing
  // whenever either object changes - the real object's own bounds, and (when
  // the null model is on) the null object's bounds plus where it actually
  // sits in the scene.
  let currentRealBounds: Geometry3D['bounds'] | null = null;
  let currentNullBounds: Geometry3D['bounds'] | null = null;
  let currentNullOffsetX = 0;

  // The picking proxy: an invisible, decimated THREE.Points copy of the real
  // object (see decimate() in ../pick.ts), cheap enough to raycast against on
  // click. proxySource[hitIndex] maps a hit back to a vertex index in the
  // real geometry, and currentTermOf maps that vertex index to its term.
  let proxy: THREE.Points | null = null;
  let proxyMaterial: THREE.PointsMaterial | null = null;
  let proxySource: Uint32Array | null = null;
  let currentTermOf: Uint32Array | null = null;

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  // Picking happens on click, never on pointermove/hover: a raycast against
  // tens of thousands of points is far too slow to run on every mouse move.
  // Named (not inline) so dispose() can remove exactly this listener - the
  // canvas outlives any one scene on the benchmark path, which builds a
  // second scene on the same canvas, so a listener left attached here
  // accumulates one per scene rather than being replaced.
  function handleClick(e: MouseEvent): void {
    if (!proxy || !onPick || !proxySource || !currentTermOf) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    raycaster.params.Points.threshold = (camera.top - camera.bottom) / 100;
    const hit = raycaster.intersectObject(proxy, false)[0];
    if (hit?.index !== undefined) onPick(currentTermOf[proxySource[hit.index]!]!);
  }
  canvas.addEventListener('click', handleClick);

  function frame(): void {
    renderer.render(scene, camera);
  }
  controls.addEventListener('change', frame);

  // Applies a computed framing to the camera and orbit target. The only
  // caller of this is reframe(), below - resize() deliberately does not call
  // it, because a plain resize must not move the camera or the orbit target,
  // only rebuild the frustum for the new aspect ratio from the halfExtent
  // this last set.
  function applyFraming(framing: Framing): void {
    halfExtent = framing.halfExtent;
    const [cx, cy, cz] = framing.centre;
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    const f = frustumFor(halfExtent, aspect);
    camera.left = f.left;
    camera.right = f.right;
    camera.top = f.top;
    camera.bottom = f.bottom;
    camera.updateProjectionMatrix();
    controls.target.set(cx, cy, cz);
    camera.position.set(cx, cy, cz + 100);
    controls.update();
  }

  // Re-runs the framing decision (see ../frame.ts) from whatever the real and
  // null bounds currently are, and applies it. Called whenever either object
  // changes - a new real geometry, or the null model appearing or
  // disappearing - so the frustum always holds whatever is actually on
  // screen: two objects when the null model is on, one when it is off or
  // absent.
  function reframe(): void {
    if (!currentRealBounds) return; // nothing drawn yet
    applyFraming(framingFor(currentRealBounds, currentNullBounds, currentNullOffsetX));
  }

  // Builds the THREE object for one panel's geometry, honouring `g.mode`:
  // `THREE.Points` for `'points'`, `THREE.Line` for `'lines'` (the only mode
  // any current view produces - `'points'` is for the spectral test the spec
  // defers, see types.ts). Shared between setGeometry and setNullGeometry so
  // the mode dispatch and material setup exist in exactly one place.
  function buildDrawable(
    g: Geometry3D,
    colors: Uint8Array | undefined,
    plainColor: number,
  ): { object: THREE.Line | THREE.Points; material: THREE.LineBasicMaterial | THREE.PointsMaterial } {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(g.positions, 3));
    if (colors) {
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3, true));
    }
    if (g.mode === 'points') {
      const pointsMaterial = new THREE.PointsMaterial({
        vertexColors: Boolean(colors),
        color: colors ? 0xffffff : plainColor,
        size: 3,
        sizeAttenuation: false,
        depthTest: false,
        transparent: true,
        opacity: 0.9,
      });
      return { object: new THREE.Points(geometry, pointsMaterial), material: pointsMaterial };
    }
    const lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: Boolean(colors),
      color: colors ? 0xffffff : plainColor,
      depthTest: false,
      transparent: true,
      opacity: 0.9,
    });
    return { object: new THREE.Line(geometry, lineMaterial), material: lineMaterial };
  }

  return {
    setGeometry(g, colors) {
      if (object) {
        object.geometry.dispose();
        material?.dispose();
        scene.remove(object);
      }
      // The proxy belongs to the real object and is rebuilt (and disposed -
      // geometry AND material, the leak an earlier review caught here) every
      // time the real object is, so a click always raycasts against the
      // geometry currently on screen rather than a stale one.
      if (proxy) {
        proxy.geometry.dispose();
        proxyMaterial?.dispose();
        scene.remove(proxy);
        proxy = null;
        proxyMaterial = null;
      }
      const built = buildDrawable(g, colors, 0x7fd4ff);
      object = built.object;
      material = built.material;
      // Index order is back-to-front because z is monotonic in index.
      object.renderOrder = 0;
      scene.add(object);

      const { positions: proxyPositions, sourceIndex } = decimate(g, MAX_PICK_VERTICES);
      const proxyGeometry = new THREE.BufferGeometry();
      proxyGeometry.setAttribute('position', new THREE.BufferAttribute(proxyPositions, 3));
      proxyMaterial = new THREE.PointsMaterial();
      proxy = new THREE.Points(proxyGeometry, proxyMaterial);
      proxy.visible = false;
      scene.add(proxy);
      proxySource = sourceIndex;
      currentTermOf = g.termOf;

      currentRealBounds = g.bounds;
      reframe();
      frame();
    },
    setNullGeometry(g, colors) {
      if (nullObject) {
        nullObject.geometry.dispose();
        nullMaterial?.dispose();
        scene.remove(nullObject);
        nullObject = null;
        nullMaterial = null;
      }
      if (!g) {
        // The null model just turned off (or there is none): drop it from
        // the framing too, or the camera keeps holding open space where it
        // used to be.
        currentNullBounds = null;
        currentNullOffsetX = 0;
        reframe();
        frame();
        return;
      }
      const builtNull = buildDrawable(g, colors, 0xff9f7f);
      nullObject = builtNull.object;
      nullMaterial = builtNull.material;
      // Offset along x by the null geometry's own width (1.2x, with a floor
      // for a degenerate zero-width bounds) rather than moved in view space -
      // this is the same scene and camera as `object`, so one drag rotates
      // both identically. That shared camera is the whole point: two objects
      // under two cameras is not a comparison.
      const nullOffsetX = (g.bounds.max[0] - g.bounds.min[0]) * 1.2 || 1;
      nullObject.position.x = nullOffsetX;
      scene.add(nullObject);
      // The null object just appeared (or changed shape): re-frame so the
      // camera actually holds both objects, rather than the real object's
      // own solo framing with the null one sitting outside the frustum.
      currentNullBounds = g.bounds;
      currentNullOffsetX = nullOffsetX;
      reframe();
      frame();
    },
    resize() {
      renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
      const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
      const f = frustumFor(halfExtent, aspect);
      camera.left = f.left;
      camera.right = f.right;
      camera.top = f.top;
      camera.bottom = f.bottom;
      camera.updateProjectionMatrix();
      frame();
    },
    // Plain re-render: no canvas-size reassignment, no buffer reallocation,
    // no frustum recompute. `resize()` does all of that and is for an actual
    // window resize; a benchmark's per-frame loop wants only this.
    render() {
      frame();
    },
    dispose() {
      canvas.removeEventListener('click', handleClick);
      controls.dispose();
      if (object) {
        scene.remove(object);
        object.geometry.dispose();
        material?.dispose();
      }
      if (nullObject) {
        scene.remove(nullObject);
        nullObject.geometry.dispose();
        nullMaterial?.dispose();
      }
      if (proxy) {
        scene.remove(proxy);
        proxy.geometry.dispose();
        proxyMaterial?.dispose();
      }
      object = null;
      material = null;
      nullObject = null;
      nullMaterial = null;
      proxy = null;
      proxyMaterial = null;
      proxySource = null;
      currentTermOf = null;
      renderer.dispose();
    },
  };
}
