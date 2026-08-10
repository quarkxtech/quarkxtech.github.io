/* Copyright (c) 2026 QuarkX Sdn. Bhd. (202501056786 / 1658192-K). All rights reserved. */

/*
 * The coral signal that travels the ground path.
 *
 * Responsibilities:
 *   - ribbon geometry generated along the path curve
 *   - the two-layer ribbon shader (soft halo plus bright core)
 *   - the travelling bead and its ground glow
 *   - the halftone dot field that lights up in the signal's wake
 */

import * as THREE from "three";
import { PALETTE } from "./world.js";

/**
 * Builds a flat ribbon strip that follows a curve on the ground plane.
 *
 * UV.x carries normalised distance along the path, which is what the shaders
 * compare against the signal head, so no per-vertex attributes are needed.
 *
 * @param {THREE.Curve<THREE.Vector3>} curve Path to follow.
 * @param {number} width Ribbon width.
 * @param {number} segs Segments along the path.
 * @param {number} y Height above the ground plane.
 * @returns {THREE.BufferGeometry} Indexed triangle strip.
 */
function createRibbonGeometry(curve, width, segs, y) {
  const pos = new Float32Array((segs + 1) * 2 * 3);
  const uv = new Float32Array((segs + 1) * 2 * 2);
  const idx = [];
  const pt = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const side = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    curve.getPointAt(u, pt);
    curve.getTangentAt(u, tan);
    side.set(-tan.z, 0, tan.x).normalize();
    const o = i * 6;
    pos[o] = pt.x + (side.x * width) / 2;
    pos[o + 1] = y;
    pos[o + 2] = pt.z + (side.z * width) / 2;
    pos[o + 3] = pt.x - (side.x * width) / 2;
    pos[o + 4] = y;
    pos[o + 5] = pt.z - (side.z * width) / 2;
    uv[i * 4] = u;
    uv[i * 4 + 1] = 0;
    uv[i * 4 + 2] = u;
    uv[i * 4 + 3] = 1;
    if (i < segs) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

/**
 * Adds the signal ribbon, the travelling bead and the bead's ground glow.
 *
 * The halo and core layers share one uniform block so they can never drift out
 * of sync, and both are drawn with depth writes off in a fixed render order so
 * the transparent stack resolves the same way from every camera angle.
 *
 * @param {THREE.Scene} scene Scene to add the signal to.
 * @param {THREE.Curve<THREE.Vector3>} curve Path the signal travels.
 * @returns {{uniforms: object, bead: THREE.Mesh, glow: THREE.Mesh}} Handles driven per frame.
 */
export function buildSignal(scene, curve) {
  const uniforms = {
    uHead: { value: 0 },
    uTime: { value: 0 },
  };

  const frag = (halo) => /* glsl */ `
    uniform float uHead;
    uniform float uTime;
    varying vec2 vUv;
    void main() {
      float u = vUv.x;
      float across = 1.0 - abs(vUv.y * 2.0 - 1.0);
      float soft = pow(across, ${halo ? "2.4" : "1.1"});
      vec3 coral = vec3(0.852, 0.467, 0.341);
      vec3 hot = vec3(1.0, 0.58, 0.40);
      float head = exp(-pow((uHead - u) * ${halo ? "30.0" : "55.0"}, 2.0));
      float a = 0.0;
      vec3 col = coral;
      if (u <= uHead) {
        // comet tail: bright near the head, fading to a faint residue line
        float back = uHead - u;
        float trail = ${halo
          ? "0.32 * exp(-back * 9.0)"
          : "0.16 + 0.84 * exp(-back * 10.0)"};
        float pulse = 0.5 + 0.5 * sin(u * 110.0 + uTime * 2.4);
        a = trail + head * 1.2 ${halo ? "" : "+ pulse * 0.05 * exp(-back * 8.0)"};
        col = mix(coral, hot, clamp(head * 1.4, 0.0, 1.0));
      } else {
        float dash = smoothstep(0.42, 0.18, abs(fract(u * 60.0) - 0.5));
        float near = smoothstep(0.30, 0.0, u - uHead);
        a = dash * ${halo ? "0.0" : "(0.14 + near * 0.2)"};
      }
      gl_FragColor = vec4(col, a * soft);
    }
  `;
  const vert = /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const halo = new THREE.Mesh(
    createRibbonGeometry(curve, 2.9, 760, 0.05),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms,
      vertexShader: vert,
      fragmentShader: frag(true),
    })
  );
  halo.renderOrder = 2;
  halo.frustumCulled = false;
  scene.add(halo);

  const core = new THREE.Mesh(
    createRibbonGeometry(curve, 1.05, 760, 0.07),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms,
      vertexShader: vert,
      fragmentShader: frag(false),
    })
  );
  core.renderOrder = 3;
  core.frustumCulled = false;
  scene.add(core);

  const bead = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 18, 18),
    new THREE.MeshStandardMaterial({
      color: PALETTE.coralHot,
      emissive: PALETTE.coralHot,
      emissiveIntensity: 0.9,
      roughness: 0.4,
    })
  );
  bead.castShadow = true;
  scene.add(bead);

  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowCanvas.height = 128;
  const gctx = glowCanvas.getContext("2d");
  const grad = gctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,138,92,0.85)");
  grad.addColorStop(0.4, "rgba(217,119,87,0.32)");
  grad.addColorStop(1, "rgba(217,119,87,0)");
  gctx.fillStyle = grad;
  gctx.fillRect(0, 0, 128, 128);
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(2.6, 40),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(glowCanvas),
      transparent: true,
      depthWrite: false,
    })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.09;
  glow.renderOrder = 4;
  scene.add(glow);

  return { uniforms, bead, glow };
}

