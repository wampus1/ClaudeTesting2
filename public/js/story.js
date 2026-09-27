// Renders narrator passages. Text streams in; when an Item/NPC tag closes, the
// words it names (just before the tag) are wrapped in a clickable highlight.

import { TagStream } from './markup.js';
import { alignmentOf, isDead, npcKey } from './state.js';

/** Every highlighted entity on the page, by id: { kind: 'item'|'npc', name, data }. */
export const entities = new Map();
let nextEntityId = 1;

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const LETTER = /[\p{L}\p{N}'’-]/u;

/** Curls straight quotes; `prev` is the character before `text`. */
export function smartQuotes(text, prev = '') {
  let out = '';
  for (const ch of text) {
    if (ch === '"') out += !prev || /[\s([{\u2014\u2013-]/.test(prev) ? '\u201C' : '\u201D';
    else if (ch === "'") out += /[\p{L}\p{N}]/u.test(prev) ? '\u2019' : !prev || /[\s([{\u2014\u2013"-]/.test(prev) ? '\u2018' : '\u2019';
    else out += ch;
    prev = ch;
  }
  return out;
}

function findNameInText(text, name) {
  if (!name) return null;
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeRe(name)})`, 'giu');
  let match = null;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    match = { start: m.index + m[1].length, end: m.index + m[1].length + m[2].length };
    re.lastIndex = m.index + 1;
  }
  if (!match) return null;
  // Extend to whole words ("goblin" inside "goblins").
  while (match.end < text.length && LETTER.test(text[match.end])) match.end++;
  return match;
}

export class Passage {
  /**
   * @param {HTMLElement} el container for this passage's paragraphs
   * @param {{ onTag?: (tag) => void, npcClass?: (key) => string }} hooks
   */
  constructor(el, hooks = {}) {
    this.el = el;
    this.hooks = hooks;
    this.paragraphs = [];
    this.current = null;
    this.pendingBreak = false;
    this.afterTag = false;
    this.raw = '';
    this.stream = new TagStream({
      onText: (text) => this.addText(text),
      onTag: (tag) => this.addTag(tag),
    });
  }

  push(chunk) {
    this.raw += chunk;
    this.stream.push(chunk);
  }

  end() {
    this.stream.end();
    for (const p of this.paragraphs) {
      const last = p.segments.at(-1);
      if (last?.type === 'text') last.text = last.text.replace(/\s+$/, '');
      this.render(p);
    }
  }

  newParagraph() {
    const el = document.createElement('p');
    this.el.appendChild(el);
    this.current = { el, segments: [] };
    this.paragraphs.push(this.current);
  }

  addText(text) {
    const parts = text.split(/\n+/);
    parts.forEach((part, i) => {
      if (i > 0) this.pendingBreak = true;
      this.appendText(part);
    });
  }

  appendText(text) {
    if (!text) return;
    if (!this.current || this.pendingBreak) {
      if (!text.trim()) return;
      if (!this.current || this.current.segments.length) this.newParagraph();
      this.pendingBreak = false;
    }
    const segments = this.current.segments;
    if (!segments.length) {
      text = text.replace(/^\s+/, '');
      if (!text) return;
    }
    const last = segments.at(-1);
    if (this.afterTag) {
      // Removing a tag can leave "sword  leans" or "sword ." behind; close the gap.
      if (last?.type === 'text' && /\s$/.test(last.text) && /^[\s.,;:!?)'"’”—]/.test(text)) {
        last.text = last.text.replace(/\s+$/, '');
      }
      if (last?.type === 'entity' && /^\s{2,}/.test(text)) text = text.replace(/^\s+/, ' ');
      this.afterTag = false;
    }
    if (last?.type === 'text') last.text += text;
    else segments.push({ type: 'text', text });
    this.render(this.current);
  }

  addTag(tag) {
    this.hooks.onTag?.(tag);
    if (tag.kind === 'item' || tag.kind === 'npc') this.wrapEntity(tag);
    this.afterTag = true;
  }

  wrapEntity(tag) {
    const name = tag.value.trim();
    if (!name) return;
    if (!this.current || this.pendingBreak) {
      if (!this.current) this.newParagraph();
    }
    const id = String(nextEntityId++);
    entities.set(id, { kind: tag.kind, name, key: npcKey(name), data: { ...tag.fields, name } });
    const entity = { type: 'entity', id, kind: tag.kind, key: npcKey(name) };
    const segments = this.current.segments;

    // 1) the exact name, 2) its head noun ("sword" for "rusted sword"), 3) the word just before the tag.
    const headNoun = name.split(/\s+/).filter((w) => w.length > 2).at(-1);
    for (const needle of [name, headNoun]) {
      for (let i = segments.length - 1; i >= 0; i--) {
        const seg = segments[i];
        if (seg.type !== 'text') continue;
        const found = findNameInText(seg.text, needle);
        if (!found) continue;
        entity.text = seg.text.slice(found.start, found.end);
        segments.splice(i, 1,
          { type: 'text', text: seg.text.slice(0, found.start) },
          entity,
          { type: 'text', text: seg.text.slice(found.end) });
        this.render(this.current);
        return;
      }
      if (needle === name && (!headNoun || headNoun.toLowerCase() === name.toLowerCase())) break;
    }

    const last = segments.at(-1);
    const word = last?.type === 'text' ? last.text.match(/([\p{L}\p{N}'’-]+)(\s*)$/u) : null;
    if (word) {
      const start = last.text.length - word[0].length;
      entity.text = word[1];
      segments.splice(segments.length - 1, 1,
        { type: 'text', text: last.text.slice(0, start) },
        entity,
        { type: 'text', text: word[2] });
    } else {
      entity.text = name;
      if (last?.type === 'text' && last.text && !/\s$/.test(last.text)) last.text += ' ';
      segments.push(entity);
    }
    this.render(this.current);
  }

  render(paragraph) {
    let prev = '';
    paragraph.el.innerHTML = paragraph.segments.map((seg) => {
      const text = smartQuotes(seg.text, prev);
      prev = seg.text.at(-1) ?? prev;
      if (seg.type === 'text') return escapeHtml(text);
      const cls = seg.kind === 'npc' ? `npc ${this.hooks.npcClass?.(seg.key) ?? 'neutral'}` : 'item';
      return `<span class="entity ${cls}" data-eid="${seg.id}" data-key="${escapeHtml(seg.key)}" role="button" tabindex="0">${escapeHtml(text)}</span>`;
    }).join('');
  }
}

/** Updates the colour of every mention of an NPC after its alignment changes. */
export function refreshNpcMentions(root, key, npc) {
  const alignment = alignmentOf(npc);
  const dead = isDead(npc);
  for (const el of root.querySelectorAll('.entity.npc')) {
    if (el.dataset.key !== key) continue;
    el.classList.remove('peaceful', 'neutral', 'hostile');
    el.classList.add(alignment);
    el.classList.toggle('dead', dead);
  }
}
