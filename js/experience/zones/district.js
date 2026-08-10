/* Copyright (c) 2026 QuarkX Sdn. Bhd. (202501056786 / 1658192-K). All rights reserved. */

/*
 * Zone 01: the district grid, the town the journey opens on.
 *
 * Responsibilities:
 *   - procedural block layout that thins out away from the town centre
 *   - tiered towers, window bands and rooftop units
 *   - the wind farm east of town and the crate yard at its edge
 */

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { PALETTE, PLAZA } from "../world.js";
import { clayMat, shadowed } from "../materials.js";
import { box, crateStack } from "../primitives.js";
import { buildFigures, buildWindowStrips } from "../scenery.js";

/**
 * Builds the district grid and adds it to the scene.
 *
 * @param {THREE.Scene} scene Scene to populate.
 * @param {THREE.Curve<THREE.Vector3>} curve Ground path, used to keep the road clear.
 * @param {() => number} rng Deterministic random source.
 * @param {ReturnType<import("../registry.js").createRegistry>} registry Swap registry
 *   the model kit later reads to replace stand-ins with loaded models.
 * @returns {{update: (elapsed: number) => void}} Per-frame updater for the turbines.
 */
export function buildDistrict(scene, curve, rng, registry) {
  const samples = curve.getPoints(240);
  const distToPath = (x, z) => {
    let min = 1e9;
    for (const s of samples) {
      const d = (s.x - x) ** 2 + (s.z - z) ** 2;
      if (d < min) min = d;
    }
    return Math.sqrt(min);
  };

  const blockGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.045);
  blockGeo.translate(0, 0.5, 0);
  const placements = [];
  const towers = [];
  const cell = 7.4;
  for (let gx = -6; gx <= 6; gx++) {
    for (let gz = -11; gz <= 4; gz++) {
      const x = gx * cell + (rng() - 0.5) * 2.4;
      const z = gz * cell + (rng() - 0.5) * 2.4;
      if (z < -64 || x < -40) continue;
      if (
        Math.abs(x - PLAZA.x) < PLAZA.w / 2 + 2 &&
        Math.abs(z - PLAZA.z) < PLAZA.d / 2 + 2
      )
        continue;
      const d = distToPath(x, z);
      // Density falls off away from the town centre so the cluster reads as one
      // compact diorama with calm ground around it.
      const centreDist = Math.hypot(x - 2, z + 28);
      if (d < 4.8 || rng() < 0.2 + centreDist / 75) continue;
      const w = 2.8 + rng() * 2.6;
      const dep = 2.8 + rng() * 2.6;
      if (rng() < 0.16) {
        towers.push({ x, z, w: Math.max(w, 3.4), d: Math.max(dep, 3.4), h: 8 + rng() * 7 });
      } else {
        placements.push({ x, z, w, d: dep, h: 1.5 + rng() * 3.4 });
      }
    }
  }

  const city = new THREE.InstancedMesh(blockGeo, clayMat(PALETTE.white), placements.length);
  city.castShadow = city.receiveShadow = true;
  const m = new THREE.Matrix4();
  const col = new THREE.Color();
  placements.forEach((p, i) => {
    m.makeScale(p.w, p.h, p.d).setPosition(p.x, 0, p.z);
    city.setMatrixAt(i, m);
    const pick = rng();
    col.set(pick < 0.55 ? PALETTE.ivory : pick < 0.85 ? PALETTE.clay : PALETTE.clayDeep);
    col.multiplyScalar(0.97 + rng() * 0.06);
    city.setColorAt(i, col);
  });
  scene.add(city);
  registry.cityBlocks = { mesh: city, placements };

  // Tiered towers with floor ledges. Swapped for Kenney models once they load.
  towers.forEach((tw) => {
    const g = new THREE.Group();
    const baseH = tw.h * 0.55;
    const topH = tw.h * 0.45;
    g.add(box(tw.w, baseH, tw.d, rng() < 0.5 ? PALETTE.ivory : PALETTE.clay, 0.05));
    const ledge = box(tw.w * 1.06, 0.28, tw.d * 1.06, PALETTE.clayDeep, 0.04);
    ledge.position.y = baseH;
    g.add(ledge);
    const top = box(tw.w * 0.78, topH, tw.d * 0.78, PALETTE.ivory, 0.05);
    top.position.y = baseH + 0.28;
    g.add(top);
    const unit = box(tw.w * 0.26, 0.5, tw.d * 0.26, PALETTE.slate, 0.04);
    unit.position.set(tw.w * 0.12, baseH + 0.28 + topH, -tw.d * 0.1);
    g.add(unit);
    if (rng() < 0.3) {
      const crown = box(tw.w * 0.6, 0.24, tw.d * 0.6, PALETTE.coral, 0.04);
      crown.position.y = baseH + 0.28 + topH;
      g.add(crown);
    }
    g.position.set(tw.x, 0, tw.z);
    g.rotation.y = (rng() - 0.5) * 0.15;
    scene.add(g);
    registry.towers.push({ group: g, spec: tw });
  });

  const strips = [];
  placements.forEach((p) => {
    if (p.h < 2.2 || rng() > 0.65) return;
    const n = 1 + Math.floor(rng() * 2);
    for (let k = 0; k < n; k++) {
      const onX = rng() < 0.5;
      const sideSign = rng() < 0.5 ? 1 : -1;
      const off = (rng() - 0.5) * 0.45;
      strips.push({
        x: onX ? p.x + (p.w / 2 + 0.03) * sideSign : p.x + off * p.w,
        y: p.h * (0.3 + rng() * 0.25),
        z: onX ? p.z + off * p.d : p.z + (p.d / 2 + 0.03) * sideSign,
        w: 0.42 + rng() * 0.3,
        h: p.h * (0.45 + rng() * 0.25),
        ry: onX ? Math.PI / 2 : 0,
      });
    }
  });
  towers.forEach((tw) => {
    for (let k = 0; k < 3; k++) {
      const onX = k % 2 === 0;
      const sideSign = k === 1 ? -1 : 1;
      const off = -0.3 + k * 0.3;
      strips.push({
        x: onX ? tw.x + (tw.w / 2 + 0.03) * sideSign : tw.x + off * tw.w * 0.6,
        y: tw.h * 0.32,
        z: onX ? tw.z + off * tw.d * 0.6 : tw.z + (tw.d / 2 + 0.03) * sideSign,
        w: 0.5,
        h: tw.h * 0.5,
        ry: onX ? Math.PI / 2 : 0,
      });
    }
  });
  buildWindowStrips(scene, strips);

  const unitGeo = new RoundedBoxGeometry(1, 1, 1, 1, 0.04);
  unitGeo.translate(0, 0.5, 0);
  const units = [];
  placements.forEach((p) => {
    if (p.h > 2 && rng() < 0.6) {
      units.push({
        x: p.x + (rng() - 0.5) * p.w * 0.4,
        z: p.z + (rng() - 0.5) * p.d * 0.4,
        y: p.h,
        s: 0.5 + rng() * 0.7,
      });
    }
  });
  const unitMesh = new THREE.InstancedMesh(unitGeo, clayMat(PALETTE.slate), units.length);
  unitMesh.castShadow = true;
  units.forEach((u, i) => {
    m.makeScale(u.s, u.s * 0.6, u.s).setPosition(u.x, u.y, u.z);
    unitMesh.setMatrixAt(i, m);
  });
  scene.add(unitMesh);

  const crates = crateStack(4, 3, 2, PALETTE.ivory, rng);
  crates.position.set(-34, 0, 8);
  crates.rotation.y = 0.3;
  scene.add(crates);

  const turbines = [];
  const mastGeo = new THREE.CylinderGeometry(0.09, 0.18, 8.5, 10);
  mastGeo.translate(0, 4.25, 0);
  const bladeGeo = new RoundedBoxGeometry(0.14, 3.0, 0.05, 1, 0.02);
  bladeGeo.translate(0, 1.6, 0);
  [
    [34, -6],
    [40, -16],
    [33, -28],
    [41, -38],
    [35, -50],
  ].forEach(([x, z], ti) => {
    const t = new THREE.Group();
    t.add(shadowed(new THREE.Mesh(mastGeo, clayMat(PALETTE.ivory))));
    const nacelle = shadowed(
      new THREE.Mesh(
        new RoundedBoxGeometry(0.42, 0.3, 0.7, 1, 0.04),
        clayMat(PALETTE.slate)
      )
    );
    nacelle.position.set(0, 8.5, 0.08);
    t.add(nacelle);
    const rotor = new THREE.Group();
    for (let b = 0; b < 3; b++) {
      const blade = shadowed(new THREE.Mesh(bladeGeo, clayMat(PALETTE.white)));
      blade.rotation.z = (b / 3) * Math.PI * 2;
      rotor.add(blade);
    }
    rotor.position.set(0, 8.5, 0.48);
    t.add(rotor);
    t.position.set(x, 0, z);
    t.rotation.y = -0.9;
    // Three speeds cycled across the row so neighbouring rotors never lock into
    // the same phase, which would read as a single rigid mechanism.
    turbines.push({ rotor, speed: 0.55 + (ti % 3) * 0.16, phase: ti * 1.3 });
    scene.add(t);
  });

  buildFigures(
    scene,
    [
      [-8.5, -4],
      [9, -22],
      [-11, -33],
      [3, 10],
    ],
    rng
  );

  return {
    update(t) {
      turbines.forEach((tb) => {
        tb.rotor.rotation.z = t * tb.speed + tb.phase;
      });
    },
  };
}
