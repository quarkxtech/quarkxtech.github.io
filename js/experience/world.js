/* Copyright (c) 2026 QuarkX Sdn. Bhd. (202501056786 / 1658192-K). All rights reserved. */

/*
 * Shared vocabulary of the paper diorama.
 *
 * Responsibilities:
 *   - the clay colour palette every material is mixed from
 *   - the fixed world anchors that zones are positioned against
 *   - the ground path that the signal, the traffic and the camera all follow
 */

import * as THREE from "three";

/** Clay tones of the diorama, in the warm Claude range. */
export const PALETTE = {
  paper: 0xf0e7da,
  ground: 0xede2d0,
  ivory: 0xf8f1e6,
  clay: 0xeaddc8,
  clayDeep: 0xddcdb4,
  slate: 0xcfc0a9,
  coral: 0xd97757,
  coralHot: 0xff8a5c,
  coralDeep: 0xc05f3a,
  white: 0xffffff,
};

/** Centre of the edge station, where the journey ends. */
export const CORE_POS = new THREE.Vector3(0, 0, -276);

/** Market plaza footprint; procedural district blocks stay clear of it. */
export const PLAZA = { x: -25, z: 7, w: 15, d: 12, rot: 0.18 };

/**
 * Viewport width below which the layout is single column. Kept in step with the
 * 880px breakpoint in css/style.css: below it there is no side text column to
 * compose the diorama around, and no headroom for the ambient occlusion pass.
 */
export const MOBILE_BREAKPOINT = 880;

/**
 * Builds the ground path the whole journey is scrubbed along.
 *
 * Control points are hand placed so the route sweeps past each zone in turn
 * and lands on the docking pad at the edge station.
 *
 * @returns {THREE.CatmullRomCurve3} Open curve on the ground plane (y = 0).
 */
export function createPathCurve() {
  const pts = [
    [0, 26],
    [0, 6],
    [-7, -16],
    [6, -38],
    [16, -62],
    [30, -88],
    [26, -112],
    [4, -136],
    [-16, -160],
    [-22, -184],
    [-10, -212],
    [0, -240],
    [0, -263.5],
  ].map(([x, z]) => new THREE.Vector3(x, 0, z));
  return new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.35);
}
