/* ============================================================
   QuarkX — WebGL experience: the paper diorama
   A clay-miniature world in warm Claude tones, seen from above,
   rebuilt object-for-object from the vectr reference scenes:
   01 district grid → 02 plant works → 03 eval grid → 04 edge station
   A coral signal ribbon flows along the ground; the camera glides
   over the diorama, scrubbed by scroll.
   ============================================================ */

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";

const C = {
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

const CORE_POS = new THREE.Vector3(0, 0, -276);

/* ---------- path ---------- */

function makePathCurve() {
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

/* ---------- helpers ---------- */

function clayMat(color, rough = 0.96) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
}

function shadowed(mesh, cast = true, receive = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

function box(w, h, d, color, r = 0.05) {
  const geo = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) / 3));
  geo.translate(0, h / 2, 0);
  return shadowed(new THREE.Mesh(geo, clayMat(color)));
}

/* gabled warehouse: crisp extruded house profile, like the reference sheds */
function gableShed(w, wallH, ridgeH, len, color, roofColor) {
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

  // recessed door on the gable end
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

/* sawtooth factory hall, like the big reference hall */
function sawtoothHall(width, wallH, toothH, teeth, len, color) {
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

/* container / crate stack: grid of small boxes with gaps */
function crateStack(cols, rows, levels, color, rng) {
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

/* cabinet rows: tall thin lockers in neat rows */
function cabinetRows(cols, rows, rng) {
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
  const mesh = new THREE.InstancedMesh(geo, clayMat(C.ivory), spots.length);
  mesh.castShadow = mesh.receiveShadow = true;
  const m = new THREE.Matrix4();
  spots.forEach(([x, z, h], i) => {
    m.makeScale(1, h / 1.9, 1).setPosition(x, 0, z);
    mesh.setMatrixAt(i, m);
  });
  g.add(mesh);
  return g;
}

/* horizontal tank machine: vessel + dome ports + pipe elbow */
function tankMachine() {
  const g = new THREE.Group();
  const vessel = shadowed(
    new THREE.Mesh(new THREE.CapsuleGeometry(1.5, 5, 8, 20), clayMat(C.ivory))
  );
  vessel.rotation.z = Math.PI / 2;
  vessel.position.y = 1.8;
  g.add(vessel);
  for (let i = 0; i < 3; i++) {
    const dome = shadowed(
      new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 14), clayMat(C.clay))
    );
    dome.position.set(-1.6 + i * 1.6, 3.2, 0);
    g.add(dome);
  }
  const elbow = shadowed(
    new THREE.Mesh(
      new THREE.TorusGeometry(1.1, 0.38, 10, 16, Math.PI / 2),
      clayMat(C.clay)
    )
  );
  elbow.rotation.z = Math.PI;
  elbow.position.set(3.6, 1.8, 0);
  g.add(elbow);
  const spout = shadowed(
    new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 1.3, 12), clayMat(C.clay))
  );
  spout.position.set(4.7, 1.1, 0);
  g.add(spout);
  const skid = box(6.4, 0.5, 2.4, C.clayDeep, 0.06);
  g.add(skid);
  return g;
}

/* chimney factory: gabled body + tall stacks */
/* swap registry: primitives are replaced by CC0 Kenney models on load */
const REGISTRY = {
  towers: [],
  chimneys: [],
  trucks: [],
  plantSpots: [],
  stationSpots: [],
  cityBlocks: null,
};

/* the market plaza footprint stays clear of procedural blocks */
const PLAZA = { x: -25, z: 7, w: 15, d: 12, rot: 0.18 };

function chimneyFactory(rng) {
  const g = new THREE.Group();
  g.add(gableShed(4.6, 2.6, 1.2, 6, C.ivory, null));
  const emitters = [];
  for (let i = 0; i < 2; i++) {
    const stack = shadowed(
      new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.5, 5.6, 14), clayMat(C.clay))
    );
    stack.position.set(-1 + i * 2, 2.8, -1 + i * 0.6);
    g.add(stack);
    emitters.push([stack.position.x, 5.7, stack.position.z]);
  }
  g.userData.emitters = emitters;
  return g;
}

