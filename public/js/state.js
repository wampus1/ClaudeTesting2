// Applies the narrator's state tags to the character sheet.
// Each apply* returns a list of short notices for the story log.

import { SLOTS } from './character.js';

const STAT_ALIASES = {
  hp: 'health',
  health: 'health',
  life: 'health',
  maxhealth: 'maxHealth',
  max_health: 'maxHealth',
  maxhp: 'maxHealth',
  hunger: 'hunger',
  sanity: 'sanity',
  strength: 'strength',
  str: 'strength',
  agility: 'agility',
  agi: 'agility',
  endurance: 'endurance',
  wits: 'wits',
  presence: 'presence',
  luck: 'luck',
  coin: 'coin',
  coins: 'coin',
  copper: 'coin',
  coppers: 'coin',
  money: 'coin',
};

const STAT_LABELS = {
  health: 'Health',
  maxHealth: 'Max health',
  hunger: 'Hunger',
  sanity: 'Sanity',
  strength: 'Strength',
  agility: 'Agility',
  endurance: 'Endurance',
  wits: 'Wits',
  presence: 'Presence',
  luck: 'Luck',
  coin: 'Coin',
};

const TIMES = ['dawn', 'day', 'dusk', 'night'];
const SLOT_KEYS = SLOTS.map((s) => s.key);

export const npcKey = (name) => String(name || '').trim().toLowerCase();
const toInt = (v) => {
  const n = parseInt(String(v ?? '').replace(/[^\d+-]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
};
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function makeItem(name, fields = {}) {
  const item = { name: String(name).trim() };
  for (const [k, v] of Object.entries(fields)) {
    if (k === 'name' || v === '' || v == null) continue;
    item[k] = String(v);
  }
  if (item.durability != null && item.maxDurability == null) item.maxDurability = item.durability;
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
  } else {
    state.equipment[found.slot] = null;
  }
}

function addToPack(state, item) {
  const same = state.pack.find((p) => npcKey(p.name) === npcKey(item.name) && p.type === item.type && !p.durability);
  if (same && !item.durability) same.qty = (same.qty || 1) + 1;
  else state.pack.push({ ...item, qty: item.qty || 1 });
}

export function inferSlot(item, hint) {
  const h = npcKey(hint);
  if (SLOT_KEYS.includes(h)) return h;
  if (['hand', 'hands', 'main hand', 'weapon'].includes(h)) return 'weapon';
  const name = npcKey(item.name);
  const type = npcKey(item.type);
  if (type === 'weapon') return 'weapon';
  if (/\b(helm|helmet|hood|hat|cap|coif|cowl|mask|crown|skullcap)\b/.test(name) && type !== 'artifact') return 'head';
  if (/\b(boots?|shoes?|clogs?|sandals?|wraps|greaves)\b/.test(name)) return 'feet';
  if (/\b(ring|amulet|medallion|pendant|charm|talisman|necklace|locket|brooch)\b/.test(name)) return 'trinket';
  if (type === 'armor' || type === 'clothing') return 'body';
  return null;
}

function applyGain(state, tag) {
  const item = makeItem(tag.value, tag.fields);
  addToPack(state, item);
  return [{ kind: 'gain', text: `${cap(item.name)} taken` }];
}

function applyLose(state, tag) {
  const found = findItem(state, tag.value);
  if (!found) return [];
  removeOne(state, found);
  return [{ kind: 'lose', text: `${cap(found.item.name)} lost` }];
}

function applyEquip(state, tag) {
  const found = findItem(state, tag.value);
  if (!found || found.where === 'slot') return [];
  const slot = inferSlot(found.item, tag.fields.slot) || 'trinket';
  const item = { ...found.item, qty: 1 };
  removeOne(state, found);
  const previous = state.equipment[slot];
  if (previous) addToPack(state, previous);
  state.equipment[slot] = item;
  return [{ kind: 'gain', text: `${cap(item.name)} equipped` }];
}

function applyUnequip(state, tag) {
  const found = findItem(state, tag.value);
  if (!found || found.where !== 'slot') return [];
  state.equipment[found.slot] = null;
  addToPack(state, found.item);
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
  return [{ kind: 'lose', text: `${cap(item.name)} breaks` }];
}

function applyTime(state, tag) {
  const time = npcKey(tag.value).replace(/[^a-z]/g, '');
  const next = TIMES.includes(time) ? time : time === 'morning' ? 'dawn' : time === 'evening' ? 'dusk' : time === 'midnight' ? 'night' : null;
  if (!next || next === state.time) return [];
  const previous = state.time;
  if ((previous === 'night' || previous === 'dusk') && (next === 'dawn' || next === 'day')) state.day += 1;
  state.time = next;
  const text = {
    dawn: `Dawn of day ${state.day}`,
    day: 'Day — the gate stands open',
    dusk: 'Dusk gathers',
    night: 'Night — the gate is sealed',
  }[next];
  return [{ kind: 'time', text }];
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
  return [];
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
    case 'time': return applyTime(state, tag);
    case 'location': return applyLocation(state, tag);
    case 'deliver': return applyDeliver(state, tag);
    case 'end': {
      const ending = /free/i.test(tag.value) ? 'freedom' : 'death';
      state.ended = ending;
      return [];
    }
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
