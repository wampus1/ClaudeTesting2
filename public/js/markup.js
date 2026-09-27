// Parses the narrator's bracket tags, e.g.
//   [Item: "rusted sword", damage: "1", durability: "10"]
//   [NPC: "goblin", alignment: "neutral", type: "trader", health: "5", relationship: "-5"]
// out of streamed story text.

const KINDS = {
  item: 'item',
  object: 'item',
  npc: 'npc',
  character: 'npc',
  creature: 'npc',
  gain: 'gain',
  acquire: 'gain',
  add: 'gain',
  pickup: 'gain',
  lose: 'lose',
  remove: 'lose',
  drop: 'lose',
  equip: 'equip',
  unequip: 'unequip',
  stat: 'stat',
  wear: 'wear',
  durability: 'wear',
  time: 'time',
  elapsed: 'elapsed',
  duration: 'elapsed',
  timepassed: 'elapsed',
  location: 'location',
  place: 'location',
  deliver: 'deliver',
  end: 'end',
};

// A '[' with no closing ']' after this many characters is treated as ordinary text.
const MAX_TAG_LENGTH = 900;

function normalizeQuotes(s) {
  return s.replace(/[“”„«»]/g, '"');
}

/** Parses one complete "[Kind: value, key: value]" string; returns null if it isn't a known tag. */
export function parseTag(raw) {
  const inner = normalizeQuotes(raw.slice(1, -1));
  const head = inner.match(/^\s*([A-Za-z][A-Za-z _-]{0,20}?)\s*:\s*/);
  if (!head) return null;
  const kind = KINDS[head[1].toLowerCase().replace(/[\s_-]/g, '')];
  if (!kind) return null;

  let pos = head[0].length;
  const readValue = () => {
    while (inner[pos] === ' ') pos++;
    let value;
    if (inner[pos] === '"' || inner[pos] === "'") {
      const quote = inner[pos];
      const close = inner.indexOf(quote, pos + 1);
      const end = close === -1 ? inner.length : close;
      value = inner.slice(pos + 1, end);
      pos = end + 1;
      const comma = inner.indexOf(',', pos);
      pos = comma === -1 ? inner.length : comma + 1;
    } else {
      const comma = inner.indexOf(',', pos);
      const end = comma === -1 ? inner.length : comma;
      value = inner.slice(pos, end);
      pos = end + 1;
    }
    return value.trim();
  };

  const value = readValue();
  const fields = {};
  while (pos < inner.length) {
    const colon = inner.indexOf(':', pos);
    if (colon === -1) break;
    const key = inner.slice(pos, colon).trim().toLowerCase().replace(/[\s-]+/g, '_');
    pos = colon + 1;
    const v = readValue();
    if (key && /^[a-z_][a-z0-9_]*$/.test(key)) fields[key] = v;
  }
  return { kind, value, fields, raw };
}

/**
 * Splits streamed text into plain text and tags. Text is emitted as soon as it
 * is known not to be part of a tag; a tag is emitted once its closing ']' arrives.
 */
export class TagStream {
  constructor({ onText, onTag }) {
    this.onText = onText;
    this.onTag = onTag;
    this.buffer = '';
  }

  push(chunk) {
    this.buffer += chunk;
    this.drain(false);
  }

  end() {
    this.drain(true);
    if (this.buffer) this.onText(this.buffer);
    this.buffer = '';
  }

  drain(final) {
    for (;;) {
      const open = this.buffer.indexOf('[');
      if (open === -1) {
        if (this.buffer) this.onText(this.buffer);
        this.buffer = '';
        return;
      }
      if (open > 0) {
        this.onText(this.buffer.slice(0, open));
        this.buffer = this.buffer.slice(open);
      }
      const close = this.buffer.indexOf(']');
      if (close === -1) {
        if (final || this.buffer.length > MAX_TAG_LENGTH) {
          this.onText('[');
          this.buffer = this.buffer.slice(1);
          continue;
        }
        return;
      }
      const raw = this.buffer.slice(0, close + 1);
      this.buffer = this.buffer.slice(close + 1);
      const tag = parseTag(raw);
      if (tag) this.onTag(tag);
      else this.onText(raw);
    }
  }
}

/** Parses a complete block of text at once (used when replaying a saved game). */
export function parseAll(text, handlers) {
  const stream = new TagStream(handlers);
  stream.push(text);
  stream.end();
}
