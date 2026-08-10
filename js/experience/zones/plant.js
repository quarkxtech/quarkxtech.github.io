/* Copyright (c) 2026 QuarkX Sdn. Bhd. (202501056786 / 1658192-K). All rights reserved. */

/*
 * Zone 02: the plant works.
 *
 * Responsibilities:
 *   - hyperboloid cooling towers, sawtooth hall and warehouse rows
 *   - crate yards, cabinet rows, tank machine and water tower
 *   - collecting every steam emitter in the zone into one particle system
 */

import * as THREE from "three";
import { PALETTE } from "../world.js";
import { clayMat, shadowed } from "../materials.js";
import {
  gableShed,
  sawtoothHall,
  crateStack,
  cabinetRows,
  tankMachine,
  chimneyFactory,
} from "../primitives.js";
import { buildFigures, buildSteam } from "../scenery.js";

/**
 * Builds the plant works and adds it to the scene.
 *
 * @param {THREE.Scene} scene Scene to populate.
 * @param {() => number} rng Deterministic random source.
 * @param {ReturnType<import("../registry.js").createRegistry>} registry Swap registry
 *   the model kit later reads to replace stand-ins with loaded models.
 * @returns {{update: (elapsed: number) => void}} Per-frame updater for the steam.
 */
export function buildPlant(scene, rng, registry) {
  const group = new THREE.Group();
  const emitters = [];

  // Hyperboloid cooling towers: the waist sits at 62% of the height, and the
  // flare above it is softened so the silhouette stays clay rather than sharp.
  const prof = [];
  for (let i = 0; i <= 22; i++) {
    const t = i / 22;
    const k = t < 0.62 ? 0.8 : 0.45;
    const r = 2.1 * Math.sqrt(1 + ((t - 0.62) / 0.32) ** 2 * k);
    prof.push(new THREE.Vector2(r, t * 13));
  }
  const towerGeo = new THREE.LatheGeometry(prof, 44);
  [
    [46, -78, 1],
    [53, -90, 1.12],
  ].forEach(([x, z, s]) => {
    const t = shadowed(new THREE.Mesh(towerGeo, clayMat(PALETTE.ivory)));
    t.position.set(x, 0, z);
    t.scale.setScalar(s);
    group.add(t);
    emitters.push([x, 13.2 * s, z]);
  });

  const hall = sawtoothHall(15, 3.6, 1.5, 4, 9.5, PALETTE.ivory);
  hall.position.set(34, 0, -106);
  hall.rotation.y = 0.45;
  group.add(hall);

  [
    [18, -84, 0.45, PALETTE.ivory],
    [24, -78, 0.45, PALETTE.clay],
    [44, -116, 0.5, PALETTE.ivory],
    [50, -110, 0.5, PALETTE.clay],
    [56, -104, 0.5, PALETTE.ivory],
    [20, -118, -0.2, PALETTE.ivory],
  ].forEach(([x, z, rot, c]) => {
    const shed = gableShed(3.6, 1.8, 1.1, 6.4, c, rng() < 0.4 ? PALETTE.coral : null);
    shed.position.set(x, 0, z);
    shed.rotation.y = rot;
    group.add(shed);
  });

  const crates = crateStack(4, 3, 2, PALETTE.ivory, rng);
  crates.position.set(28, 0, -68);
  crates.rotation.y = 0.45;
  group.add(crates);

  const cabs = cabinetRows(7, 2, rng);
  cabs.position.set(12, 0, -98);
  cabs.rotation.y = 0.45;
  group.add(cabs);

  const tank = tankMachine();
  tank.position.set(24, 0, -103);
  tank.rotation.y = -0.5;
  group.add(tank);

  [
    [62, -122, -0.4],
    [68, -112, -0.4],
  ].forEach(([x, z, rot]) => {
    const f = chimneyFactory();
    f.position.set(x, 0, z);
    f.rotation.y = rot;
    // Emitters are recorded in local space, so rotate them into world space
    // before handing them to the shared steam system.
    f.userData.emitters.forEach(([ex, ey, ez]) => {
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      emitters.push([x + ex * cos + ez * sin, ey, z - ex * sin + ez * cos]);
    });
    group.add(f);
    registry.chimneys.push({ group: f, x, z, rot });
  });

  registry.plantSpots.push(
    { name: "building-g", x: 14, z: -86, rot: 0.45, h: 5.5 },
    { name: "detail-tank", x: 30, z: -94, rot: -0.5, h: 4.2 },
    { name: "building-n", x: 38, z: -122, rot: 0.5, h: 5 }
  );

  const waterTower = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const leg = shadowed(
      new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 3.2, 8),
        clayMat(PALETTE.slate)
      )
    );
    leg.position.set(
      Math.cos((i / 4) * Math.PI * 2 + 0.6) * 0.85,
      1.6,
      Math.sin((i / 4) * Math.PI * 2 + 0.6) * 0.85
    );
    waterTower.add(leg);
  }
  const wtank = shadowed(
    new THREE.Mesh(new THREE.CapsuleGeometry(1.1, 0.9, 8, 18), clayMat(PALETTE.ivory))
  );
  wtank.position.y = 3.9;
  waterTower.add(wtank);
  waterTower.position.set(10, 0, -78);
  group.add(waterTower);

  buildFigures(
    scene,
    [
      [19, -94],
      [20.5, -95.5],
      [22, -94.4],
      [21, -92.6],
      [18, -96.8],
      [30, -99],
      [40, -100],
      [47, -107],
    ],
    rng
  );

  const steam = buildSteam(scene, emitters, rng);

  scene.add(group);
  return {
    update(t) {
      steam.mat.uniforms.uTime.value = t;
    },
  };
}
