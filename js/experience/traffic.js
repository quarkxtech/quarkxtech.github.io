/* Copyright (c) 2026 QuarkX Sdn. Bhd. (202501056786 / 1658192-K). All rights reserved. */

/*
 * Clay trucks driving the signal road.
 *
 * Responsibilities:
 *   - primitive truck stand-ins, later swapped for Kenney vehicles
 *   - per-frame placement along the path with lane offsets and facing
 */

import * as THREE from "three";
import { PALETTE } from "./world.js";
import { clayMat, shadowed } from "./materials.js";
import { box } from "./primitives.js";

/**
 * Builds the traffic on the signal road and adds it to the scene.
 *
 * @param {THREE.Scene} scene Scene to populate.
 * @param {THREE.Curve<THREE.Vector3>} curve Road the trucks follow.
 * @param {ReturnType<import("./registry.js").createRegistry>} registry Swap registry
 *   the model kit later reads to replace the primitive bodies.
 * @returns {{update: (elapsed: number) => void}} Per-frame updater.
 */
export function buildTrucks(scene, curve, registry) {
  const trucks = [];
  const makeTruck = (bodyColor) => {
    const g = new THREE.Group();
    const bed = box(0.9, 0.55, 1.7, PALETTE.ivory, 0.06);
    bed.position.y = 0.3;
    g.add(bed);
    const cab = box(0.84, 0.62, 0.62, bodyColor, 0.08);
    cab.position.set(0, 0.32, 1.05);
    g.add(cab);
    const wheelGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.12, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    [
      [-0.42, 0.6],
      [0.42, 0.6],
      [-0.42, -0.5],
      [0.42, -0.5],
    ].forEach(([x, z]) => {
      const w = shadowed(new THREE.Mesh(wheelGeo, clayMat(0x6b5d4d, 0.7)));
      w.position.set(x, 0.16, z);
      g.add(w);
    });
    scene.add(g);
    return g;
  };
  [
    { offset: 0.0, lat: 1.5, speed: 0.0045, color: PALETTE.coral },
    { offset: 0.45, lat: -1.6, speed: 0.0038, color: PALETTE.slate },
    { offset: 0.75, lat: 1.6, speed: 0.005, color: PALETTE.ivory },
  ].forEach((cfg) => {
    const entry = { ...cfg, mesh: makeTruck(cfg.color), u: cfg.offset };
    trucks.push(entry);
    registry.trucks.push(entry);
  });
  const pt = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const side = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  return {
    update(t) {
      trucks.forEach((tr) => {
        // Opposite-lane trucks genuinely travel the other way, so facing always
        // matches motion instead of needing a separate heading flip.
        const dir = tr.lat > 0 ? 1 : -1;
        tr.u = (((tr.offset + t * tr.speed * dir) % 1) + 1) % 1;
        curve.getPointAt(tr.u, pt);
        curve.getTangentAt(tr.u, tan);
        side.set(-tan.z, 0, tan.x).normalize();
        pt.addScaledVector(side, tr.lat);
        tr.mesh.position.set(pt.x, 0, pt.z);
        ahead.copy(pt).addScaledVector(tan, dir * 3);
        tr.mesh.lookAt(ahead.x, 0, ahead.z);
      });
    },
  };
}
