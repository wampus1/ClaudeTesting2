// A canned narrator for playing and testing the interface without an API key.
// Chosen as "No AI (demo)" on the title screen, or forced with `npm run mock`.
// It recognises a few verbs and replays the tags the real narrator would emit.

export const id = 'mock';
export const label = 'Demo';
export const DEFAULT_MODEL = 'mock-narrator';
export const canPaint = false;

const OPENING = `Sergeant Holm doesn't bother with the torch until the last landing. "Mind the ninth step," the guard [NPC: "Sergeant Holm", alignment: "neutral", type: "guard", health: "18", relationship: "0", description: "A heavy, grey-bearded jailer with a crooked nose and a ring of keys worn smooth by years of turning."] says, "it's the one that eats ankles." Your chains drag behind you like a second, heavier shadow.

The fortress gives way to raw rock, and the Long Stair begins: a spiral cut into the throat of the earth, slick with seep-water, breathing cold up from below. Halfway down, an iron gate spans the stair, its bars as thick as a wrist and scratched pale from the far side.

"Terms are simple," Holm says, unlocking your shackles. "Bring the Warden five of the old relics from the ruins and you walk out free. Sun's down, the gate's shut. Nothing comes up the stair at night, not you, not anything else. Come daylight we open it and trade: bread, candles, that sort of thing. For coin." A shrug. "Rest of it, you'll learn to survive down there on your own, or you won't."

He shoves you through. The gate booms shut. Far above, the last grey light of dusk goes out. [Location: "The Long Stair"] On the step at your feet lies a stub of candle [Item: "stub of candle", type: "light", uses: "2", value: "1", description: "Somebody's last light. Tallow, thumb-length, the wick already blackened."] that someone left behind. [Elapsed: "45 minutes"]`;

const SCENES = [
  {
    location: 'The Foot of the Stair',
    text: `The stair ends in a plaza of cracked flagstones where a dozen prisoners huddle around a fire of broken furniture. An old woman [NPC: "Old Moll", alignment: "peaceful", type: "prisoner", health: "6", relationship: "2", description: "Toothless, sharp-eyed, wrapped in six layers of rags and one very good wool shawl she refuses to explain."] waves you closer with a spoon.

"New meat," she cackles, not unkindly. Beside her pot lies a coil of fraying rope [Item: "coil of fraying rope", type: "tool", durability: "5", value: "2", description: "Twenty feet of hemp, sound in places, rotten in others. You won't know which until it matters."] and, half-buried in ash, a dull bronze disc [Item: "bronze star-disc", type: "artifact", weight: "2", value: "80", description: "A palm-sized disc etched with constellations that do not hang in any sky you know. It is faintly warm."] that nobody seems to have noticed.`,
  },
  {
    location: 'The Weeping Market',
    text: `Stalls of rotted timber lean against each other like drunks, and water weeps from every surface. Behind one, a goblin [NPC: "one-eyed goblin", alignment: "neutral", type: "trader", health: "5", relationship: "-2", description: "A grey, wiry scavenger with one milky eye and a necklace of mismatched keys. It smells of lamp-oil and wet dog."] arranges its wares with fussy care.

Among them: a bone-handled knife [Item: "bone-handled knife", type: "weapon", damage: "3", durability: "8", value: "6", description: "The blade is good steel. The handle is someone's shin."], a waterskin [Item: "waterskin", type: "drink", uses: "4", value: "3", description: "Patched leather, sloshing and cold. The water tastes of iron and old coins."] and a dented pocket watch [Item: "dented pocket watch", type: "gadget", effect: "tells the hour", value: "15", description: "Brass, dented, still ticking. Someone scratched a name inside the lid and someone else scratched it out."]. "Look is free," it rasps. "Touch is not."`,
  },
  {
    location: 'The Drowned Nave',
    text: `The floor of the old temple is a black mirror of standing water, and your steps send rings out toward pillars carved with faces that have no eyes. Something breathes in the dark between them.

A blind cave rat [NPC: "blind cave rat", alignment: "hostile", type: "beast", health: "7", relationship: "-6", strength: "5", description: "Dog-sized and hairless, its skin the colour of boiled fat. Where its eyes should be are two puckered seams."] lifts its head from the water, whiskers trembling toward you. Behind it, on the altar, rests a copper mask [Item: "weeping copper mask", type: "artifact", weight: "3", value: "120", description: "A serene Dakavi face with verdigris tears running from both eyes. The inside is warm, as if recently worn."], and propped against the altar's foot, a rusted longsword [Item: "rusted longsword", type: "weapon", damage: "4", durability: "6", weight: "4", value: "8", description: "A knight's blade, long past its knight. The edge is notched but the balance is true."].`,
  },
];

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    }, { once: true });
  });
}

