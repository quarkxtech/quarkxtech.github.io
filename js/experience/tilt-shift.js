/* Copyright (c) 2026 QuarkX Sdn. Bhd. (202501056786 / 1658192-K). All rights reserved. */

/*
 * Tilt-shift blur pass, the effect that sells the miniature illusion.
 *
 * A horizontal band of the frame stays sharp and everything above and below it
 * blurs out, which is what the eye reads as a very shallow depth of field and
 * therefore as a very small subject.
 */

import * as THREE from "three";

/**
 * Shader definition for a banded blur, in the shape ShaderPass expects.
 *
 * `uFocusY` sits slightly below centre because the diorama is composed into the
 * lower two thirds of the frame. The blur uses a five-tap gaussian on a
 * separable-style offset pattern, which is cheap enough to run every frame at
 * full resolution and soft enough that the clay never shows banding.
 *
 * @type {{uniforms: object, vertexShader: string, fragmentShader: string}}
 */
export const TiltShiftShader = {
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
