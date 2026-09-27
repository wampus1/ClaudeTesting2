// Random character generation: the condemned prisoner's crime, trade, attributes and gear.

import { START_CLOCK } from './clock.js';
import { newId, place } from './grid.js';

export const ARTIFACT_GOAL = 5;
export const ATTRIBUTES = [
  { key: 'strength', label: 'Strength', blurb: 'Might of arm and back' },
  { key: 'agility', label: 'Agility', blurb: 'Quickness, balance, stealth' },
  { key: 'endurance', label: 'Endurance', blurb: 'Toughness against wounds and want' },
  { key: 'wits', label: 'Wits', blurb: 'Cunning, perception, memory' },
  { key: 'presence', label: 'Presence', blurb: 'Nerve, charm, and menace' },
  { key: 'luck', label: 'Luck', blurb: "Fortune's rare favour" },
];
export const SLOTS = [
  { key: 'weapon', label: 'Hand' },
  { key: 'head', label: 'Head' },
  { key: 'body', label: 'Body' },
  { key: 'feet', label: 'Feet' },
  { key: 'trinket', label: 'Trinket' },
  { key: 'gadget1', label: 'Gadget', special: true },
  { key: 'gadget2', label: 'Gadget', special: true },
  { key: 'relic', label: 'Relic', special: true },
];

const NAMES = ['Wren', 'Aldric', 'Maud', 'Tobin', 'Isolde', 'Garrick', 'Edda', 'Fenn', 'Rowan', 'Cuthbert', 'Sabine', 'Osric', 'Brenna', 'Hale', 'Ysolde', 'Marek', 'Agnes', 'Corwin', 'Tamsin', 'Jory', 'Bertil', 'Nell'];

const CRIMES = [
  "poaching the Margrave's deer",
  'heresy against the Ember Church',
  'cutting purses at the harvest fair',
  'desertion from the levy',
  'the murder of a tax collector',
  "forging the royal seal",
  'robbing the graves of the gentry',
  'smuggling nightshade',
  'striking a knight in a tavern brawl',
  'setting fire to a tithe barn',
  'debts owed to the wrong lord',
  'singing a seditious song, loudly, in the wrong square',
  'horse theft',
  'witchcraft, on the word of a jealous neighbour',
];

const BACKGROUNDS = [
  { text: 'a ratcatcher from the river wards', bonus: 'agility' },
  { text: 'a disgraced squire', bonus: 'strength' },
  { text: "a hedge-witch's apprentice", bonus: 'wits' },
  { text: 'a failed novice of the Ember Church', bonus: 'presence' },
  { text: 'a tanner with ruined hands', bonus: 'endurance' },
  { text: 'a gambler who ran out of luck', bonus: 'luck' },
  { text: 'a sellsword without a company', bonus: 'strength' },
  { text: 'a street urchin grown tall', bonus: 'agility' },
  { text: 'a clerk who kept two sets of books', bonus: 'wits' },
  { text: 'a fisher from the salt marshes', bonus: 'endurance' },
  { text: 'a travelling player who played the wrong part', bonus: 'presence' },
  { text: "a stonemason's apprentice", bonus: 'strength' },
];

const WEAPONS = [
  { name: 'rusted shiv', type: 'weapon', damage: '2', durability: '5', value: '1', description: 'A sliver of iron filed to a point and bound in rag. Made in a cell, for a cell.' },
  { name: 'splintered cudgel', type: 'weapon', damage: '2', durability: '7', value: '1', description: 'A table leg, still bearing the ghost of its varnish, and a nail someone added later.' },
  { name: 'chipped hatchet', type: 'weapon', damage: '3', durability: '4', value: '3', description: 'The head wobbles on the haft. It will split kindling or a skull, but maybe not both.' },
  { name: 'length of chain', type: 'weapon', damage: '2', durability: '9', value: '2', description: 'Three feet of rusted links, heavy enough to hurt, long enough to reach.' },
  { name: 'bone knife', type: 'weapon', damage: '2', durability: '4', value: '1', description: 'Knapped from an ox femur. Sharper than it has any right to be.' },
  { name: 'bent pitchfork tine', type: 'weapon', damage: '2', durability: '6', value: '1', description: 'A single iron prong, hammered straight-ish, wrapped in twine for a grip.' },
];

const HEADGEAR = [
  { name: 'moth-eaten hood', type: 'clothing', defense: '0', value: '1', description: 'Grey wool, more hole than hood. It keeps the drips off, mostly.' },
  { name: 'dented pot helm', type: 'armor', defense: '1', durability: '6', value: '3', description: 'It was a cooking pot. Then it was a helmet. It still smells faintly of onions.' },
  { name: 'leather skullcap', type: 'armor', defense: '1', durability: '5', value: '2', description: 'Cracked and sweat-stained, laced tight under the chin.' },
];

const BODY = [
  { name: 'sackcloth tunic', type: 'clothing', defense: '0', value: '0', description: 'Prison issue. Scratchy, shapeless, and stamped with the Warden\'s mark.' },
  { name: 'threadbare gambeson', type: 'armor', defense: '2', durability: '6', value: '5', description: 'Quilted linen gone flat and grey. A few old sword-cuts have been darned shut.' },
  { name: 'flea-bitten jerkin', type: 'armor', defense: '1', durability: '5', value: '2', description: 'Stiff hide that was once a cow and is now mostly a home for fleas.' },
  { name: 'patched wool cloak', type: 'clothing', defense: '0', value: '2', description: 'Heavy, damp, and warmer than it looks. Patched with at least four other cloaks.' },
];

