/* Copyright (c) 2026 QuarkX Sdn. Bhd. (202501056786 / 1658192-K). All rights reserved. */

/*
 * Reusable building blocks of the diorama.
 *
 * Each function here is a constructor for one kind of clay object. None of them
 * touch the scene graph: they return a mesh or a group and let the calling zone
 * decide where it goes.
 *
 * Responsibilities:
 *   - rounded box shell used by nearly every structure
 *   - extruded building profiles (gabled sheds, sawtooth halls, chimney works)
 *   - instanced clusters (crate stacks, cabinet rows)
 *   - the horizontal tank machine
 */

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { PALETTE } from "./world.js";
import { clayMat, shadowed } from "./materials.js";

/**
 * Creates a rounded box that sits on the ground plane.
 *
 * Geometry is translated up by half its height so callers position by footprint
 * rather than by centre, which keeps every zone's coordinates readable.
 *
 * @param {number} w Width.
 * @param {number} h Height.
 * @param {number} d Depth.
 * @param {number|THREE.Color} color Clay tone.
 * @param {number} [r=0.05] Corner radius, clamped so thin boxes stay valid.
 * @returns {THREE.Mesh} Shadowed mesh with its base at y = 0.
 */
export function box(w, h, d, color, r = 0.05) {
  const geo = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) / 3));
  geo.translate(0, h / 2, 0);
  return shadowed(new THREE.Mesh(geo, clayMat(color)));
}

/**
 * Creates a gabled warehouse: a crisp extruded house profile.
 *
 * @param {number} w Width across the gable.
 * @param {number} wallH Wall height at the eaves.
 * @param {number} ridgeH Extra height from eaves to ridge.
 * @param {number} len Depth of the extrusion.
 * @param {number|THREE.Color} color Wall tone.
 * @param {number|THREE.Color|null} roofColor Roof tone, or null for no separate roof.
 * @returns {THREE.Group} Shed positioned with its base at y = 0.
 */
export function gableShed(w, wallH, ridgeH, len, color, roofColor) {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(-w / 2, wallH);
  shape.lineTo(0, wallH + ridgeH);
  shape.lineTo(w / 2, wallH);
  shape.lineTo(w / 2, 0);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false });
  geo.translate(0, 0, -len / 2);
  g.add(shadowed(new THREE.Mesh(geo, clayMat(color))));

  // A plane just proud of the gable end reads as a recessed door under the
  // soft lighting, which is cheaper than modelling an actual recess.
  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.3, wallH * 0.66),
    new THREE.MeshStandardMaterial({ color: 0xc2b094, roughness: 0.75 })
  );
  door.position.set(0, wallH * 0.33, len / 2 + 0.03);
  g.add(door);
  if (roofColor) {
    const roofShape = new THREE.Shape();
    const o = 0.16;
    roofShape.moveTo(-w / 2 - o, wallH - 0.1);
    roofShape.lineTo(0, wallH + ridgeH + o * 0.6);
    roofShape.lineTo(w / 2 + o, wallH - 0.1);
    roofShape.lineTo(w / 2 + o - 0.34, wallH - 0.1);
    roofShape.lineTo(0, wallH + ridgeH - 0.28);
    roofShape.lineTo(-w / 2 - o + 0.34, wallH - 0.1);
    roofShape.closePath();
    const roofGeo = new THREE.ExtrudeGeometry(roofShape, {
      depth: len + 0.3,
      bevelEnabled: false,
    });
    roofGeo.translate(0, 0, -(len + 0.3) / 2);
    g.add(shadowed(new THREE.Mesh(roofGeo, clayMat(roofColor, 0.85))));
  }
  return g;
}

/**
 * Creates a sawtooth factory hall as a single extruded profile.
 *
 * @param {number} width Width across all teeth.
 * @param {number} wallH Wall height below the teeth.
 * @param {number} toothH Height of each tooth above the wall.
 * @param {number} teeth Number of teeth.
 * @param {number} len Depth of the extrusion.
 * @param {number|THREE.Color} color Clay tone.
 * @returns {THREE.Mesh} Hall positioned with its base at y = 0.
 */
export function sawtoothHall(width, wallH, toothH, teeth, len, color) {
  const shape = new THREE.Shape();
  const tw = width / teeth;
  shape.moveTo(-width / 2, 0);
  shape.lineTo(-width / 2, wallH);
  for (let i = 0; i < teeth; i++) {
    const x0 = -width / 2 + i * tw;
    shape.lineTo(x0 + tw * 0.55, wallH + toothH);
    shape.lineTo(x0 + tw, wallH);
  }
  shape.lineTo(width / 2, 0);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false });
  geo.translate(0, 0, -len / 2);
  return shadowed(new THREE.Mesh(geo, clayMat(color)));
}