/* astronaut-style figure: helmet + body + backpack */
function buildFigures(scene, spots, rng) {
  const group = new THREE.Group();
  const bodyGeo = new THREE.CapsuleGeometry(0.16, 0.34, 6, 12);
  bodyGeo.translate(0, 0.5, 0);
  const headGeo = new THREE.SphereGeometry(0.17, 14, 14);
  headGeo.translate(0, 0.92, 0);
  const packGeo = new RoundedBoxGeometry(0.22, 0.3, 0.13, 1, 0.04);
  packGeo.translate(0, 0.58, -0.2);
  const mat = clayMat(C.white, 0.8);
  const n = spots.length;
  const body = new THREE.InstancedMesh(bodyGeo, mat, n);
  const head = new THREE.InstancedMesh(headGeo, mat, n);
  const pack = new THREE.InstancedMesh(packGeo, clayMat(C.slate, 0.8), n);
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

/* shared steam system: one Points cloud serving many emitters */
function buildSteam(scene, emitters, rng) {
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

/* ---------- ground ---------- */

function buildGround(scene, rng) {
  // hand-paint subtle tonal blotches so the ground isn't one flat colour
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

/* window bands: slim recessed-looking strips on building faces */
function addWindowStrips(scene, strips) {
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

/* ---------- signal ribbon + halftone dots ---------- */

function buildRibbonGeometry(curve, width, segs = 760, y = 0.06) {
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

function buildSignal(scene, curve) {
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
    buildRibbonGeometry(curve, 2.9, 760, 0.05),
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
    buildRibbonGeometry(curve, 1.05, 760, 0.07),
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
      color: C.coralHot,
      emissive: C.coralHot,
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

/* grid-aligned halftone dots hugging the path, like the reference */
function buildDots(scene, curve) {
  const fine = curve.getSpacedPoints(1200);
  const spacing = 1.35;
  const maxLat = 7.2;
  const items = [];
  // bounding walk over grid cells near the path
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

/* ---------- zone 01: district grid ---------- */

function buildCity(scene, curve, rng) {
  const samples = curve.getPoints(240);
  const distToPath = (x, z) => {
    let min = 1e9;
    for (const s of samples) {
      const d = (s.x - x) ** 2 + (s.z - z) ** 2;
      if (d < min) min = d;
    }
    return Math.sqrt(min);
  };

  // low blocks (instanced)
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
      // keep the market plaza clear
      if (
        Math.abs(x - PLAZA.x) < PLAZA.w / 2 + 2 &&
        Math.abs(z - PLAZA.z) < PLAZA.d / 2 + 2
      )
        continue;
      const d = distToPath(x, z);
      // density falls off away from the town centre so the cluster
      // reads as one compact diorama with calm ground around it
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

  const city = new THREE.InstancedMesh(blockGeo, clayMat(C.white), placements.length);
  city.castShadow = city.receiveShadow = true;
  const m = new THREE.Matrix4();
  const col = new THREE.Color();
  placements.forEach((p, i) => {
    m.makeScale(p.w, p.h, p.d).setPosition(p.x, 0, p.z);
    city.setMatrixAt(i, m);
    const pick = rng();
    col.set(pick < 0.55 ? C.ivory : pick < 0.85 ? C.clay : C.clayDeep);
    col.multiplyScalar(0.97 + rng() * 0.06);
    city.setColorAt(i, col);
  });
  scene.add(city);
  REGISTRY.cityBlocks = { mesh: city, placements };

  // tiered towers with floor ledges, like the reference hero towers
  // (swapped for Kenney models once they load — see enhanceWithModels)
  towers.forEach((tw) => {
    const g = new THREE.Group();
    const baseH = tw.h * 0.55;
    const topH = tw.h * 0.45;
    g.add(box(tw.w, baseH, tw.d, rng() < 0.5 ? C.ivory : C.clay, 0.05));
    const ledge = box(tw.w * 1.06, 0.28, tw.d * 1.06, C.clayDeep, 0.04);
    ledge.position.y = baseH;
    g.add(ledge);
    const top = box(tw.w * 0.78, topH, tw.d * 0.78, C.ivory, 0.05);
    top.position.y = baseH + 0.28;
    g.add(top);
    const unit = box(tw.w * 0.26, 0.5, tw.d * 0.26, C.slate, 0.04);
    unit.position.set(tw.w * 0.12, baseH + 0.28 + topH, -tw.d * 0.1);
    g.add(unit);
    if (rng() < 0.3) {
      const crown = box(tw.w * 0.6, 0.24, tw.d * 0.6, C.coral, 0.04);
      crown.position.y = baseH + 0.28 + topH;
      g.add(crown);
    }
    g.position.set(tw.x, 0, tw.z);
    g.rotation.y = (rng() - 0.5) * 0.15;
    scene.add(g);
    REGISTRY.towers.push({ group: g, spec: tw });
  });

  // window bands on the larger blocks and towers
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
  addWindowStrips(scene, strips);

  // rooftop units on low blocks
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
  const unitMesh = new THREE.InstancedMesh(unitGeo, clayMat(C.slate), units.length);
  unitMesh.castShadow = true;
  units.forEach((u, i) => {
    m.makeScale(u.s, u.s * 0.6, u.s).setPosition(u.x, u.y, u.z);
    unitMesh.setMatrixAt(i, m);
  });
  scene.add(unitMesh);

  // crate stack at the town edge
  const crates = crateStack(4, 3, 2, C.ivory, rng);
  crates.position.set(-34, 0, 8);
  crates.rotation.y = 0.3;
  scene.add(crates);

  // wind turbines east of town, like the reference hero
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
    t.add(shadowed(new THREE.Mesh(mastGeo, clayMat(C.ivory))));
    const nacelle = shadowed(
      new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.3, 0.7, 1, 0.04), clayMat(C.slate))
    );
    nacelle.position.set(0, 8.5, 0.08);
    t.add(nacelle);
    const rotor = new THREE.Group();
    for (let b = 0; b < 3; b++) {
      const blade = shadowed(new THREE.Mesh(bladeGeo, clayMat(C.white)));
      blade.rotation.z = (b / 3) * Math.PI * 2;
      rotor.add(blade);
    }
    rotor.position.set(0, 8.5, 0.48);
    t.add(rotor);
    t.position.set(x, 0, z);
    t.rotation.y = -0.9;
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

/* ---------- zone 02: plant works ---------- */

function buildPlant(scene, rng) {
  const group = new THREE.Group();
  const emitters = [];

  // hyperboloid cooling towers
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
    const t = shadowed(new THREE.Mesh(towerGeo, clayMat(C.ivory)));
    t.position.set(x, 0, z);
    t.scale.setScalar(s);
    group.add(t);
    emitters.push([x, 13.2 * s, z]);
  });

  // big sawtooth factory hall
  const hall = sawtoothHall(15, 3.6, 1.5, 4, 9.5, C.ivory);
  hall.position.set(34, 0, -106);
  hall.rotation.y = 0.45;
  group.add(hall);

  // gabled warehouses in rows
  [
    [18, -84, 0.45, C.ivory],
    [24, -78, 0.45, C.clay],
    [44, -116, 0.5, C.ivory],
    [50, -110, 0.5, C.clay],
    [56, -104, 0.5, C.ivory],
    [20, -118, -0.2, C.ivory],
  ].forEach(([x, z, rot, c]) => {
    const shed = gableShed(3.6, 1.8, 1.1, 6.4, c, rng() < 0.4 ? C.coral : null);
    shed.position.set(x, 0, z);
    shed.rotation.y = rot;
    group.add(shed);
  });

  // crate stacks
  const crates = crateStack(4, 3, 2, C.ivory, rng);
  crates.position.set(28, 0, -68);
  crates.rotation.y = 0.45;
  group.add(crates);

  // cabinet rows
  const cabs = cabinetRows(7, 2, rng);
  cabs.position.set(12, 0, -98);
  cabs.rotation.y = 0.45;
  group.add(cabs);

  // tank machine on the path's edge
  const tank = tankMachine();
  tank.position.set(24, 0, -103);
  tank.rotation.y = -0.5;
  group.add(tank);

  // chimney factories on the far edge
  [
    [62, -122, -0.4],
    [68, -112, -0.4],
  ].forEach(([x, z, rot]) => {
    const f = chimneyFactory(rng);
    f.position.set(x, 0, z);
    f.rotation.y = rot;
    f.userData.emitters.forEach(([ex, ey, ez]) => {
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      emitters.push([x + ex * cos + ez * sin, ey, z - ex * sin + ez * cos]);
    });
    group.add(f);
    REGISTRY.chimneys.push({ group: f, x, z, rot });
  });

  // anchor spots where detailed plant models land once loaded
  REGISTRY.plantSpots.push(
    { name: "building-g", x: 14, z: -86, rot: 0.45, h: 5.5 },
    { name: "detail-tank", x: 30, z: -94, rot: -0.5, h: 4.2 },
    { name: "building-n", x: 38, z: -122, rot: 0.5, h: 5 }
  );

  // water tower
  const waterTower = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const leg = shadowed(
      new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.2, 8), clayMat(C.slate))
    );
    leg.position.set(
      Math.cos((i / 4) * Math.PI * 2 + 0.6) * 0.85,
      1.6,
      Math.sin((i / 4) * Math.PI * 2 + 0.6) * 0.85
    );
    waterTower.add(leg);
  }
  const wtank = shadowed(
    new THREE.Mesh(new THREE.CapsuleGeometry(1.1, 0.9, 8, 18), clayMat(C.ivory))
  );
  wtank.position.y = 3.9;
  waterTower.add(wtank);
  waterTower.position.set(10, 0, -78);
  group.add(waterTower);

  // crowd of figures near the gate, like the reference screening scene
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

/* ---------- zone 03: eval grid ---------- */

function buildEvalGrid(scene, curve, rng) {
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
      tiles.push({ x, z, u, d, coral: rng() < 0.06, stack: rng() < 0.05 ? 1 + Math.floor(rng() * 2) : 0 });
    }
  }

  const mesh = new THREE.InstancedMesh(tileGeo, clayMat(C.white, 0.9), tiles.length);
  mesh.castShadow = mesh.receiveShadow = true;
  const m = new THREE.Matrix4();
  const col = new THREE.Color();
  tiles.forEach((tile, i) => {
    m.makeTranslation(tile.x, 0, tile.z);
    mesh.setMatrixAt(i, m);
    col.set(tile.coral ? C.coral : rng() < 0.7 ? C.ivory : C.clay);
    mesh.setColorAt(i, col);
  });
  scene.add(mesh);

  // a few stacked tiles, like the raised cluster in the reference
  const stacks = [];
  tiles.forEach((tile) => {
    for (let s = 0; s < tile.stack; s++) {
      stacks.push([tile.x, (s + 1) * 0.55, tile.z]);
    }
  });
  const stackMesh = new THREE.InstancedMesh(tileGeo, clayMat(C.ivory, 0.9), stacks.length);
  stackMesh.castShadow = true;
  stacks.forEach(([x, y, z], i) => {
    m.makeTranslation(x, y, z);
    stackMesh.setMatrixAt(i, m);
  });
  scene.add(stackMesh);

  buildFigures(scene, [[-18, -172], [-30, -188]], rng);

  return {
    update(t, head) {
      // tiles breathe up as the signal passes
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

/* ---------- zone 04: edge station ---------- */

function buildStation(scene, rng) {
  const group = new THREE.Group();

  // chevron road markings pointing to the platform, like the arrival arrow
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
    const chev = shadowed(
      new THREE.Mesh(chevGeo, clayMat(i === 0 ? C.coralDeep : C.coral, 0.85)),
      true,
      false
    );
    chev.rotation.x = -Math.PI / 2;
    chev.rotation.z = Math.PI / 2;
    chev.position.set(CORE_POS.x - 2.1, 0.02, CORE_POS.z + 18 + i * 3.4);
    group.add(chev);
  }

  // docking pad: the signal road terminates here, in front of the gate
  const dock = new THREE.Group();
  const dockDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(1.35, 1.45, 0.08, 36),
    clayMat(C.coral, 0.8)
  );
  dockDisc.receiveShadow = true;
  dockDisc.position.y = 0.04;
  dock.add(dockDisc);
  const dockRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.1, 0.07, 8, 48),
    clayMat(C.coralDeep, 0.8)
  );
  dockRing.rotation.x = Math.PI / 2;
  dockRing.position.y = 0.05;
  dock.add(dockRing);
  dock.position.set(0, 0, -263.5);
  group.add(dock);

  // a literal edge data centre: concrete pad, server halls (Kenney
  // models swapped in on load), satellite dish, cooling units, fence
  const padGeo = new RoundedBoxGeometry(20, 0.22, 15, 2, 0.08);
  padGeo.translate(0, 0.11, 0);
  const pad = shadowed(new THREE.Mesh(padGeo, clayMat(C.ivory, 0.9)), false, true);
  pad.position.set(CORE_POS.x, 0, CORE_POS.z);
  group.add(pad);

  // satellite dish
  const dishProfile = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    dishProfile.push(new THREE.Vector2(t * 1.6, t * t * 0.7));
  }
  const dish = new THREE.Group();
  const bowl = shadowed(
    new THREE.Mesh(new THREE.LatheGeometry(dishProfile, 28), clayMat(C.white))
  );
  bowl.rotation.x = -0.85;
  bowl.position.y = 1.7;
  dish.add(bowl);
  dish.add(
    shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.7, 8), clayMat(C.slate)))
  );
  dish.position.set(CORE_POS.x + 7.2, 0.95, CORE_POS.z - 5.4);
  group.add(dish);

  // cooling units along the pad edge
  for (let i = 0; i < 3; i++) {
    const unit = box(1.5, 1.0, 1.5, C.slate, 0.06);
    unit.position.set(CORE_POS.x - 8.2, 0.22, CORE_POS.z - 4.5 + i * 2.2);
    group.add(unit);
    const grill = box(1.1, 0.12, 1.1, C.clayDeep, 0.03);
    grill.position.set(CORE_POS.x - 8.2, 1.25, CORE_POS.z - 4.5 + i * 2.2);
    group.add(grill);
  }

  // server halls, storage tank, parked van and the perimeter fence
  // land here once the Kenney kits load
  REGISTRY.stationSpots.push(
    { name: "building-n", x: CORE_POS.x - 3.4, z: CORE_POS.z - 2.6, rot: 0, h: 4.4, foot: 9 },
    { name: "building-e", x: CORE_POS.x + 4.6, z: CORE_POS.z + 0.8, rot: Math.PI / 2, h: 3.4, foot: 6.5 },
    { name: "detail-tank", x: CORE_POS.x + 7.6, z: CORE_POS.z + 4.2, rot: 0.4, h: 3.0, foot: 4.5 },
    { name: "van", x: CORE_POS.x - 6.2, z: CORE_POS.z + 5.6, rot: 1.25, h: 1.1, foot: 2.6 }
  );
  const fenceY = [];
  for (let f = 0; f < 4; f++) {
    fenceY.push({ x: CORE_POS.x - 10.2, z: CORE_POS.z - 6 + f * 4, rot: Math.PI / 2 });
    fenceY.push({ x: CORE_POS.x + 10.2, z: CORE_POS.z - 6 + f * 4, rot: Math.PI / 2 });
  }
  for (let f = 0; f < 5; f++) {
    fenceY.push({ x: CORE_POS.x - 8 + f * 4, z: CORE_POS.z - 7.7, rot: 0 });
    // front edge keeps a gate gap where the signal road arrives
    if (f < 2 || f > 2) {
      fenceY.push({ x: CORE_POS.x - 8 + f * 4, z: CORE_POS.z + 7.7, rot: 0 });
    }
  }
  fenceY.forEach((seg) =>
    REGISTRY.stationSpots.push({ name: "market-fence", ...seg, h: 0.85, foot: 4.2 })
  );

  buildFigures(scene, [[-5, -270.5], [2.5, -271.5], [CORE_POS.x + 5.5, CORE_POS.z + 6.6]], rng);

  scene.add(group);
  return {
    update(t) {
      dish.rotation.y = Math.sin(t * 0.12) * 0.7;
    },
  };
}

