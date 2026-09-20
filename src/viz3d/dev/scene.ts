// src/viz3d/dev/scene.ts
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Geometry3D } from '../types';

export interface Scene3D {
  setGeometry(g: Geometry3D): void;
  resize(): void;
  dispose(): void;
}

/**
 * The only file in this repository that knows a GPU exists.
 *
 * Orthographic, because an orthographic camera has no vanishing point to
 * invent convergence and looking down z is exactly the 2D picture. Depth test
 * off, because occlusion could otherwise make a difference between the real
 * and null panels that is about the camera rather than the numbers.
 */
export function createScene(canvas: HTMLCanvasElement): Scene3D {
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
  // The half-extent fit() last computed, remembered so resize() can rebuild
  // the frustum for the new aspect ratio without moving the camera or the
  // orbit target - that would throw away the angle the viewer had chosen.
  let halfExtent = 1;

  function frame(): void {
    renderer.render(scene, camera);
  }
  controls.addEventListener('change', frame);

  function fit(g: Geometry3D): void {
    const [minX, minY, minZ] = g.bounds.min;
    const [maxX, maxY, maxZ] = g.bounds.max;
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
    const half = Math.max(maxX - minX, maxY - minY, maxZ - minZ) / 2 || 1;
    halfExtent = half;
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    camera.left = -half * aspect * 1.1;
    camera.right = half * aspect * 1.1;
    camera.top = half * 1.1;
    camera.bottom = -half * 1.1;
    camera.updateProjectionMatrix();
    controls.target.set(cx, cy, cz);
    camera.position.set(cx, cy, cz + 100);
    controls.update();
  }

  return {
    setGeometry(g) {
      if (object) {
        object.geometry.dispose();
        material?.dispose();
        scene.remove(object);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(g.positions, 3));
      material = new THREE.LineBasicMaterial({ color: 0x7fd4ff, depthTest: false, transparent: true, opacity: 0.9 });
      object = new THREE.Line(geometry, material);
      // Index order is back-to-front because z is monotonic in index.
      object.renderOrder = 0;
      scene.add(object);
      fit(g);
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
      renderer.dispose();
    },
  };
}
