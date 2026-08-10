/* Copyright (c) 2026 QuarkX Sdn. Bhd. (202501056786 / 1658192-K). All rights reserved. */

/*
 * Renderer, scene, camera and lighting.
 *
 * Everything here is world-independent: the stage is created empty and the zone
 * builders then add to `stage.scene`. The post-processing chain is a separate
 * step (see post.js) because it is attached after the world exists.
 *
 * Responsibilities:
 *   - WebGL renderer configuration and pixel ratio budget
 *   - scene background, fog and studio lighting
 *   - camera and viewport resize
 */

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { PALETTE, MOBILE_BREAKPOINT } from "./world.js";

/**
 * Creates the render stage: renderer, scene, camera and lights.
 *
 * @param {HTMLCanvasElement} canvas Canvas to render into.
 * @returns {{
 *   renderer: THREE.WebGLRenderer,
 *   scene: THREE.Scene,
 *   camera: THREE.PerspectiveCamera,
 *   sun: THREE.DirectionalLight,
 *   dpr: number,
 *   isMobile: boolean,
 *   flags: URLSearchParams,
 *   resize: () => void
 * }} Stage handle. `flags` carries the debug switches read from the query string.
 * @throws {Error} If a WebGL context cannot be created.
 */
export function createStage(canvas) {
  const flags = new URLSearchParams(window.location.search);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });

  const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
  // The clay look gains nothing above roughly 1.6x, so cap the pixel ratio and
  // spend the budget on the post chain instead.
  const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 1.6);
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.paper);
  // Fog starts well beyond the near zone so only the far end of the path fades,
  // which keeps the diorama feeling like a table rather than a landscape.
  scene.fog = new THREE.Fog(PALETTE.paper, 95, 235);

  const camera = new THREE.PerspectiveCamera(
    28,
    window.innerWidth / window.innerHeight,
    0.1,
    500
  );

  // Studio environment light: soft light from everywhere, like a product shot.
  if (!flags.has("noenv")) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
  }

  // High-key clay lighting.
  scene.add(new THREE.HemisphereLight(0xfff8ec, 0xddccb4, 0.55));
  const sun = new THREE.DirectionalLight(0xfff3e0, 1.45);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  // The shadow frustum travels with the camera focus, so it only has to cover
  // the neighbourhood in view rather than the whole 300 unit path.
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70;
  sun.shadow.camera.bottom = -70;
  sun.shadow.camera.near = 5;
  sun.shadow.camera.far = 180;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.add(sun.target);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  return { renderer, scene, camera, sun, dpr, isMobile, flags, resize };
}