/** Finds the most recent entity tag for `name` in the transcript, returning its field list. */
function findTag(history, kind, name) {
  const lower = name.toLowerCase();
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role !== 'assistant') continue;
    const tags = [...history[i].content.matchAll(new RegExp(`\\[${kind}:\\s*"([^"]+)"([^\\]]*)\\]`, 'g'))].reverse();
    for (const [, tagName, rest] of tags) {
      if (lower.includes(tagName.toLowerCase()) || tagName.toLowerCase().includes(lower)) {
        return { name: tagName, rest, fields: Object.fromEntries([...rest.matchAll(/(\w+):\s*"([^"]*)"/g)].map((m) => [m[1], m[2]])) };
      }
    }
  }
  return null;
}

function field(fields) {
  return Object.entries(fields).map(([k, v]) => `, ${k}: "${v}"`).join('');
}

function weaponOf(userContent) {
  return userContent.match(/Equipped: weapon: ([^(;]+)/)?.[1]?.trim() || 'fists';
}

function respond(history, userContent) {
  if (history.length === 0) return OPENING;

  const action = (userContent.match(/<action>([\s\S]*)<\/action>/)?.[1] || '').trim();
  const lower = action.toLowerCase();
  const turn = history.length / 2;
  const period = userContent.match(/\((dawn|day|dusk|night)\)/)?.[1] || 'night';
  const target = lower.replace(/^.*?\b(pick up|take|grab|attack|strike|stab|hit|talk to|speak to|trade with|gift|give|steal from|examine|eat|drink|deliver)\b\s*(the\s+)?/, '').trim();
  const weapon = weaponOf(userContent);

  if (/\b(pick up|take|grab)\b/.test(lower)) {
    const tag = findTag(history, 'Item', target);
    if (!tag) return `You grope in the dark for ${target || 'it'}, but your fingers close on nothing but grit and cold water. [Elapsed: "5 minutes"]`;
    return `You close your hand around the ${tag.name} and stow it before anyone can object. [Gain: "${tag.name}"${tag.rest}]

Somewhere below, water drips in a slow, patient rhythm, as if counting how long you have left. [Elapsed: "2 minutes"]`;
  }

  if (/\b(attack|strike|stab|hit|kill|fight)\b/.test(lower)) {
    const tag = findTag(history, 'NPC', target);
    if (!tag) return 'You lash out at the dark. The dark does not mind. [Elapsed: "1 minute"]';
    const health = Math.max(0, Number(tag.fields.health || 5) - 3);
    const fields = { ...tag.fields, alignment: 'hostile', health: String(health), relationship: String(Math.max(-10, Number(tag.fields.relationship || 0) - 4)) };
    const npc = `the ${tag.name} [NPC: "${tag.name}"${field(fields)}]`;
    if (health <= 0) {
      return `You go in low and fast. Your blow catches ${npc} across the throat and it folds without a sound. [Wear: "${weapon}", change: "-1"]

The silence afterward is worse than the fight. Your hands will not stop shaking. [Stat: "sanity", change: "-1"] [Elapsed: "3 minutes"]`;
    }
    return `You strike at ${npc}. The blow lands, but not cleanly: it howls and rakes you across the forearm before you can pull back. [Stat: "health", change: "-2"] [Wear: "${weapon}", change: "-1"]

Blood patters on the stone between you. It circles, favouring one side now, and it is not going to let you leave. [Elapsed: "2 minutes"]`;
  }

  if (/\b(talk|speak|ask|greet)\b/.test(lower)) {
    const tag = findTag(history, 'NPC', target);
    if (!tag) return 'You speak into the dark. Your own voice comes back to you from far away, slightly wrong. [Elapsed: "1 minute"]';
    const fields = { ...tag.fields, relationship: String(Math.min(10, Number(tag.fields.relationship || 0) + 1)) };
    return `The ${tag.name} [NPC: "${tag.name}"${field(fields)}] regards you for a long moment. "Most who come down that stair don't bother with manners," it says at last. "They don't last."

"Deeper you go, the more the old ones left behind. And the more's waiting for you. Remember that when you get greedy." [Elapsed: "15 minutes"]`;
  }

  if (/\b(trade|buy|barter)\b/.test(lower)) {
    return `"Coin first," comes the answer, and a grimy palm is thrust toward you. On offer: a stale heel of bread [Item: "stale heel of bread", type: "food", value: "2", description: "Hard enough to drive nails. Mostly flour."] and a tallow candle [Item: "tallow candle", type: "light", uses: "4", value: "3", description: "Smoky, stinking, and worth more down here than a sword."]. [Elapsed: "10 minutes"]`;
  }

  if (/\b(steal|pickpocket|lift)\b/.test(lower)) {
    return `You drift close, brush past, and your fingers find a purse string. By the time anyone thinks to look, a tarnished key [Item: "tarnished key", type: "key", value: "4", description: "Heavy, old, and cut for a lock with far too many wards."] is already cooling in your sleeve. [Gain: "tarnished key", type: "key", value: "4", description: "Heavy, old, and cut for a lock with far too many wards."] [Stat: "coin", change: "+3"] [Elapsed: "5 minutes"]`;
  }

  if (/\b(gift|give)\b/.test(lower) && !/warden/.test(lower)) {
    return 'You hold out the offering. It is taken quickly, suspiciously, and turned over twice. Then, grudgingly, the corner of a mouth lifts. Down here, kindness is so rare it looks like a trick. [Elapsed: "5 minutes"]';
  }

  if (/\b(deliver|hand over)\b/.test(lower) || /warden/.test(lower)) {
    if (period !== 'day') return 'You hammer on the gate until your knuckles split. Nobody answers. At night, nobody ever answers. [Stat: "health", change: "-1"] [Elapsed: "20 minutes"]';
    const tag = findTag(history, 'Gain', target) || findTag(history, 'Item', target);
    const name = tag?.name || target || 'relic';
    return `The Warden takes the ${name} through the bars with gloved hands, weighs it, and makes a mark in a ledger. [Deliver: "${name}"] "One step closer to the sun," he says, not looking at you. [Elapsed: "30 minutes"]`;
  }

  if (/\b(eat|drink)\b/.test(lower)) {
    return `You make yourself eat slowly. It tastes of mould and smoke, and it is the best thing you have ever put in your mouth. [Lose: "${target || 'stale heel of bread'}"] [Stat: "hunger", change: "-3"] [Elapsed: "10 minutes"]`;
  }

  if (/\b(sleep|rest)\b/.test(lower)) {
    return `You wedge yourself into a crack in the wall, knees to chest, and let the dark have you for a while. Dreams come: stairs that go down forever, and a voice counting.

When you wake, the air has changed. [Stat: "health", change: "+2"] [Stat: "hunger", change: "+1"] [Elapsed: "7 hours"]`;
  }

  if (/\bwait\b/.test(lower)) {
    return 'You sit with your back to the stone and listen to the dark breathe. Nothing comes. That is its own kind of warning. [Stat: "hunger", change: "+1"] [Elapsed: "3 hours"]';
  }

  const scene = SCENES[turn % SCENES.length];
  return `${scene.text} [Location: "${scene.location}"] [Stat: "hunger", change: "+1"] [Elapsed: "1 hour"]`;
}

export async function narrate({ messages, signal, onText }) {
  const history = messages.slice(0, -1);
  const userContent = messages.at(-1).content;
  const text = respond(history, userContent);
  await sleep(700, signal);
  for (let i = 0; i < text.length; ) {
    const size = 3 + Math.floor(Math.random() * 10);
    onText(text.slice(i, i + size));
    i += size;
    await sleep(12 + Math.random() * 25, signal);
  }
  return { stopReason: 'end_turn', model: DEFAULT_MODEL, usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } };
}

/** A crude chronicle: the first sentence of each passage. */
export async function complete({ prompt, signal }) {
  await sleep(600, signal);
  const passages = [...prompt.matchAll(/Narrator: ([^\n]+)/g)].map((m) => m[1].split(/(?<=[.!?])\s/)[0]);
  const text = passages.length
    ? `Earlier, in the dark: ${passages.join(' ')}`.slice(0, 900)
    : 'The chronicle grows thick with half-remembered days in the dark.';
  return { text };
}

export async function check() {
  return { model: DEFAULT_MODEL, available: true, note: null };
}

export function describeError(error) {
  return { message: String(error?.message || error), retry: true };
}

export function isAbort() {
  return false;
}