/**
 * Adds the grid-aligned halftone dot field that hugs the path.
 *
 * Dots are snapped to a world grid rather than scattered along the curve so the
 * field reads as printed halftone instead of a trail of noise.
 *
 * @param {THREE.Scene} scene Scene to add the dots to.
 * @param {THREE.Curve<THREE.Vector3>} curve Path the dots hug.
 * @returns {{mat: THREE.ShaderMaterial}} Handle whose `uHead` uniform tracks the signal.
 */
export function buildDots(scene, curve) {
  const fine = curve.getSpacedPoints(1200);
  const spacing = 1.35;
  const maxLat = 7.2;
  const items = [];
  const seen = new Set();
  fine.forEach((p, fi) => {
    const u = fi / (fine.length - 1);
    const gx0 = Math.round((p.x - maxLat) / spacing);
    const gx1 = Math.round((p.x + maxLat) / spacing);
    const gz0 = Math.round((p.z - maxLat) / spacing);
    const gz1 = Math.round((p.z + maxLat) / spacing);
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gz = gz0; gz <= gz1; gz++) {
        const key = gx + "," + gz;
        if (seen.has(key)) continue;
        const x = gx * spacing;
        const z = gz * spacing;
        const d = Math.hypot(p.x - x, p.z - z);
        if (d > maxLat) continue;
        seen.add(key);
        items.push({ x, z, u, d });
      }
    }
  });
  const count = items.length;
  const pos = new Float32Array(count * 3);
  const aU = new Float32Array(count);
  const aDist = new Float32Array(count);
  items.forEach((it, i) => {
    pos[i * 3] = it.x;
    pos[i * 3 + 1] = 0.08;
    pos[i * 3 + 2] = it.z;
    aU[i] = it.u;
    aDist[i] = it.d / maxLat;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aU", new THREE.BufferAttribute(aU, 1));
  geo.setAttribute("aDist", new THREE.BufferAttribute(aDist, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uHead: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aU;
      attribute float aDist;
      uniform float uHead;
      varying float vA;
      varying float vHot;
      void main() {
        float wake = exp(-pow((aU - uHead) * 13.0, 2.0));
        float passed = step(aU, uHead);
        float lat = 1.0 - aDist;
        vHot = wake * lat;
        vA = (passed * 0.10 + wake * 0.95) * pow(lat, 1.6);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = (2.0 + wake * 2.4 * lat) * (150.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vA;
      varying float vHot;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float disc = smoothstep(0.5, 0.34, d);
        vec3 calm = vec3(0.80, 0.58, 0.45);
        vec3 hot = vec3(1.0, 0.56, 0.38);
        gl_FragColor = vec4(mix(calm, hot, vHot), disc * vA);
      }
    `,
  });
  const dots = new THREE.Points(geo, mat);
  dots.renderOrder = 5;
  dots.frustumCulled = false;
  scene.add(dots);
  return { mat };
}
