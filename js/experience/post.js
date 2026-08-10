/* Copyright (c) 2026 QuarkX Sdn. Bhd. (202501056786 / 1658192-K). All rights reserved. */

/*
 * Post-processing chain.
 *
 * Attached after the world is built, so the passes are constructed against a
 * finished scene.
 *
 * Responsibilities:
 *   - the pass order: render, ambient occlusion, tilt-shift, output
 *   - adaptive quality: shedding the AO pass on machines that cannot keep up
 *   - keeping pass render targets in step with the viewport
 */

import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { TiltShiftShader } from "./tilt-shift.js";

/** Frames sampled before deciding whether this machine can afford the AO pass. */
const ADAPTIVE_WINDOW = 240;

/** A frame slower than this counts against the AO budget (roughly below 38fps). */
const SLOW_FRAME_MS = 26;

/**
 * Builds the post chain for a stage and returns its frame and resize hooks.
 *
 * @param {ReturnType<import("./stage.js").createStage>} stage Stage to render.
 * @returns {{render: () => void, resize: () => void}} Post chain handle.
 */
export function createPostChain(stage) {
  const { renderer, scene, camera, dpr, isMobile, flags } = stage;

  // AO grounds the clay, tilt-shift sells the miniature.
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(dpr);
  composer.addPass(new RenderPass(scene, camera));

  let gtao = null;
  if (!isMobile && !flags.has("noao")) {
    // AO runs at half resolution: the soft clay surfaces hide the difference
    // completely and it is the most expensive pass in the chain.
    gtao = new GTAOPass(
      scene,
      camera,
      Math.floor(window.innerWidth / 2),
      Math.floor(window.innerHeight / 2)
    );
    gtao.updateGtaoMaterial({
      radius: 0.55,
      distanceExponent: 1.6,
      thickness: 1.2,
      scale: 1.5,
      samples: 8,
    });
    composer.addPass(gtao);
  }

  const tilt = new ShaderPass(TiltShiftShader);
  tilt.uniforms.uResolution.value.set(
    window.innerWidth * dpr,
    window.innerHeight * dpr
  );
  if (!flags.has("notilt")) composer.addPass(tilt);
  composer.addPass(new OutputPass());
  if (gtao) gtao.setSize(Math.floor(window.innerWidth / 2), Math.floor(window.innerHeight / 2));

  let frameCount = 0;
  let slowFrames = 0;
  let lastNow = 0;

  function render() {
    // Adaptive quality: if most of the first few hundred frames run slow, drop
    // the AO pass for good rather than letting the scroll stutter.
    const now = performance.now();
    if (lastNow && gtao && frameCount < ADAPTIVE_WINDOW) {
      frameCount++;
      if (now - lastNow > SLOW_FRAME_MS) slowFrames++;
      if (frameCount === ADAPTIVE_WINDOW && slowFrames > ADAPTIVE_WINDOW / 2) {
        composer.removePass(gtao);
        gtao.dispose?.();
        gtao = null;
      }
    }
    lastNow = now;

    if (flags.has("direct")) renderer.render(scene, camera);
    else composer.render();
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    composer.setSize(w, h);
    if (gtao) gtao.setSize(Math.floor(w / 2), Math.floor(h / 2));
    tilt.uniforms.uResolution.value.set(w * dpr, h * dpr);
  }

  return { render, resize };
}
