/* Copyright (c) 2026 QuarkX Sdn. Bhd. (202501056786 / 1658192-K). All rights reserved. */

/*
 * Zone 03: the eval grid.
 *
 * Responsibilities:
 *   - a field of tiles laid on a regular grid, thinned near the road
 *   - the wake animation that lifts tiles as the signal passes over them
 */

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { PALETTE } from "../world.js";
import { clayMat } from "../materials.js";
import { buildFigures } from "../scenery.js";

/**
 * Builds the eval grid and adds it to the scene.
 *
 * Each tile stores its own position along the path so the wake can be evaluated
 * per tile against the signal head without another nearest-point search.
 *
 * @param {THREE.Scene} scene Scene to populate.
 * @param {THREE.Curve<THREE.Vector3>} curve Ground path, used to keep the road clear.
 * @param {() => number} rng Deterministic random source.
 * @returns {{update: (elapsed: number, head: number) => void}} Per-frame updater,
 *   where `head` is the signal head as a fraction of the path.
 */
export function buildEvalGrid(scene, curve, rng) {
  const tileGeo = new RoundedBoxGeometry(4.0, 0.5, 4.0, 2, 0.16);
  tileGeo.translate(0, 0.25, 0);
  const fine = curve.getSpacedPoints(1200);
  const nearestU = (x, z) => {
    let best = 0;
    let bd = 1e9;
    fine.forEach((p, i) => {
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bd) {
        bd = d;
        best = i / (fine.length - 1);
      }
    });
    return { u: best, d: Math.sqrt(bd) };
  };

  const tiles = [];
  const spacing = 5.4;
  for (let cx = 0; cx < 10; cx++) {
    for (let cz = 0; cz < 9; cz++) {
      const x = -48 + cx * spacing + (rng() - 0.5) * 0.2;
      const z = -198 + cz * spacing + (rng() - 0.5) * 0.2;
      const { u, d } = nearestU(x, z);
      if (d < 3.2) continue; // leave the road clear
      if (d > 34 || rng() < 0.16) continue;
      tiles.push({
        x,
        z,
        u,
        d,
        coral: rng() < 0.06,
        stack: rng() < 0.05 ? 1 + Math.floor(rng() * 2) : 0,
      });
    }
  }

  const mesh = new THREE.InstancedMesh(tileGeo, clayMat(PALETTE.white, 0.9), tiles.length);
  mesh.castShadow = mesh.receiveShadow = true;
  const m = new THREE.Matrix4();
  const col = new THREE.Color();
  tiles.forEach((tile, i) => {
    m.makeTranslation(tile.x, 0, tile.z);
    mesh.setMatrixAt(i, m);
    col.set(tile.coral ? PALETTE.coral : rng() < 0.7 ? PALETTE.ivory : PALETTE.clay);
    mesh.setColorAt(i, col);
  });
  scene.add(mesh);

  const stacks = [];
  tiles.forEach((tile) => {
    for (let s = 0; s < tile.stack; s++) {
      stacks.push([tile.x, (s + 1) * 0.55, tile.z]);
    }
  });
  const stackMesh = new THREE.InstancedMesh(tileGeo, clayMat(PALETTE.ivory, 0.9), stacks.length);
  stackMesh.castShadow = true;
  stacks.forEach(([x, y, z], i) => {
    m.makeTranslation(x, y, z);
    stackMesh.setMatrixAt(i, m);
  });
  scene.add(stackMesh);

  buildFigures(scene, [[-18, -172], [-30, -188]], rng);

  return {
    update(t, head) {
      // Tiles breathe up as the signal passes: a narrow gaussian on distance
      // along the path, attenuated by how far the tile sits off the road, plus
      // a slow idle wobble so the field is never completely still.
      for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i];
        const wake = Math.exp(-(((tile.u - head) * 12) ** 2)) * (1 - tile.d / 36);
        const lift = wake * 1.0 + Math.sin(t * 0.8 + tile.x * 0.4 + tile.z * 0.3) * 0.05;
        m.makeTranslation(tile.x, lift, tile.z);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
