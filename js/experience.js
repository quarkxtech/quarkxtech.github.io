/* Copyright (c) 2026 QuarkX Sdn. Bhd. (202501056786 / 1658192-K). All rights reserved. */

/*
 * WebGL experience: the paper diorama.
 *
 * A clay-miniature world in warm Claude tones, seen from above and scrubbed by
 * scroll. A coral signal ribbon flows along the ground through four zones:
 * 01 district grid, 02 plant works, 03 eval grid, 04 edge station.
 *
 * This module is the public entry point. It owns assembly and the frame loop
 * only; the stage, the world and the choreography each live in js/experience/.
 *
 * Responsibilities:
 *   - build the stage, then the world, in a fixed order
 *   - hold scroll, pointer and lifecycle state
 *   - drive one frame: smooth the inputs, move the camera, update each zone
 *   - expose a small control surface to js/app.js
 */

import * as THREE from "three";
import { createStage } from "./experience/stage.js";
import { createPostChain } from "./experience/post.js";
import { createCameraRig } from "./experience/camera-rig.js";
import { createRegistry } from "./experience/registry.js";
import { createPathCurve } from "./experience/world.js";
import { buildGround } from "./experience/scenery.js";
import { buildSignal, buildDots } from "./experience/signal.js";
import { buildTrucks } from "./experience/traffic.js";
import { enhanceWithModels } from "./experience/model-kit.js";
import { buildDistrict } from "./experience/zones/district.js";
import { buildPlant } from "./experience/zones/plant.js";
import { buildEvalGrid } from "./experience/zones/eval-grid.js";
import { buildStation } from "./experience/zones/station.js";

/** How much of the gap to scroll target each frame closes; lower is heavier. */
const PROGRESS_LERP = 0.055;

/** Pointer parallax is smoothed harder than scroll so it never feels twitchy. */
const MOUSE_LERP = 0.06;

/**
 * Creates the scroll-driven WebGL experience.
 *
 * @param {HTMLCanvasElement} canvas Canvas to render into.
 * @returns {{
 *   update: (elapsed: number) => void,
 *   resize: () => void,
 *   setProgress: (v: number) => void,
 *   setPaused: (v: boolean) => void,
 *   setReduced: (v: boolean) => void,
 *   renderer: THREE.WebGLRenderer
 * } | null} Control surface, or null if WebGL is unavailable.
 */
export function createExperience(canvas) {
  let stage;
  try {
    stage = createStage(canvas);
  } catch {
    return null;
  }
  const { scene, camera, sun, renderer } = stage;

  // Deterministic rng (Lehmer, seeded once) so the diorama is identical between
  // visits. Every builder draws from this one sequence, so the call order below
  // is load bearing.
  let rngState = 4242;
  const rng = () => {
    rngState = (rngState * 16807) % 2147483647;
    return (rngState - 1) / 2147483646;
  };

  const curve = createPathCurve();
  const registry = createRegistry();

  buildGround(scene, rng);
  const district = buildDistrict(scene, curve, rng, registry);
  const plant = buildPlant(scene, rng, registry);
  const evalGrid = buildEvalGrid(scene, curve, rng);
  const station = buildStation(scene, rng, registry);
  const signal = buildSignal(scene, curve);
  const dots = buildDots(scene, curve);
  const trucks = buildTrucks(scene, curve, registry);
  enhanceWithModels(scene, registry).catch((e) =>
    console.warn("Kenney models unavailable, keeping primitives:", e?.message || e)
  );

  const post = createPostChain(stage);
  const rig = createCameraRig({ curve, camera, sun });

  const state = {
    progress: 0,
    targetProgress: 0,
    mouse: new THREE.Vector2(),
    mouseTarget: new THREE.Vector2(),
    paused: false,
    reduced: false,
  };

  window.addEventListener("pointermove", (e) => {
    state.mouseTarget.set(
      (e.clientX / window.innerWidth) * 2 - 1,
      (e.clientY / window.innerHeight) * 2 - 1
    );
  });

  /**
   * Advances and renders one frame.
   *
   * @param {number} elapsed Seconds since the ticker started.
   * @returns {void}
   */
  function update(elapsed) {
    if (state.paused) return;

    // Reduced motion snaps to the scroll position instead of easing into it.
    const lerpAmt = state.reduced ? 1 : PROGRESS_LERP;
    state.progress += (state.targetProgress - state.progress) * lerpAmt;
    state.mouse.lerp(state.mouseTarget, MOUSE_LERP);

    const progress = THREE.MathUtils.clamp(state.progress, 0, 1);
    const head = rig.update(elapsed, progress, state.mouse);

    signal.uniforms.uHead.value = head;
    signal.uniforms.uTime.value = elapsed;
    signal.bead.position.copy(rig.headPos);
    signal.bead.position.y = 0.32 + Math.sin(elapsed * 4.4) * 0.05;
    signal.glow.position.set(rig.headPos.x, 0.09, rig.headPos.z);
    signal.glow.scale.setScalar(1 + Math.sin(elapsed * 3.6) * 0.12);
    // At the end the bead settles onto the docking pad like a beacon, so the
    // ground glow fades back rather than washing out the arrival.
    const arrive = THREE.MathUtils.smoothstep(progress, 0.97, 1);
    signal.glow.material.opacity = 1 - arrive * 0.6;

    dots.mat.uniforms.uHead.value = head;

    district.update(elapsed);
    plant.update(elapsed);
    evalGrid.update(elapsed, head);
    station.update(elapsed);
    trucks.update(elapsed);

    post.render();
  }

  /**
   * Matches the renderer, camera and post chain to the current viewport.
   *
   * @returns {void}
   */
  function resize() {
    stage.resize();
    post.resize();
  }
  window.addEventListener("resize", resize);

  return {
    update,
    resize,
    setProgress(v) {
      state.targetProgress = v;
    },
    setPaused(v) {
      state.paused = v;
    },
    setReduced(v) {
      state.reduced = v;
    },
    renderer,
  };
}