/* ---------- tiny clay trucks driving the road ---------- */

function buildTrucks(scene, curve) {
  const trucks = [];
  const makeTruck = (bodyColor) => {
    const g = new THREE.Group();
    const bed = box(0.9, 0.55, 1.7, C.ivory, 0.06);
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
    { offset: 0.0, lat: 1.5, speed: 0.0045, color: C.coral },
    { offset: 0.45, lat: -1.6, speed: 0.0038, color: C.slate },
    { offset: 0.75, lat: 1.6, speed: 0.005, color: C.ivory },
  ].forEach((cfg) => {
    const entry = { ...cfg, mesh: makeTruck(cfg.color), u: cfg.offset };
    trucks.push(entry);
    REGISTRY.trucks.push(entry);
  });
  const pt = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const side = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  return {
    update(t) {
      trucks.forEach((tr) => {
        // opposite-lane trucks genuinely travel the other way,
        // so facing always matches motion
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

/* ---------- Kenney CC0 model integration ----------
   Loads the public-domain kits from assets/models, recolours every
   material into the Claude clay palette, and swaps out the primitive
   stand-ins. If anything fails to load, the primitives simply stay. */

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
      // deterministic per-material jitter so whites split into clay tones
      let hash = 0;
      for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
      const jitter = (Math.abs(hash) % 100) / 100;
      let target;
      if (hsl.s > 0.32 && (hsl.h < 0.13 || hsl.h > 0.93)) target = C.coral;
      else if (hsl.s > 0.32 && hsl.h > 0.2 && hsl.h < 0.45) target = 0xaaab84;
      else if (hsl.l > 0.72) target = jitter < 0.55 ? C.ivory : C.clay;
      else if (hsl.l > 0.5) target = jitter < 0.6 ? C.clay : C.clayDeep;
      else if (hsl.l > 0.3) target = C.clayDeep;
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

function fitToHeight(obj, targetH, maxFoot = Infinity) {
  const bbox = new THREE.Box3().setFromObject(obj);
  const size = bbox.getSize(new THREE.Vector3());
  const s = Math.min(
    targetH / Math.max(size.y, 0.001),
    maxFoot / Math.max(size.x, 0.001),
    maxFoot / Math.max(size.z, 0.001)
  );
  obj.scale.setScalar(s);
  // rest the model's base on the ground, centred on its footprint
  const box2 = new THREE.Box3().setFromObject(obj);
  const centre = box2.getCenter(new THREE.Vector3());
  obj.position.x -= centre.x;
  obj.position.z -= centre.z;
  obj.position.y -= box2.min.y;
  return obj;
}

async function enhanceWithModels(scene) {
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

  // city towers → Kenney industrial buildings
  REGISTRY.towers.forEach(({ group, spec }, i) => {
    scene.remove(group);
    const wrap = new THREE.Group();
    const model = towerModels[i % towerModels.length].clone(true);
    fitToHeight(model, spec.h * 0.9, Math.max(spec.w, spec.d) * 1.7);
    wrap.add(model);
    wrap.position.set(spec.x, 0, spec.z);
    wrap.rotation.y = (i % 4) * (Math.PI / 2) + 0.07 * (i % 3);
    scene.add(wrap);
  });

  // chimney factories → Kenney chimney works
  REGISTRY.chimneys.forEach(({ group, x, z, rot }, i) => {
    group.parent?.remove(group);
    const wrap = new THREE.Group();
    const model = chimney.clone(true);
    fitToHeight(model, 7.5 + i, 9);
    wrap.add(model);
    wrap.position.set(x, 0, z);
    wrap.rotation.y = rot;
    scene.add(wrap);
  });

  // plant anchor spots
  REGISTRY.plantSpots.forEach(({ name, x, z, rot, h }) => {
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

  // primitive trucks → Kenney vehicles
  const vehicles = [truckA, truckB, van];
  REGISTRY.trucks.forEach((entry, i) => {
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

  // larger procedural blocks → detailed Kenney buildings
  if (REGISTRY.cityBlocks) {
    const { mesh, placements } = REGISTRY.cityBlocks;
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

  // nature kit: clay trees scattered through every zone
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
    const tree = treeKinds[i % treeKinds.length].clone(true);
    fitToHeight(tree, 1.8 + ((i * 37) % 10) / 7, 2.6);
    const wrap = new THREE.Group();
    wrap.add(tree);
    wrap.position.set(x, 0, z);
    wrap.rotation.y = i * 1.7;
    scene.add(wrap);
  });

  // mini-market kit: an open-concept mall in the district — a real
  // building with walls, columns and an entrance canopy, roof left
  // open so the camera sees the shop floor inside
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
  const slab = new THREE.Mesh(slabGeo, clayMat(C.ivory, 0.9));
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

  // shell: dollhouse cutaway — walls on the two back edges only,
  // open front and side so the camera reads the whole shop floor
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

  // freezer wall along the back, like the reference room
  place("freezers-standing", 1.4, -4.7, 0, 1.3);
  place("freezers-standing", 3.6, -4.7, 0, 1.3);
  place("freezer", -0.8, -4.7, 0, 0.95);
  place("bottle-return", -5.6, -4.5, 0.3, 1.2);

  // shelf clusters with goods
  for (let r = 0; r < 3; r++) {
    const z = -2.6 + r * 2.2;
    place(r === 1 ? "shelf-bags" : "shelf-boxes", 0.4, z, 0, 1.15);
    place("shelf-boxes", 2.6, z, 0, 1.15);
    place(r === 2 ? "shelf-bags" : "shelf-boxes", 4.8, z, 0, 1.15);
  }
  place("shelf-end", 5.9, -1.5, Math.PI / 2, 1.0);
  place("display-fruit", 1.6, 4.0, 0.25, 0.95);
  place("display-bread", 3.8, 4.2, -0.15, 0.95);

  // checkout lane row, angled like the reference
  place("cash-register", -4.6, 1.4, Math.PI / 2, 0.85);
  place("cash-register", -2.8, 0.4, Math.PI / 2, 0.85);
  place("cash-register", -1.0, -0.6, Math.PI / 2, 0.85);

  // entry gates + baskets near the open corner
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

  // edge data centre compound pieces
  const byName = { ...plantByName, van };
  towerNames.forEach((n, i) => {
    if (!byName[n]) byName[n] = towerModels[i];
  });
  byName["market-fence"] = market.fence;
  byName["rack"] = market["freezers-standing"];

  // server-rack aisles on the pad — standing cabinets in tight rows
  for (let row = 0; row < 2; row++) {
    for (let k = 0; k < 4; k++) {
      REGISTRY.stationSpots.push({
        name: "rack",
        x: CORE_POS.x - 6.6 + k * 2.0,
        z: CORE_POS.z + 3.4 - row * 1.9,
        rot: Math.PI / 2,
        h: 1.35,
        foot: 1.9,
      });
    }
  }
  REGISTRY.stationSpots.forEach(({ name, x, z, rot, h, foot }) => {
    const model = byName[name];
    if (!model) return;
    const wrap = new THREE.Group();
    const inst = model.clone(true);
    fitToHeight(inst, h, foot ?? 9);
    wrap.add(inst);
    wrap.position.set(x, name === "market-fence" || name === "van" ? 0 : 0.22, z);
    wrap.rotation.y = rot;
    scene.add(wrap);
  });
}

/* ---------- tilt-shift blur pass (miniature illusion) ---------- */

const TiltShiftShader = {
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uFocusY: { value: 0.52 },
    uAmount: { value: 1.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uFocusY;
    uniform float uAmount;
    varying vec2 vUv;
    void main() {
      float band = abs(vUv.y - uFocusY);
      float blur = smoothstep(0.14, 0.52, band) * uAmount;
      vec2 px = blur * 3.4 / uResolution;
      vec4 sum = texture2D(tDiffuse, vUv) * 0.227027;
      sum += texture2D(tDiffuse, vUv + vec2(px.x * 1.3846, px.y * 0.5)) * 0.3162162;
      sum += texture2D(tDiffuse, vUv - vec2(px.x * 1.3846, px.y * 0.5)) * 0.3162162;
      sum += texture2D(tDiffuse, vUv + vec2(px.x * 0.7, px.y * 3.2307)) * 0.0702703;
      sum += texture2D(tDiffuse, vUv - vec2(px.x * 0.7, px.y * 3.2307)) * 0.0702703;
      gl_FragColor = sum;
    }
  `,
};

/* ---------- experience ---------- */

export function createExperience(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
  } catch (e) {
    return null;
  }

  // deterministic rng so the diorama is stable between visits
  let rngState = 4242;
  const rng = () => {
    rngState = (rngState * 16807) % 2147483647;
    return (rngState - 1) / 2147483646;
  };

  const isMobile = window.innerWidth < 880;
  const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 1.6);
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.paper);
  scene.fog = new THREE.Fog(C.paper, 95, 235);

  const camera = new THREE.PerspectiveCamera(
    28,
    window.innerWidth / window.innerHeight,
    0.1,
    500
  );

  // studio environment light — soft light from everywhere, like a product shot
  const bootFlags = new URLSearchParams(window.location.search);
  if (!bootFlags.has("noenv")) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
  }

  // high-key clay lighting
  scene.add(new THREE.HemisphereLight(0xfff8ec, 0xddccb4, 0.55));
  const sun = new THREE.DirectionalLight(0xfff3e0, 1.45);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70;
  sun.shadow.camera.bottom = -70;
  sun.shadow.camera.near = 5;
  sun.shadow.camera.far = 180;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.add(sun.target);

  // world
  const curve = makePathCurve();
  buildGround(scene, rng);
  const city = buildCity(scene, curve, rng);
  const plant = buildPlant(scene, rng);
  const evalGrid = buildEvalGrid(scene, curve, rng);
  const station = buildStation(scene, rng);
  const signal = buildSignal(scene, curve);
  const dots = buildDots(scene, curve);
  const trucks = buildTrucks(scene, curve);
  enhanceWithModels(scene).catch((e) =>
    console.warn("Kenney models unavailable, keeping primitives:", e?.message || e)
  );

  // post chain: AO grounds the clay, tilt-shift sells the miniature
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(dpr);
  composer.addPass(new RenderPass(scene, camera));
  const flags = new URLSearchParams(window.location.search);
  let gtao = null;
  if (!isMobile && !flags.has("noao")) {
    // AO at half resolution — the soft clay look hides it completely
    gtao = new GTAOPass(
      scene,
      camera,
      Math.floor(window.innerWidth / 2),
      Math.floor(window.innerHeight / 2)
    );
    gtao.updateGtaoMaterial({
      radius: 0.55,
      distanceExponent: 1.6,
      thickness: 1.2,
      scale: 1.5,
      samples: 8,
    });
    composer.addPass(gtao);
  }
  const tilt = new ShaderPass(TiltShiftShader);
  tilt.uniforms.uResolution.value.set(
    window.innerWidth * dpr,
    window.innerHeight * dpr
  );
  if (!flags.has("notilt")) composer.addPass(tilt);
  composer.addPass(new OutputPass());
  if (gtao) gtao.setSize(Math.floor(window.innerWidth / 2), Math.floor(window.innerHeight / 2));

  // state
  const state = {
    progress: 0,
    targetProgress: 0,
    mouse: new THREE.Vector2(),
    mouseTarget: new THREE.Vector2(),
    paused: false,
    reduced: false,
  };

  const focus = new THREE.Vector3();
  const headPos = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const lookPos = new THREE.Vector3();
  const tangent = new THREE.Vector3();

  // adaptive quality: if early frames run slow, shed the AO pass
  let frameCount = 0;
  let slowFrames = 0;
  let lastNow = 0;

  window.addEventListener("pointermove", (e) => {
    state.mouseTarget.set(
      (e.clientX / window.innerWidth) * 2 - 1,
      (e.clientY / window.innerHeight) * 2 - 1
    );
  });

  function update(t) {
    if (state.paused) return;

    const now = performance.now();
    if (lastNow && gtao && frameCount < 240) {
      frameCount++;
      if (now - lastNow > 26) slowFrames++;
      if (frameCount === 240 && slowFrames > 120) {
        composer.removePass(gtao);
        gtao.dispose?.();
        gtao = null;
      }
    }
    lastNow = now;

    const lerpAmt = state.reduced ? 1 : 0.055;
    state.progress += (state.targetProgress - state.progress) * lerpAmt;
    state.mouse.lerp(state.mouseTarget, 0.06);

    const p = THREE.MathUtils.clamp(state.progress, 0, 1);
    const pc = Math.min(p * 0.96, 0.96);
    const ph = Math.min(pc + 0.045, 0.999);

    const heroAmt = 1 - THREE.MathUtils.smoothstep(p, 0, 0.06);
    const endAmt = THREE.MathUtils.smoothstep(p, 0.95, 1);

    curve.getPointAt(pc, focus);
    curve.getTangentAt(pc, tangent);
    curve.getPointAt(ph, headPos);

    // world-fixed azimuth with one slow, even drift across the whole
    // journey — no tangent coupling, so the camera never whip-turns
    const az =
      -0.78 +
      pc * 1.05 +
      Math.sin(t * 0.1) * 0.03 * heroAmt +
      state.mouse.x * 0.05;
    const radius = 38 + heroAmt * 10 - endAmt * 16;
    const height = 62 + heroAmt * 20 - endAmt * 30 - state.mouse.y * 2.4;

    camPos.set(
      focus.x + Math.sin(az) * radius,
      height,
      focus.z + Math.cos(az) * radius
    );

    lookPos.copy(focus).addScaledVector(tangent, 7);
    // during the hero, tilt up so the town settles into the lower frame
    lookPos.y += heroAmt * 8;
    lookPos.lerp(CORE_POS, endAmt);

    if (endAmt > 0) {
      const oa = az + t * 0.05 * endAmt;
      camPos.x = THREE.MathUtils.lerp(camPos.x, CORE_POS.x + Math.sin(oa) * 25, endAmt);
      camPos.z = THREE.MathUtils.lerp(camPos.z, CORE_POS.z + Math.cos(oa) * 25, endAmt);
    }

    // keep the diorama clear of the text column: shift the look target
    // screen-left so the scene composes into the right two-thirds
    if (window.innerWidth > 880) {
      const dirX = lookPos.x - camPos.x;
      const dirZ = lookPos.z - camPos.z;
      const len = Math.hypot(dirX, dirZ) || 1;
      // camera-right on the ground plane = (−dirZ, dirX) / len
      const shift = -(7 + heroAmt * 2.5) * (1 - endAmt * 0.6);
      lookPos.x += (-dirZ / len) * shift;
      lookPos.z += (dirX / len) * shift;
    }

    camera.position.copy(camPos);
    camera.lookAt(lookPos);

    sun.position.set(focus.x + 34, 50, focus.z + 24);
    sun.target.position.copy(focus);

    signal.uniforms.uHead.value = ph;
    signal.uniforms.uTime.value = t;
    signal.bead.position.copy(headPos);
    signal.bead.position.y = 0.32 + Math.sin(t * 4.4) * 0.05;
    signal.glow.position.set(headPos.x, 0.09, headPos.z);
    const gp = 1 + Math.sin(t * 3.6) * 0.12;
    signal.glow.scale.setScalar(gp);
    // at the end the bead settles onto the docking pad like a beacon
    const arrive = THREE.MathUtils.smoothstep(p, 0.97, 1);
    signal.glow.material.opacity = 1 - arrive * 0.6;

    dots.mat.uniforms.uHead.value = ph;

    city.update(t);
    plant.update(t);
    evalGrid.update(t, ph);
    station.update(t);
    trucks.update(t);

    if (flags.has("direct")) renderer.render(scene, camera);
    else composer.render();
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    if (gtao) gtao.setSize(Math.floor(w / 2), Math.floor(h / 2));
    tilt.uniforms.uResolution.value.set(w * dpr, h * dpr);
  }
  window.addEventListener("resize", resize);

  return {
    update,
    resize,
    setProgress(v) {
      state.targetProgress = v;
    },
    setPaused(v) {
      state.paused = v;
    },
    setReduced(v) {
      state.reduced = v;
    },
    renderer,
  };
}
