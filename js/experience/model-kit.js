/* Copyright (c) 2026 QuarkX Sdn. Bhd. (202501056786 / 1658192-K). All rights reserved. */

/*
 * Kenney CC0 model integration.
 *
 * Loads the public-domain kits from assets/models, recolours every material into
 * the clay palette, and swaps out the primitive stand-ins recorded in the swap
 * registry. This runs after the first frame, so if anything fails to load the
 * primitives simply stay and the diorama is still complete.
 *
 * Responsibilities:
 *   - loading and recolouring the kits
 *   - fitting arbitrary models to a target height and footprint
 *   - swapping towers, chimneys, vehicles and blocks, then dressing the market
 *     plaza and the edge data centre
 */

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { PALETTE, PLAZA, CORE_POS } from "./world.js";
import { clayMat } from "./materials.js";

/**
 * Rewrites every material on a loaded model into the clay palette.
 *
 * Source kits use flat saturated colours, so the mapping is driven by HSL bands
 * rather than by material name. Materials are cached by uuid, and the per-material
 * jitter is hashed from that uuid so a kit recolours identically on every load
 * while still splitting its whites into more than one clay tone.
 *
 * @param {THREE.Object3D} root Loaded model root.
 * @returns {THREE.Object3D} The same root, recoloured and shadow-enabled.
 */
function recolorClay(root) {
  const cache = new Map();
  const hsl = { h: 0, s: 0, l: 0 };
  root.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    const mapped = mats.map((m) => {
      const key = m.uuid;
      if (cache.has(key)) return cache.get(key);
      const c = m.color ? m.color.clone() : new THREE.Color(0xffffff);
      c.getHSL(hsl);
      let hash = 0;
      for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
      const jitter = (Math.abs(hash) % 100) / 100;
      let target;
      if (hsl.s > 0.32 && (hsl.h < 0.13 || hsl.h > 0.93)) target = PALETTE.coral;
      else if (hsl.s > 0.32 && hsl.h > 0.2 && hsl.h < 0.45) target = 0xaaab84;
      else if (hsl.l > 0.72) target = jitter < 0.55 ? PALETTE.ivory : PALETTE.clay;
      else if (hsl.l > 0.5) target = jitter < 0.6 ? PALETTE.clay : PALETTE.clayDeep;
      else if (hsl.l > 0.3) target = PALETTE.clayDeep;
      else target = 0x9b8a73;
      const tone = new THREE.Color(target).multiplyScalar(0.95 + jitter * 0.08);
      const next = clayMat(tone.getHex(), 0.92);
      cache.set(key, next);
      return next;
    });
    node.material = Array.isArray(node.material) ? mapped : mapped[0];
  });
  return root;
}

/**
 * Scales a model to a target height and rests it on the ground, centred.
 *
 * Kits vary in scale and pivot, so both are normalised here rather than being
 * tuned per model at every call site.
 *
 * @param {THREE.Object3D} obj Model to fit; mutated in place.
 * @param {number} targetH Desired height in world units.
 * @param {number} [maxFoot=Infinity] Cap on the footprint's width and depth.
 * @returns {THREE.Object3D} The same object, fitted.
 */
function fitToHeight(obj, targetH, maxFoot = Infinity) {
  const bbox = new THREE.Box3().setFromObject(obj);
  const size = bbox.getSize(new THREE.Vector3());
  const s = Math.min(
    targetH / Math.max(size.y, 0.001),
    maxFoot / Math.max(size.x, 0.001),
    maxFoot / Math.max(size.z, 0.001)
  );
  obj.scale.setScalar(s);
  const box2 = new THREE.Box3().setFromObject(obj);
  const centre = box2.getCenter(new THREE.Vector3());
  obj.position.x -= centre.x;
  obj.position.z -= centre.z;
  obj.position.y -= box2.min.y;
  return obj;
}

/**
 * Loads the model kits and swaps them in over the primitive stand-ins.
 *
 * @param {THREE.Scene} scene Scene holding the primitives to replace.
 * @param {ReturnType<import("./registry.js").createRegistry>} registry Swap registry
 *   populated by the zone builders.
 * @returns {Promise<void>} Resolves once every kit is placed; rejects if a kit
 *   fails to load, leaving the primitives in place.
 */
