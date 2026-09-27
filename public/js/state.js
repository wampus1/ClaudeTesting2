// The character sheet and the narrator's state tags. Each apply* returns short notices for the story log.
// No DOM here: the server imports this module too.

import { SLOTS } from './character.js';
import { fits, newId, place, stowLoose } from './grid.js';
import { START_CLOCK, clockParts, formatDuration, parseElapsed } from './clock.js';

const STAT_ALIASES = {
  hp: 'health', health: 'health', life: 'health',
  maxhealth: 'maxHealth', max_health: 'maxHealth', maxhp: 'maxHealth',
  hunger: 'hunger', sanity: 'sanity',
  strength: 'strength', str: 'strength', agility: 'agility', agi: 'agility',
  endurance: 'endurance', wits: 'wits', presence: 'presence', luck: 'luck',
  coin: 'coin', coins: 'coin', copper: 'coin', coppers: 'coin', money: 'coin',
};

const STAT_LABELS = {
  health: 'Health', maxHealth: 'Max health', hunger: 'Hunger', sanity: 'Sanity', strength: 'Strength', agility: 'Agility',
  endurance: 'Endurance', wits: 'Wits', presence: 'Presence', luck: 'Luck', coin: 'Coin',
};

export const SLOT_KEYS = SLOTS.map((s) => s.key);
const GRID_FIELDS = ['x', 'y', 'rot'];

