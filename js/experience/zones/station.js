/* Copyright (c) 2026 QuarkX Sdn. Bhd. (202501056786 / 1658192-K). All rights reserved. */

/*
 * Zone 04: the edge station, where the signal road terminates.
 *
 * Responsibilities:
 *   - approach chevrons and the docking pad the signal arrives on
 *   - the data centre pad, satellite dish and cooling units
 *   - anchor spots for the server halls, van and perimeter fence
 */

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { PALETTE, CORE_POS } from "../world.js";
import { clayMat, shadowed } from "../materials.js";
import { box } from "../primitives.js";
import { buildFigures } from "../scenery.js";

/**
 * Builds the edge station and adds it to the scene.
 *
 * @param {THREE.Scene} scene Scene to populate.
 * @param {() => number} rng Deterministic random source.
 * @param {ReturnType<import("../registry.js").createRegistry>} registry Swap registry
 *   the model kit later reads to place the loaded models.
 * @returns {{update: (elapsed: number) => void}} Per-frame updater for the dish.
 */
export function buildStation(scene, rng, registry) {
  const group = new THREE.Group();

  // Chevron road markings pointing at the platform, like an arrival arrow.
  const chevShape = new THREE.Shape();
  chevShape.moveTo(0, 0);
  chevShape.lineTo(2.6, 2.1);
  chevShape.lineTo(0, 4.2);
  chevShape.lineTo(0, 3.0);
  chevShape.lineTo(1.5, 2.1);
  chevShape.lineTo(0, 1.2);
  chevShape.closePath();
  const chevGeo = new THREE.ExtrudeGeometry(chevShape, { depth: 0.14, bevelEnabled: false });
  for (let i = 0; i < 3; i++) {
    // Flat markings receive no shadow: at this scale the sun angle would smear
    // the pad's own shadow across them and mute the coral.
    const chev = shadowed(
      new THREE.Mesh(chevGeo, clayMat(i === 0 ? PALETTE.coralDeep : PALETTE.coral, 0.85)),
      true,
      false
    );
    chev.rotation.x = -Math.PI / 2;
    chev.rotation.z = Math.PI / 2;
    chev.position.set(CORE_POS.x - 2.1, 0.02, CORE_POS.z + 18 + i * 3.4);
    group.add(chev);
  }

  const dock = new THREE.Group();
  const dockDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(1.35, 1.45, 0.08, 36),
    clayMat(PALETTE.coral, 0.8)
  );
  dockDisc.receiveShadow = true;
  dockDisc.position.y = 0.04;
  dock.add(dockDisc);
  const dockRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.1, 0.07, 8, 48),
    clayMat(PALETTE.coralDeep, 0.8)
  );
  dockRing.rotation.x = Math.PI / 2;
  dockRing.position.y = 0.05;
  dock.add(dockRing);
  dock.position.set(0, 0, -263.5);
  group.add(dock);

  const padGeo = new RoundedBoxGeometry(20, 0.22, 15, 2, 0.08);
  padGeo.translate(0, 0.11, 0);
  const pad = shadowed(new THREE.Mesh(padGeo, clayMat(PALETTE.ivory, 0.9)), false, true);
  pad.position.set(CORE_POS.x, 0, CORE_POS.z);
  group.add(pad);

  const dishProfile = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    dishProfile.push(new THREE.Vector2(t * 1.6, t * t * 0.7));
  }
  const dish = new THREE.Group();
  const bowl = shadowed(
    new THREE.Mesh(new THREE.LatheGeometry(dishProfile, 28), clayMat(PALETTE.white))
  );
  bowl.rotation.x = -0.85;
  bowl.position.y = 1.7;
  dish.add(bowl);
  dish.add(
    shadowed(
      new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.2, 1.7, 8),
        clayMat(PALETTE.slate)
      )
    )
  );
  dish.position.set(CORE_POS.x + 7.2, 0.95, CORE_POS.z - 5.4);
  group.add(dish);

  for (let i = 0; i < 3; i++) {
    const unit = box(1.5, 1.0, 1.5, PALETTE.slate, 0.06);
    unit.position.set(CORE_POS.x - 8.2, 0.22, CORE_POS.z - 4.5 + i * 2.2);
    group.add(unit);
    const grill = box(1.1, 0.12, 1.1, PALETTE.clayDeep, 0.03);
    grill.position.set(CORE_POS.x - 8.2, 1.25, CORE_POS.z - 4.5 + i * 2.2);
    group.add(grill);
  }

  // Server halls, storage tank, parked van and the perimeter fence land here
  // once the Kenney kits load.
  registry.stationSpots.push(
    { name: "building-n", x: CORE_POS.x - 3.4, z: CORE_POS.z - 2.6, rot: 0, h: 4.4, foot: 9 },
    { name: "building-e", x: CORE_POS.x + 4.6, z: CORE_POS.z + 0.8, rot: Math.PI / 2, h: 3.4, foot: 6.5 },
    { name: "detail-tank", x: CORE_POS.x + 7.6, z: CORE_POS.z + 4.2, rot: 0.4, h: 3.0, foot: 4.5 },
    { name: "van", x: CORE_POS.x - 6.2, z: CORE_POS.z + 5.6, rot: 1.25, h: 1.1, foot: 2.6 }
  );
  const fenceSegments = [];
  for (let f = 0; f < 4; f++) {
    fenceSegments.push({ x: CORE_POS.x - 10.2, z: CORE_POS.z - 6 + f * 4, rot: Math.PI / 2 });
    fenceSegments.push({ x: CORE_POS.x + 10.2, z: CORE_POS.z - 6 + f * 4, rot: Math.PI / 2 });
  }
  for (let f = 0; f < 5; f++) {
    fenceSegments.push({ x: CORE_POS.x - 8 + f * 4, z: CORE_POS.z - 7.7, rot: 0 });
    // The middle segment of the front edge is skipped: that is the gate gap
    // where the signal road arrives.
    if (f !== 2) {
      fenceSegments.push({ x: CORE_POS.x - 8 + f * 4, z: CORE_POS.z + 7.7, rot: 0 });
    }
  }
  fenceSegments.forEach((seg) =>
    registry.stationSpots.push({ name: "market-fence", ...seg, h: 0.85, foot: 4.2 })
  );

  buildFigures(
    scene,
    [[-5, -270.5], [2.5, -271.5], [CORE_POS.x + 5.5, CORE_POS.z + 6.6]],
    rng
  );

  scene.add(group);
  return {
    update(t) {
      dish.rotation.y = Math.sin(t * 0.12) * 0.7;
    },
  };
}
