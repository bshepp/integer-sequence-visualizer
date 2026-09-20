// src/viz3d/dev/scene.ts
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Geometry3D } from '../types';
import { decimate } from '../pick';
import { framingFor, type Framing } from '../frame';

export interface Scene3D {
  setGeometry(g: Geometry3D, colors?: Uint8Array): void;
  setNullGeometry(g: Geometry3D | null, colors?: Uint8Array): void;
  resize(): void;
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

  let object: THREE.Line | null = null;
  let material: THREE.LineBasicMaterial | null = null;
  // The null-model object, tracked and disposed the same way as `object` /
  // `material` above - two objects sharing this one scene and camera, not a
  // second scene, so a single drag rotates both identically.
  let nullObject: THREE.Line | null = null;
  let nullMaterial: THREE.LineBasicMaterial | null = null;
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
  canvas.addEventListener('click', (e) => {
    if (!proxy || !onPick || !proxySource || !currentTermOf) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    raycaster.params.Points.threshold = (camera.top - camera.bottom) / 100;
    const hit = raycaster.intersectObject(proxy, false)[0];
    if (hit?.index !== undefined) onPick(currentTermOf[proxySource[hit.index]!]!);
  });

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
    camera.left = -halfExtent * aspect * 1.1;
    camera.right = halfExtent * aspect * 1.1;
    camera.top = halfExtent * 1.1;
    camera.bottom = -halfExtent * 1.1;
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
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(g.positions, 3));
      if (colors) {
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3, true));
      }
      material = new THREE.LineBasicMaterial({
        vertexColors: Boolean(colors),
        color: colors ? 0xffffff : 0x7fd4ff,
        depthTest: false,
        transparent: true,
        opacity: 0.9,
      });
      object = new THREE.Line(geometry, material);
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
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(g.positions, 3));
      if (colors) {
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3, true));
      }
      nullMaterial = new THREE.LineBasicMaterial({
        vertexColors: Boolean(colors),
        color: colors ? 0xffffff : 0xff9f7f,
        depthTest: false,
        transparent: true,
        opacity: 0.9,
      });
      nullObject = new THREE.Line(geometry, nullMaterial);
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
      camera.left = -halfExtent * aspect * 1.1;
      camera.right = halfExtent * aspect * 1.1;
      camera.top = halfExtent * 1.1;
      camera.bottom = -halfExtent * 1.1;
      camera.updateProjectionMatrix();
      frame();
    },
    dispose() {
      controls.dispose();
      object?.geometry.dispose();
      material?.dispose();
      nullObject?.geometry.dispose();
      nullMaterial?.dispose();
      proxy?.geometry.dispose();
      proxyMaterial?.dispose();
      renderer.dispose();
    },
  };
}