export const npcKey = (name) => String(name || '').trim().toLowerCase();
const toInt = (v) => {
  const n = parseInt(String(v ?? '').replace(/[^\d+-]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
};
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const stripGrid = (item) => Object.fromEntries(Object.entries(item).filter(([k]) => !GRID_FIELDS.includes(k)));

export function makeItem(name, fields = {}) {
  const item = { name: String(name).trim() };
  for (const [k, v] of Object.entries(fields)) {
    if (['name', 'id', 'x', 'y', 'rot', 'qty'].includes(k) || v === '' || v == null) continue;
    item[k] = String(v);
  }
  if (item.durability != null && item.maxDurability == null) item.maxDurability = item.durability;
  item.id = newId();
  item.qty = 1;
  return item;
}

function similarity(a, b) {
  a = npcKey(a);
  b = npcKey(b);
  if (!a || !b) return 0;
  if (a === b) return 3;
  if (a.includes(b) || b.includes(a)) return 2;
  // Otherwise require the same head noun ("stale bread" ~ "stale heel of bread"), never just a shared adjective.
  const head = (s) => s.split(/[^\p{L}\p{N}'-]+/u).filter((w) => w.length > 2).at(-1);
  return head(a) && head(a) === head(b) ? 1.5 : 0;
}

/** Finds a carried item by (fuzzy) name. Returns { where: 'pack'|'slot', index|slot, item }. */
export function findItem(state, name) {
  let best = null;
  let bestScore = 0;
  state.pack.forEach((item, index) => {
    const score = similarity(item.name, name);
    if (score > bestScore) [best, bestScore] = [{ where: 'pack', index, item }, score];
  });
  for (const slot of SLOT_KEYS) {
    const item = state.equipment[slot];
    if (!item) continue;
    const score = similarity(item.name, name);
    if (score > bestScore) [best, bestScore] = [{ where: 'slot', slot, item }, score];
  }
  return best;
}

function removeOne(state, found) {
  if (found.where === 'pack') {
    const item = state.pack[found.index];
    if ((item.qty || 1) > 1) item.qty -= 1;
    else state.pack.splice(found.index, 1);
    stowLoose(state.pack);
  } else {
    state.equipment[found.slot] = null;
  }
}

const stackable = (item) => !item.durability && !/artifact|relic|gadget|weapon|armor|clothing/i.test(item.type || '');

/** Adds an item to the pack: onto a matching stack, into the first free spot, or loose if full. Returns false if loose. */
export function addToPack(state, item) {
  const same = stackable(item) && state.pack.find((p) => npcKey(p.name) === npcKey(item.name) && p.type === item.type && stackable(p));
  if (same) {
    same.qty = (same.qty || 1) + (item.qty || 1);
    return true;
  }
  const packed = { ...stripGrid(item), id: item.id || newId(), qty: item.qty || 1 };
  const fit = place(state.pack, packed);
  state.pack.push(packed);
  return fit;
}

/* ---------------------------------------------------------------- equipment */

/** Which kind of slot an item belongs in: weapon, head, body, feet, trinket, gadget, relic, or null. */
export function slotFamily(item) {
  const name = npcKey(item?.name);
  const type = npcKey(item?.type);
  if (type === 'artifact' || type === 'relic') return 'relic';
  if (type === 'gadget' || /\b(pocket ?watch|watch|timepiece|compass|spyglass|telescope|lens|clockwork|lockpicks?|picklock|tinderbox|whistle|sextant|lodestone)\b/.test(name)) return 'gadget';
  if (type === 'weapon') return 'weapon';
  if (/\b(helm|helmet|hood|hat|cap|coif|cowl|crown|skullcap)\b/.test(name)) return 'head';
  if (/\b(boots?|shoes?|clogs?|sandals?|wraps|greaves|feet)\b/.test(name)) return 'feet';
  if (/\b(ring|amulet|medallion|pendant|charm|talisman|necklace|locket|brooch|knucklebone|lock of hair)\b/.test(name)) return 'trinket';
  if (type === 'armor' || type === 'clothing') return 'body';
  return null;
}

/** Can `item` go in `slot`? Hands can hold anything that isn't worn. */
export function slotAccepts(slot, item) {
  const family = slotFamily(item);
  if (slot === 'weapon') return !['head', 'body', 'feet'].includes(family);
  if (slot === 'gadget1' || slot === 'gadget2') return family === 'gadget';
  return family === slot;
}

/** Resolves a slot name from the narrator ("gadget", "hand") or the item itself to an actual slot key. */
export function targetSlot(state, item, hint) {
  const h = npcKey(hint).replace(/\s+/g, '');
  const family = ['hand', 'hands', 'mainhand', 'held'].includes(h) ? 'weapon' : SLOT_KEYS.includes(h) ? h : ['gadget', 'relic', 'weapon', 'head', 'body', 'feet', 'trinket'].includes(h) ? h : slotFamily(item) || 'weapon';
  if (family === 'gadget') return !state.equipment.gadget1 ? 'gadget1' : !state.equipment.gadget2 ? 'gadget2' : 'gadget1';
  return family;
}

/**
 * Moves `item` (from the pack or another slot) into `slot`. Whatever was there goes to the
 * pack, at `displacedAt` if it fits there, otherwise the first free spot.
 */
export function equip(state, item, slot, displacedAt = null) {
  let equipped;
  const index = state.pack.indexOf(item);
  if (index !== -1) {
    if ((item.qty || 1) > 1) {
      item.qty -= 1;
      equipped = { ...stripGrid(item), id: newId(), qty: 1 };
    } else {
      state.pack.splice(index, 1);
      equipped = { ...stripGrid(item), qty: 1 };
    }
  } else {
    const from = SLOT_KEYS.find((k) => state.equipment[k] === item);
    if (!from) return false;
    state.equipment[from] = null;
    equipped = item;
  }
  const previous = state.equipment[slot];
  state.equipment[slot] = equipped;
  if (previous) {
    const packed = { ...stripGrid(previous), rot: false };
    if (displacedAt && fits(state.pack, packed, displacedAt.x, displacedAt.y, displacedAt.rot)) Object.assign(packed, displacedAt);
    else place(state.pack, packed);
    state.pack.push(packed);
  }
  stowLoose(state.pack);
  return true;
}

/** Takes the item out of `slot` into the pack, at `at` if it fits there. */
export function unequip(state, slot, at = null) {
  const item = state.equipment[slot];
  if (!item) return false;
  state.equipment[slot] = null;
  const packed = { ...stripGrid(item), rot: false };
  if (at && fits(state.pack, packed, at.x, at.y, at.rot)) Object.assign(packed, at);
  else place(state.pack, packed);
  state.pack.push(packed);
  return true;
}

/** Only an equipped pocket watch tells the hour. */
export function hasWatch(state) {
  return Object.values(state?.equipment || {}).some((item) => item && /\b(pocket ?watch|watch|timepiece|chronometer|clock)\b/i.test(item.name || ''));
}

/* ---------------------------------------------------------------- tags */

function applyGain(state, tag) {
  // "[Gain: "12 coppers"]" is money, not an item.
  const money = tag.value.match(/^\s*(\d+)\s*(coppers?|coins?|crowns?|pennies)\s*$/i);
  if (money) return applyStat(state, { value: 'coin', fields: { change: `+${money[1]}` } });
  const item = makeItem(tag.value, tag.fields);
  const fit = addToPack(state, item);
  return [{ kind: 'gain', item: item.name, text: fit ? `${cap(item.name)} taken` : `${cap(item.name)} carried loose (no room)` }];
}

function applyLose(state, tag) {
  const found = findItem(state, tag.value);
  if (!found) return [];
  removeOne(state, found);
  return [{ kind: 'lose', text: `${cap(found.item.name)} lost` }];
}

function applyEquip(state, tag) {
  const found = findItem(state, tag.value);
  if (!found) return [];
  const slot = targetSlot(state, found.item, tag.fields.slot);
  if (state.equipment[slot] === found.item) return [];
  equip(state, found.item, slot);
  return [{ kind: 'gain', text: `${cap(found.item.name)} equipped` }];
}

function applyUnequip(state, tag) {
  const found = findItem(state, tag.value);
  if (!found || found.where !== 'slot') return [];
  unequip(state, found.slot);
  return [{ kind: 'neutral', text: `${cap(found.item.name)} stowed` }];
}

function applyStat(state, tag) {
  const stat = STAT_ALIASES[npcKey(tag.value).replace(/\s+/g, '')] || STAT_ALIASES[npcKey(tag.value)];
  if (!stat) return [];
  const s = state.stats;
  const before = s[stat] ?? 0;
  const set = toInt(tag.fields.value ?? tag.fields.set);
  const change = toInt(tag.fields.change ?? tag.fields.amount ?? tag.fields.delta);
  let after = set != null ? set : before + (change ?? 0);

  if (stat === 'health') after = clamp(after, 0, s.maxHealth);
  else if (stat === 'maxHealth') after = Math.max(1, after);
  else if (stat === 'hunger' || stat === 'sanity') after = clamp(after, 0, 10);
  else if (stat === 'coin') after = Math.max(0, after);
  else after = clamp(after, 1, 10);

  s[stat] = after;
  if (stat === 'maxHealth') s.health = Math.min(s.health, after);
  const delta = after - before;
  if (!delta) return [];
  // For hunger, going up is bad; for everything else, going up is good.
  const good = stat === 'hunger' ? delta < 0 : delta > 0;
  const unit = stat === 'coin' ? ` copper${Math.abs(delta) === 1 ? '' : 's'}` : '';
  return [{ kind: good ? 'up' : 'down', stat, delta, text: `${STAT_LABELS[stat]} ${delta > 0 ? '+' : '−'}${Math.abs(delta)}${unit}` }];
}

function applyWear(state, tag) {
  const found = findItem(state, tag.value);
  if (!found) return [];
  const item = found.item;
  const current = toInt(item.durability);
  if (current == null) return [];
  const change = toInt(tag.fields.change ?? tag.fields.amount) ?? -1;
  const next = Math.max(0, current + change);
  item.durability = String(next);
  if (next > 0) return [{ kind: 'down', text: `${cap(item.name)} wears (${next}/${item.maxDurability ?? current})` }];
  removeOne(state, found);
  return [{ kind: 'lose', broke: true, text: `${cap(item.name)} breaks` }];
}

/** Advances the clock. Time notices are only shown to a player with a pocket watch. */
function applyElapsed(state, tag) {
  const minutes = parseElapsed(tag.value);
  const before = clockParts(state.clock);
  state.clock = (state.clock ?? START_CLOCK) + minutes;
  const after = clockParts(state.clock);
  const notices = [{ kind: 'elapsed', minutes, text: `${formatDuration(minutes)} ${minutes === 1 || minutes === 60 ? 'passes' : 'pass'}` }];
  if (before.gateOpen !== after.gateOpen) {
    notices.push({ kind: 'gate', open: after.gateOpen, text: after.gateOpen ? 'The gate opens' : 'The gate is sealed' });
  }
  if (after.day > before.day) notices.push({ kind: 'dawn', text: `Day ${after.day} begins` });
  return notices;
}

function applyLocation(state, tag) {
  const place = tag.value.trim();
  if (!place || place === state.location) return [];
  state.location = place;
  return [{ kind: 'place', text: place }];
}

function applyDeliver(state, tag) {
  const found = findItem(state, tag.value);
  if (found) removeOne(state, found);
  state.artifactsDelivered += 1;
  return [{ kind: 'deliver', text: `Artifact delivered — ${state.artifactsDelivered} of ${state.artifactGoal}` }];
}

function applyNpc(state, tag, turn) {
  const key = npcKey(tag.value);
  if (!key) return [];
  const previous = state.npcs[key] || { firstSeen: turn };
  const npc = { ...previous, ...tag.fields, name: tag.value.trim(), lastSeen: turn };
  // Remember the highest health seen so wounds can be shown against it.
  const peak = Math.max(toInt(previous.peakHealth) ?? 0, toInt(tag.fields.health) ?? 0);
  if (peak > 0) npc.peakHealth = String(peak);
  state.npcs[key] = npc;
  const turnedHostile = alignmentOf(npc) === 'hostile' && alignmentOf(previous) !== 'hostile' && !isDead(npc);
  return turnedHostile ? [{ kind: 'hostile', silent: true, text: npc.name }] : [];
}

/** Applies one parsed tag to `state` in place. */
export function applyTag(state, tag) {
  switch (tag.kind) {
    case 'npc': return applyNpc(state, tag, state.turn);
    case 'gain': return applyGain(state, tag);
    case 'lose': return applyLose(state, tag);
    case 'equip': return applyEquip(state, tag);
    case 'unequip': return applyUnequip(state, tag);
    case 'stat': return applyStat(state, tag);
    case 'wear': return applyWear(state, tag);
    case 'elapsed': return applyElapsed(state, tag);
    case 'location': return applyLocation(state, tag);
    case 'deliver': return applyDeliver(state, tag);
    case 'end': {
      state.ended = /free/i.test(tag.value) ? 'freedom' : 'death';
      return [];
    }
    // [Time: ...] came from older saves; the clock is the game's now.
    default: return [];
  }
}

export function alignmentOf(data) {
  const a = npcKey(data?.alignment);
  if (/hostile|enemy|aggress|red/.test(a)) return 'hostile';
  if (/peace|friend|ally|green|kind/.test(a)) return 'peaceful';
  return 'neutral';
}

export function isDead(data) {
  const hp = toInt(data?.health);
  return hp != null && hp <= 0;
}

/** Brings a character sheet from an older save up to date: new slots, item ids, grid positions, the clock. */
export function migrateState(state) {
  for (const { key } of SLOTS) if (!(key in state.equipment)) state.equipment[key] = null;
  for (const item of Object.values(state.equipment)) if (item && !item.id) item.id = newId();
  const pack = [];
  for (const item of state.pack || []) {
    if (!item.id) item.id = newId();
    if (item.x === undefined) place(pack, item);
    pack.push(item);
  }
  state.pack = pack;
  if (state.clock == null) {
    const hour = { dawn: 6 * 60, day: 12 * 60, dusk: 19 * 60 + 30, night: 22 * 60 }[state.time] ?? START_CLOCK;
    state.clock = ((state.day || 1) - 1) * 24 * 60 + hour;
  }
  delete state.day;
  delete state.time;
  return state;
}