export async function enhanceWithModels(scene, registry) {
  const loader = new GLTFLoader();
  const load = (name) =>
    new Promise((resolve, reject) =>
      loader.load(
        `assets/models/${name}.glb`,
        (g) => resolve(recolorClay(g.scene)),
        undefined,
        reject
      )
    );

  const towerNames = [
    "building-a",
    "building-b",
    "building-d",
    "building-e",
    "building-h",
    "building-k",
    "building-q",
    "building-s",
  ];
  const [towerModels, chimney, truckA, truckB, van, ...plantModels] =
    await Promise.all([
      Promise.all(towerNames.map(load)),
      load("chimney-large"),
      load("truck"),
      load("delivery"),
      load("van"),
      ...["building-g", "detail-tank", "building-n"].map(load),
    ]);
  const plantByName = {
    "building-g": plantModels[0],
    "detail-tank": plantModels[1],
    "building-n": plantModels[2],
  };

  // District towers become Kenney industrial buildings.
  registry.towers.forEach(({ group, spec }, i) => {
    scene.remove(group);
    const wrap = new THREE.Group();
    const model = towerModels[i % towerModels.length].clone(true);
    fitToHeight(model, spec.h * 0.9, Math.max(spec.w, spec.d) * 1.7);
    wrap.add(model);
    wrap.position.set(spec.x, 0, spec.z);
    // Quarter turns keep the kit's flat facades facing different ways; the small
    // extra angle breaks the grid without making the town look scattered.
    wrap.rotation.y = (i % 4) * (Math.PI / 2) + 0.07 * (i % 3);
    scene.add(wrap);
  });

  // Chimney factories become Kenney chimney works.
  registry.chimneys.forEach(({ group, x, z, rot }, i) => {
    group.parent?.remove(group);
    const wrap = new THREE.Group();
    const model = chimney.clone(true);
    fitToHeight(model, 7.5 + i, 9);
    wrap.add(model);
    wrap.position.set(x, 0, z);
    wrap.rotation.y = rot;
    scene.add(wrap);
  });

  registry.plantSpots.forEach(({ name, x, z, rot, h }) => {
    const model = plantByName[name];
    if (!model) return;
    const wrap = new THREE.Group();
    const inst = model.clone(true);
    fitToHeight(inst, h, 9);
    wrap.add(inst);
    wrap.position.set(x, 0, z);
    wrap.rotation.y = rot;
    scene.add(wrap);
  });

  // Primitive trucks become Kenney vehicles.
  const vehicles = [truckA, truckB, van];
  registry.trucks.forEach((entry, i) => {
    entry.mesh.clear();
    const model = vehicles[i % vehicles.length].clone(true);
    const bbox = new THREE.Box3().setFromObject(model);
    const size = bbox.getSize(new THREE.Vector3());
    const s = 2.3 / Math.max(size.z, size.x, 0.001);
    model.scale.setScalar(s);
    const box2 = new THREE.Box3().setFromObject(model);
    const centre = box2.getCenter(new THREE.Vector3());
    model.position.set(-centre.x, -box2.min.y, -centre.z);
    entry.mesh.add(model);
  });

  // The largest procedural blocks become detailed Kenney buildings. The swap is
  // capped so the district keeps its instanced silhouette and its draw budget.
  if (registry.cityBlocks) {
    const { mesh, placements } = registry.cityBlocks;
    const zero = new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001);
    let swapped = 0;
    placements.forEach((p, i) => {
      if (swapped >= 22 || p.h < 3 || Math.max(p.w, p.d) < 3.2) return;
      zero.setPosition(p.x, 0, p.z);
      mesh.setMatrixAt(i, zero);
      const wrap = new THREE.Group();
      const model = towerModels[(i + swapped) % towerModels.length].clone(true);
      fitToHeight(model, p.h * 1.05, Math.max(p.w, p.d) * 1.5);
      wrap.add(model);
      wrap.position.set(p.x, 0, p.z);
      wrap.rotation.y = (swapped % 4) * (Math.PI / 2);
      scene.add(wrap);
      swapped++;
    });
    mesh.instanceMatrix.needsUpdate = true;
  }

  // Nature kit: clay trees scattered through every zone.
  const treeKinds = await Promise.all(
    ["nature/tree_default", "nature/tree_cone", "nature/tree_detailed"].map(load)
  );
  const treeSpots = [
    [-15, 18], [-12, -4], [13, 17], [21, 3], [-17, -27], [25, -31],
    [-7, -45], [15, -53], [31, -23], [-27, -41], [9, -8], [-33, -18],
    [8, -70], [15, -113], [45, -71], [61, -96], [25, -60],
    [-52, -151], [-3, -211], [9, -197],
    [-15, -241], [11, -259], [-9, -267], [13, -239],
  ];
  treeSpots.forEach(([x, z], i) => {
    // Height and facing come from the index rather than the rng so trees can be
    // added or reordered without reshuffling the rest of the diorama.
    const tree = treeKinds[i % treeKinds.length].clone(true);
    fitToHeight(tree, 1.8 + ((i * 37) % 10) / 7, 2.6);
    const wrap = new THREE.Group();
    wrap.add(tree);
    wrap.position.set(x, 0, z);
    wrap.rotation.y = i * 1.7;
    scene.add(wrap);
  });

  // Mini-market kit: an open-concept mall in the district, built as a real
  // building with walls, columns and an entrance canopy. The roof is left off so
  // the camera reads the shop floor inside.
  const marketNames = [
    "shelf-boxes", "shelf-bags", "shelf-end", "display-fruit",
    "display-bread", "freezers-standing", "freezer", "cash-register",
    "shopping-cart", "shopping-basket", "bottle-return", "fence",
    "character-employee", "wall", "wall-window", "wall-corner",
    "column",
  ];
  const market = {};
  await Promise.all(
    marketNames.map(async (n) => {
      market[n] = await load(`market/${n}`);
    })
  );
  const plaza = new THREE.Group();
  const slabGeo = new RoundedBoxGeometry(PLAZA.w, 0.18, PLAZA.d, 2, 0.06);
  slabGeo.translate(0, 0.09, 0);
  const slab = new THREE.Mesh(slabGeo, clayMat(PALETTE.ivory, 0.9));
  slab.receiveShadow = true;
  plaza.add(slab);
  const place = (name, x, z, rot, h, foot = 3) => {
    const inst = market[name].clone(true);
    fitToHeight(inst, h, foot);
    const wrap = new THREE.Group();
    wrap.add(inst);
    wrap.position.set(x, 0.18, z);
    wrap.rotation.y = rot;
    plaza.add(wrap);
    return wrap;
  };

  // Shell as a dollhouse cutaway: walls on the two back edges only, open front
  // and side so the camera reads the whole shop floor.
  const wallH = 2.1;
  const span = (count, from, to, fn) => {
    for (let i = 0; i < count; i++) {
      fn(from + ((to - from) * i) / (count - 1), i);
    }
  };
  span(8, -6.1, 6.1, (x, i) =>
    place(i % 3 === 1 ? "wall-window" : "wall", x, -5.6, 0, wallH, 2.1)
  );
  span(6, -4.4, 4.6, (z, i) =>
    place(i % 3 === 2 ? "wall-window" : "wall", 7.1, z, -Math.PI / 2, wallH, 2.1)
  );
  place("wall-corner", 7.1, -5.6, 0, wallH, 2.1);

  place("freezers-standing", 1.4, -4.7, 0, 1.3);
  place("freezers-standing", 3.6, -4.7, 0, 1.3);
  place("freezer", -0.8, -4.7, 0, 0.95);
  place("bottle-return", -5.6, -4.5, 0.3, 1.2);

  for (let r = 0; r < 3; r++) {
    const z = -2.6 + r * 2.2;
    place(r === 1 ? "shelf-bags" : "shelf-boxes", 0.4, z, 0, 1.15);
    place("shelf-boxes", 2.6, z, 0, 1.15);
    place(r === 2 ? "shelf-bags" : "shelf-boxes", 4.8, z, 0, 1.15);
  }
  place("shelf-end", 5.9, -1.5, Math.PI / 2, 1.0);
  place("display-fruit", 1.6, 4.0, 0.25, 0.95);
  place("display-bread", 3.8, 4.2, -0.15, 0.95);

  place("cash-register", -4.6, 1.4, Math.PI / 2, 0.85);
  place("cash-register", -2.8, 0.4, Math.PI / 2, 0.85);
  place("cash-register", -1.0, -0.6, Math.PI / 2, 0.85);

  place("fence", -6.4, 3.4, Math.PI / 2, 0.8);
  place("fence", -6.4, 1.6, Math.PI / 2, 0.8);
  place("shopping-basket", -5.2, 4.6, 0.4, 0.4);
  place("shopping-basket", -4.7, 4.3, 1.1, 0.4);
  place("shopping-cart", -3.2, 4.8, 0.7, 0.6);
  place("shopping-cart", 0.6, 5.2, -1.2, 0.6);
  place("character-employee", -3.6, 1.5, 1.6, 0.95);
  place("character-employee", 2.4, -3.6, -2.0, 0.95);
  place("character-employee", -1.4, 4.4, 2.6, 0.95);

  plaza.position.set(PLAZA.x, 0, PLAZA.z);
  plaza.rotation.y = PLAZA.rot;
  scene.add(plaza);

  // Edge data centre compound. Kits are indexed by the same names the station
  // zone recorded, with two aliases so market pieces can stand in for hardware.
  const byName = { ...plantByName, van };
  towerNames.forEach((n, i) => {
    if (!byName[n]) byName[n] = towerModels[i];
  });
  byName["market-fence"] = market.fence;
  byName["rack"] = market["freezers-standing"];

  // Server-rack aisles on the pad: standing cabinets in tight rows.
  for (let row = 0; row < 2; row++) {
    for (let k = 0; k < 4; k++) {
      registry.stationSpots.push({
        name: "rack",
        x: CORE_POS.x - 6.6 + k * 2.0,
        z: CORE_POS.z + 3.4 - row * 1.9,
        rot: Math.PI / 2,
        h: 1.35,
        foot: 1.9,
      });
    }
  }
  registry.stationSpots.forEach(({ name, x, z, rot, h, foot }) => {
    const model = byName[name];
    if (!model) return;
    const wrap = new THREE.Group();
    const inst = model.clone(true);
    fitToHeight(inst, h, foot ?? 9);
    wrap.add(inst);
    // Fences and the van sit on the ground; everything else sits on the pad.
    wrap.position.set(x, name === "market-fence" || name === "van" ? 0 : 0.22, z);
    wrap.rotation.y = rot;
    scene.add(wrap);
  });
}
