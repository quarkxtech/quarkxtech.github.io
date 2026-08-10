/* Copyright (c) 2026 QuarkX Sdn. Bhd. (202501056786 / 1658192-K). All rights reserved. */

/*
 * Scroll choreography: where the camera and the sun are, for a given progress.
 *
 * This is the one place that turns scroll progress into a shot. It owns the
 * hero framing, the glide along the path, the arrival orbit at the edge station
 * and the sideways offset that keeps the diorama clear of the text column.
 */

import * as THREE from "three";
import { CORE_POS, MOBILE_BREAKPOINT } from "./world.js";

/**
 * The camera stops short of the very end of the curve so the station is seen
 * from in front rather than from directly overhead.
 */
const PATH_END = 0.96;

/** The signal head runs slightly ahead of the camera, so it arrives on screen. */
const HEAD_LEAD = 0.045;

/**
 * Creates the camera rig.
 *
 * @param {object} deps Rig dependencies.
 * @param {THREE.Curve<THREE.Vector3>} deps.curve Ground path to glide along.
 * @param {THREE.PerspectiveCamera} deps.camera Camera to drive.
 * @param {THREE.DirectionalLight} deps.sun Key light, kept over the camera focus.
 * @returns {{headPos: THREE.Vector3, update: (elapsed: number, progress: number, mouse: THREE.Vector2) => number}}
 *   Rig handle. `headPos` is the signal head's world position, rewritten each update.
 */
export function createCameraRig({ curve, camera, sun }) {
  const focus = new THREE.Vector3();
  const headPos = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const lookPos = new THREE.Vector3();
  const tangent = new THREE.Vector3();

  /**
   * Places the camera and the sun for one frame.
   *
   * @param {number} elapsed Seconds since start, for the idle drift.
   * @param {number} progress Scroll progress through the journey, 0 to 1.
   * @param {THREE.Vector2} mouse Smoothed pointer position in clip space.
   * @returns {number} Signal head position along the path, 0 to 1.
   */
  function update(elapsed, progress, mouse) {
    const pathU = Math.min(progress * PATH_END, PATH_END);
    const headU = Math.min(pathU + HEAD_LEAD, 0.999);

    const heroAmt = 1 - THREE.MathUtils.smoothstep(progress, 0, 0.06);
    const endAmt = THREE.MathUtils.smoothstep(progress, 0.95, 1);

    curve.getPointAt(pathU, focus);
    curve.getTangentAt(pathU, tangent);
    curve.getPointAt(headU, headPos);

    // World-fixed azimuth with one slow, even drift across the whole journey.
    // Deliberately not coupled to the path tangent: coupling makes the camera
    // whip-turn every time the road bends.
    const az =
      -0.78 +
      pathU * 1.05 +
      Math.sin(elapsed * 0.1) * 0.03 * heroAmt +
      mouse.x * 0.05;
    const radius = 38 + heroAmt * 10 - endAmt * 16;
    const height = 62 + heroAmt * 20 - endAmt * 30 - mouse.y * 2.4;

    camPos.set(
      focus.x + Math.sin(az) * radius,
      height,
      focus.z + Math.cos(az) * radius
    );

    lookPos.copy(focus).addScaledVector(tangent, 7);
    // During the hero, tilt up so the town settles into the lower frame.
    lookPos.y += heroAmt * 8;
    lookPos.lerp(CORE_POS, endAmt);

    if (endAmt > 0) {
      const oa = az + elapsed * 0.05 * endAmt;
      camPos.x = THREE.MathUtils.lerp(camPos.x, CORE_POS.x + Math.sin(oa) * 25, endAmt);
      camPos.z = THREE.MathUtils.lerp(camPos.z, CORE_POS.z + Math.cos(oa) * 25, endAmt);
    }

    // Keep the diorama clear of the text column: shift the look target screen
    // left so the scene composes into the right two thirds.
    if (window.innerWidth > MOBILE_BREAKPOINT) {
      const dirX = lookPos.x - camPos.x;
      const dirZ = lookPos.z - camPos.z;
      const len = Math.hypot(dirX, dirZ) || 1;
      // Camera-right on the ground plane is (-dirZ, dirX) / len.
      const shift = -(7 + heroAmt * 2.5) * (1 - endAmt * 0.6);
      lookPos.x += (-dirZ / len) * shift;
      lookPos.z += (dirX / len) * shift;
    }

    camera.position.copy(camPos);
    camera.lookAt(lookPos);

    sun.position.set(focus.x + 34, 50, focus.z + 24);
    sun.target.position.copy(focus);

    return headU;
  }

  return { headPos, update };
}
