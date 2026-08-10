/* Copyright (c) 2026 QuarkX Sdn. Bhd. (202501056786 / 1658192-K). All rights reserved. */

/*
 * Material helpers for the clay look.
 *
 * Responsibilities:
 *   - one standard material recipe so every surface shades consistently
 *   - shadow flag helper, applied often enough to be worth naming
 */

import * as THREE from "three";

/**
 * Creates the standard unpolished clay material.
 *
 * Roughness stays near 1 and metalness at 0 so the environment light reads as
 * diffuse bounce rather than reflection, which is what sells the miniature.
 *
 * @param {number|THREE.Color} color Base colour.
 * @param {number} [rough=0.96] Roughness, lowered slightly for roof and tile faces.
 * @returns {THREE.MeshStandardMaterial} Material ready to share between meshes.
 */
export function clayMat(color, rough = 0.96) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
}

/**
 * Turns shadow casting and receiving on for a mesh and returns it.
 *
 * @param {THREE.Mesh} mesh Mesh to flag.
 * @param {boolean} [cast=true] Whether the mesh casts shadows.
 * @param {boolean} [receive=true] Whether the mesh receives shadows.
 * @returns {THREE.Mesh} The same mesh, for inline use.
 */
export function shadowed(mesh, cast = true, receive = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}