/**
 * Creates a container yard: a grid of small boxes stacked to random heights.
 *
 * @param {number} cols Columns in the grid.
 * @param {number} rows Rows in the grid.
 * @param {number} levels Maximum stack height.
 * @param {number|THREE.Color} color Clay tone.
 * @param {() => number} rng Deterministic random source.
 * @returns {THREE.Group} Group holding one instanced mesh.
 */
export function crateStack(cols, rows, levels, color, rng) {
  const g = new THREE.Group();
  const s = 1.0;
  const geo = new RoundedBoxGeometry(s, s * 0.85, s, 1, 0.04);
  geo.translate(0, (s * 0.85) / 2, 0);
  const spots = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const stack = rng() < 0.25 ? 0 : 1 + Math.floor(rng() * levels);
      for (let l = 0; l < stack; l++) {
        spots.push([c * (s + 0.14), l * s * 0.85, r * (s + 0.14)]);
      }
    }
  }
  const mesh = new THREE.InstancedMesh(geo, clayMat(color), spots.length);
  mesh.castShadow = mesh.receiveShadow = true;
  const m = new THREE.Matrix4();
  spots.forEach(([x, y, z], i) => {
    m.makeTranslation(x, y, z);
    mesh.setMatrixAt(i, m);
  });
  g.add(mesh);
  return g;
}

/**
 * Creates neat rows of tall thin lockers, with occasional gaps.
 *
 * @param {number} cols Lockers per row.
 * @param {number} rows Number of rows.
 * @param {() => number} rng Deterministic random source.
 * @returns {THREE.Group} Group holding one instanced mesh.
 */
export function cabinetRows(cols, rows, rng) {
  const g = new THREE.Group();
  const geo = new RoundedBoxGeometry(0.85, 1.9, 0.7, 1, 0.05);
  geo.translate(0, 0.95, 0);
  const spots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rng() < 0.12) continue;
      spots.push([c * 1.05, r * 1.7, 1.5 + rng() * 0.6]);
    }
  }
  const mesh = new THREE.InstancedMesh(geo, clayMat(PALETTE.ivory), spots.length);
  mesh.castShadow = mesh.receiveShadow = true;
  const m = new THREE.Matrix4();
  spots.forEach(([x, z, h], i) => {
    m.makeScale(1, h / 1.9, 1).setPosition(x, 0, z);
    mesh.setMatrixAt(i, m);
  });
  g.add(mesh);
  return g;
}

/**
 * Creates a horizontal tank machine: vessel, dome ports, pipe elbow and skid.
 *
 * @returns {THREE.Group} Machine positioned with its base at y = 0.
 */
export function tankMachine() {
  const g = new THREE.Group();
  const vessel = shadowed(
    new THREE.Mesh(new THREE.CapsuleGeometry(1.5, 5, 8, 20), clayMat(PALETTE.ivory))
  );
  vessel.rotation.z = Math.PI / 2;
  vessel.position.y = 1.8;
  g.add(vessel);
  for (let i = 0; i < 3; i++) {
    const dome = shadowed(
      new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 14), clayMat(PALETTE.clay))
    );
    dome.position.set(-1.6 + i * 1.6, 3.2, 0);
    g.add(dome);
  }
  const elbow = shadowed(
    new THREE.Mesh(
      new THREE.TorusGeometry(1.1, 0.38, 10, 16, Math.PI / 2),
      clayMat(PALETTE.clay)
    )
  );
  elbow.rotation.z = Math.PI;
  elbow.position.set(3.6, 1.8, 0);
  g.add(elbow);
  const spout = shadowed(
    new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 1.3, 12), clayMat(PALETTE.clay))
  );
  spout.position.set(4.7, 1.1, 0);
  g.add(spout);
  const skid = box(6.4, 0.5, 2.4, PALETTE.clayDeep, 0.06);
  g.add(skid);
  return g;
}

/**
 * Creates a chimney factory: a gabled body with two tall stacks.
 *
 * Stack tops are recorded on `userData.emitters` so the plant zone can attach
 * the shared steam system to them without re-deriving the positions.
 *
 * @returns {THREE.Group} Factory positioned with its base at y = 0.
 */
export function chimneyFactory() {
  const g = new THREE.Group();
  g.add(gableShed(4.6, 2.6, 1.2, 6, PALETTE.ivory, null));
  const emitters = [];
  for (let i = 0; i < 2; i++) {
    const stack = shadowed(
      new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.5, 5.6, 14), clayMat(PALETTE.clay))
    );
    stack.position.set(-1 + i * 2, 2.8, -1 + i * 0.6);
    g.add(stack);
    emitters.push([stack.position.x, 5.7, stack.position.z]);
  }
  g.userData.emitters = emitters;
  return g;
}