const FEET = [
  { name: 'rag-wrapped feet', type: 'clothing', defense: '0', value: '0', description: 'Strips of linen wound tight. Better than nothing, until they are wet.' },
  { name: 'cracked leather boots', type: 'clothing', defense: '0', durability: '6', value: '3', description: 'One sole flaps when you walk. Both leak.' },
  { name: 'wooden clogs', type: 'clothing', defense: '0', durability: '8', value: '1', description: 'Loud on stone. Very loud. Every step announces you.' },
];

const TRINKETS = [
  { name: "tarnished saint's medallion", type: 'valuable', value: '4', effect: 'steadies the nerves', description: "A saint whose name has been rubbed off by generations of worried thumbs." },
  { name: 'lucky knucklebone', type: 'valuable', value: '0', effect: 'luck, allegedly', description: 'You have rolled it a thousand times. It has never once come up the way you needed.' },
  { name: "dead man's ring", type: 'valuable', value: '6', description: 'Pewter, too big for any of your fingers. You took it off him; you tell yourself he did not mind.' },
  { name: 'lock of hair in twine', type: 'valuable', value: '0', description: "Someone's. You remember whose, most days." },
];

const PACK_ITEMS = [
  { name: 'stale heel of bread', type: 'food', value: '1', description: 'Hard as a roof tile. Chew it long enough and it remembers being bread.' },
  { name: 'tallow candle', type: 'light', uses: '4', value: '3', description: 'Smoky and stinking. Down there, worth more than a sword.' },
  { name: 'flint and steel', type: 'tool', durability: '10', value: '2', description: 'A chipped flint and a C-shaped striker. Sparks, if you are patient.' },
  { name: 'coil of fraying rope', type: 'tool', durability: '5', value: '2', description: 'Twenty feet of hemp, sound in places, rotten in others.' },
  { name: 'half-full waterskin', type: 'drink', uses: '3', value: '2', description: 'Tastes of leather and old rain.' },
  { name: 'rusted lockpick', type: 'tool', durability: '3', value: '3', description: 'Bent wire and a prayer.' },
  { name: 'roll of bandages', type: 'medicine', uses: '2', effect: 'staunches bleeding', value: '2', description: 'Grey linen, boiled at least once. Probably.' },
  { name: 'stub of chalk', type: 'tool', uses: '6', value: '0', description: 'For marking walls, so you can find your way back. Or so someone can find you.' },
  { name: 'strip of salt pork', type: 'food', value: '2', description: 'Leathery, grey, and so salty it hurts.' },
];

const POCKET_WATCH = { name: 'cracked pocket watch', type: 'gadget', effect: 'tells the hour', value: '12', description: 'Brass gone brown, the crystal starred with a crack. It still ticks, and down there that is worth more than gold.' };
const GADGETS = [
  { name: 'brass compass', type: 'gadget', effect: 'finds north, mostly', value: '8', description: 'The needle trembles and hunts, then settles. Underground it sometimes settles on things that are not north.' },
  { name: 'tin spyglass', type: 'gadget', effect: 'sees far in faint light', value: '10', description: 'Dented, the lens scratched, the leather grip gone greasy with other hands.' },
];

const d = (n) => 1 + Math.floor(Math.random() * n);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const clone = (item) => ({ ...item, ...(item.durability ? { maxDurability: item.durability } : {}), id: newId(), qty: 1 });

function sample(list, count) {
  const pool = [...list];
  const out = [];
  while (out.length < count && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}

export function randomName() {
  return pick(NAMES);
}

/** Rolls a fresh prisoner. Name and pronouns are chosen by the player. */
export function rollCharacter({ name, pronouns }) {
  const background = pick(BACKGROUNDS);
  const stats = {};
  for (const { key } of ATTRIBUTES) stats[key] = d(3) + d(3) + d(3);
  stats[background.bonus] = Math.min(10, stats[background.bonus] + 1);
  stats.maxHealth = 8 + stats.endurance;
  stats.health = stats.maxHealth;
  stats.hunger = 1 + d(3);
  stats.sanity = 6 + d(3);
  stats.coin = d(10) - 1;

  const equipment = {
    weapon: clone(pick(WEAPONS)),
    head: Math.random() < 0.5 ? clone(pick(HEADGEAR)) : null,
    body: clone(pick(BODY)),
    feet: clone(pick(FEET)),
    trinket: Math.random() < 0.65 ? clone(pick(TRINKETS)) : null,
    // Only a lucky few know the hour.
    gadget1: Math.random() < 0.35 ? clone(POCKET_WATCH) : null,
    gadget2: Math.random() < 0.2 ? clone(pick(GADGETS)) : null,
    relic: null,
  };
  const pack = [];
  for (const item of sample(PACK_ITEMS, 2 + d(2)).map(clone)) {
    place(pack, item);
    pack.push(item);
  }

  return {
    character: {
      name: name || randomName(),
      pronouns: pronouns || 'they/them',
      crime: pick(CRIMES),
      background: background.text,
    },
    stats,
    equipment,
    pack,
    clock: START_CLOCK,
    location: 'The Long Stair',
    artifactsDelivered: 0,
    artifactGoal: ARTIFACT_GOAL,
    npcs: {},
    ended: null,
    turn: 0,
  };
}
