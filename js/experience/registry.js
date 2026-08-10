/* Copyright (c) 2026 QuarkX Sdn. Bhd. (202501056786 / 1658192-K). All rights reserved. */

/*
 * Swap registry shared between the zone builders and the model kit.
 *
 * Zones are built from primitives immediately so the diorama is complete on the
 * first frame. They record here what they put down, and the model kit later
 * replaces those stand-ins with the downloaded Kenney models. If the models
 * never arrive, the primitives simply stay.
 */

/**
 * Creates an empty swap registry for one experience instance.
 *
 * @returns {{
 *   towers: Array<{group: import("three").Group, spec: object}>,
 *   chimneys: Array<{group: import("three").Group, x: number, z: number, rot: number}>,
 *   trucks: Array<{mesh: import("three").Group, offset: number, lat: number, speed: number, u: number}>,
 *   plantSpots: Array<object>,
 *   stationSpots: Array<object>,
 *   cityBlocks: {mesh: import("three").InstancedMesh, placements: Array<object>} | null
 * }} Registry with one bucket per swappable kind.
 */
export function createRegistry() {
  return {
    towers: [],
    chimneys: [],
    trucks: [],
    plantSpots: [],
    stationSpots: [],
    cityBlocks: null,
  };
}
