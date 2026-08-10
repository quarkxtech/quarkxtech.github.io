/* Copyright (c) 2026 QuarkX Sdn. Bhd. (202501056786 / 1658192-K). All rights reserved. */

/*
 * Scenery shared by every zone.
 *
 * These builders add straight to the scene because there is exactly one of each
 * kind per world, and they are cheapest when batched across all zones at once.
 *
 * Responsibilities:
 *   - the painted ground plane
 *   - crowd figures, instanced in one draw call per body part
 *   - window bands on building faces
 *   - the shared steam particle system
 */

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { PALETTE } from "./world.js";
import { clayMat } from "./materials.js";

/**
 * Adds the ground plane, painted with soft tonal blotches.
 *
 * A flat colour reads as dead space under the tilt-shift pass, so the texture is
 * generated at load time rather than shipped as an asset.
 *
 * @param {THREE.Scene} scene Scene to add the ground to.
 * @param {() => number} rng Deterministic random source.
 * @returns {void}
 */
export function buildGround(scene, rng) {
  const cnv = document.createElement("canvas");
  cnv.width = cnv.height = 1024;
  const ctx = cnv.getContext("2d");
  ctx.fillStyle = "#ede2d0";
  ctx.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 26; i++) {
    const x = rng() * 1024;
    const y = rng() * 1024;
    const r = 90 + rng() * 260;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const warm = rng() < 0.5;
    const a = 0.025 + rng() * 0.05;
    g.addColorStop(0, warm ? `rgba(196,170,140,${a})` : `rgba(255,250,240,${a})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(cnv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1100), mat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -130);
  ground.receiveShadow = true;
  scene.add(ground);
}

/**
 * Adds a set of astronaut-style figures: helmet, body and backpack.
 *
 * @param {THREE.Scene} scene Scene to add the figures to.
 * @param {Array<[number, number, number?]>} spots Ground positions as [x, z, scale].
 * @param {() => number} rng Deterministic random source, used for facing.
 * @returns {void}
 */
export function buildFigures(scene, spots, rng) {
  const group = new THREE.Group();
  const bodyGeo = new THREE.CapsuleGeometry(0.16, 0.34, 6, 12);
  bodyGeo.translate(0, 0.5, 0);
  const headGeo = new THREE.SphereGeometry(0.17, 14, 14);
  headGeo.translate(0, 0.92, 0);
  const packGeo = new RoundedBoxGeometry(0.22, 0.3, 0.13, 1, 0.04);
  packGeo.translate(0, 0.58, -0.2);
  const mat = clayMat(PALETTE.white, 0.8);
  const n = spots.length;
  const body = new THREE.InstancedMesh(bodyGeo, mat, n);
  const head = new THREE.InstancedMesh(headGeo, mat, n);
  const pack = new THREE.InstancedMesh(packGeo, clayMat(PALETTE.slate, 0.8), n);
  body.castShadow = head.castShadow = pack.castShadow = true;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  spots.forEach(([x, z, s = 1], i) => {
    e.set(0, rng() * Math.PI * 2, 0);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, s, s));
    body.setMatrixAt(i, m);
    head.setMatrixAt(i, m);
    pack.setMatrixAt(i, m);
  });
  group.add(body, head, pack);
  scene.add(group);
}

/**
 * Adds slim recessed-looking window strips to building faces.
 *
 * @param {THREE.Scene} scene Scene to add the strips to.
 * @param {Array<{x: number, y: number, z: number, w: number, h: number, ry: number}>} strips
 *   Strip placements; `ry` orients a strip against the face it sits on.
 * @returns {void}
 */
export function buildWindowStrips(scene, strips) {
  if (!strips.length) return;
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xc9b89c,
    roughness: 0.7,
    metalness: 0.05,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, strips.length);
  mesh.receiveShadow = true;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  strips.forEach((s, i) => {
    e.set(0, s.ry, 0);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(s.x, s.y, s.z), q, new THREE.Vector3(s.w, s.h, 1));
    mesh.setMatrixAt(i, m);
  });
  scene.add(mesh);
}

/**
 * Adds one Points cloud that serves every steam emitter in the world.
 *
 * A single cloud keeps the chimneys and cooling towers to one draw call; the
 * shader offsets each particle by its emitter and cycles it on a seeded phase.
 *
 * @param {THREE.Scene} scene Scene to add the cloud to.
 * @param {Array<[number, number, number]>} emitters World positions of the stack tops.
 * @param {() => number} rng Deterministic random source.
 * @returns {{mat: THREE.ShaderMaterial}} Handle whose `uTime` uniform drives the drift.
 */
export function buildSteam(scene, emitters, rng) {
  const per = 46;
  const count = emitters.length * per;
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const em = emitters[Math.floor(i / per)];
    pos[i * 3] = em[0] + (rng() - 0.5) * 1.6;
    pos[i * 3 + 1] = em[1];
    pos[i * 3 + 2] = em[2] + (rng() - 0.5) * 1.6;
    seed[i] = rng();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      varying float vFade;
      void main() {
        vec3 p = position;
        float cycle = fract(aSeed + uTime * 0.05);
        p.y += cycle * 10.0;
        p.x += sin(uTime * 0.4 + aSeed * 40.0) * (0.4 + cycle * 2.0);
        vFade = (1.0 - cycle) * smoothstep(0.0, 0.18, cycle);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (6.0 + aSeed * 8.0 + cycle * 18.0) * (95.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vFade;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.08, d) * vFade * 0.55;
        gl_FragColor = vec4(vec3(1.0, 0.995, 0.985), a);
      }
    `,
  });
  const steam = new THREE.Points(geo, mat);
  steam.renderOrder = 6;
  steam.frustumCulled = false;
  scene.add(steam);
  return { mat };
}
