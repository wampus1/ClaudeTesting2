// The pack is a grid. Every item takes a footprint of cells depending on what it is,
// and may be rotated a quarter turn. Pure logic, no DOM.

import { itemIconKey } from './icons.js';

export const COLS = 10;
export const ROWS = 6;

// Footprint [w, h] by icon, and how the square hand-drawn icon is fitted into a longer box:
// 'diag' icons run corner to corner and are turned to lie flat, 'vert' ones are turned on
// their side, 'wide'/'tall' ones are only scaled. The last number is the scale.
const SHAPES = {
  sword: [3, 1, 'diag', 2.3], spear: [4, 1, 'diag', 3.1], club: [3, 1, 'diag', 2.3], bone: [2, 1, 'diag', 1.8],
  dagger: [2, 1, 'vert', 2.0], spyglass: [3, 1, 'wide', 3.0], bread: [2, 1, 'wide', 1.7], meat: [2, 1, 'wide', 1.6],
  torch: [1, 2, 'tall', 1.9], lantern: [1, 2, 'tall', 1.8], idol: [1, 2, 'tall', 1.8], book: [1, 2, 'tall', 1.4],
  axe: [2, 2], hammer: [2, 2], mace: [2, 2], pick: [2, 2], chain: [2, 2], rope: [2, 2], tunic: [2, 2],
  shield: [2, 2], mask: [2, 2], casket: [2, 2], sack: [2, 2],
};

export function itemShape(item) {
  const [w, h, orient, scale] = SHAPES[itemIconKey(item)] || [1, 1];
  return { w, h, orient: orient || null, scale: scale || 1 };
}

/** Width and height in cells, after rotation. */
export function footprint(item) {
  const { w, h } = itemShape(item);
  return item.rot ? { w: h, h: w } : { w, h };
}

export function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** Which cells are taken, ignoring `ignore` (the item being moved). */
function occupancy(pack, ignore) {
  const grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
  for (const item of pack) {
    if (item === ignore || item.x == null) continue;
    const { w, h } = footprint(item);
    for (let y = item.y; y < item.y + h && y < ROWS; y++) {
      for (let x = item.x; x < item.x + w && x < COLS; x++) grid[y][x] = item;
    }
  }
  return grid;
}

/** Can `item` sit with its top-left corner at (x, y), rotated or not? */
export function fits(pack, item, x, y, rot = Boolean(item.rot), ignore = item) {
  const { w, h } = footprint({ ...item, rot });
  if (x < 0 || y < 0 || x + w > COLS || y + h > ROWS) return false;
  const grid = occupancy(pack, ignore);
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) if (grid[yy][xx]) return false;
  }
  return true;
}

/** The first free spot scanning row by row, trying the item's natural orientation first. */
export function findSpot(pack, item, ignore = item) {
  const shape = itemShape(item);
  const orientations = shape.w === shape.h ? [false] : [Boolean(item.rot), !item.rot];
  for (const rot of orientations) {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) if (fits(pack, item, x, y, rot, ignore)) return { x, y, rot };
    }
  }
  return null;
}

/** Puts `item` at the first free spot, or leaves it loose (x = null) when the pack is full. Returns true if it fit. */
export function place(pack, item) {
  const spot = findSpot(pack, item);
  if (spot) Object.assign(item, spot);
  else Object.assign(item, { x: null, y: null, rot: false });
  return Boolean(spot);
}

/** Tries to fit loose items into whatever space has opened up. */
export function stowLoose(pack) {
  for (const item of pack) if (item.x == null) place(pack, item);
}
