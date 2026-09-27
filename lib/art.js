// Illustrations for items and NPCs, made by the player's chosen model:
// a GPT Image model paints them when available; otherwise the language model
// draws an SVG in the game's woodcut style, using the hand-drawn icons as references.
// Results are cached on disk and served from /art/.

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { itemIcon, npcPortrait } from '../public/js/icons.js';

export const ART_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.art-cache');
const ART_VERSION = 1;
const CELL = 64;
const inFlight = new Map();
// Keys whose image model refused us; they get ink drawings from then on.
const cannotPaint = new Set();

const clean = (value, max) => String(value ?? '').replace(/[<>\[\]{}`]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Normalizes the request body into an art spec. */
export function readSpec(body) {
  const kind = body?.kind === 'npc' ? 'npc' : 'item';
  const spec = {
    kind,
    name: clean(body?.name, 80),
    type: clean(body?.type, 40),
    description: clean(body?.description, 500),
    alignment: ['peaceful', 'neutral', 'hostile'].includes(body?.alignment) ? body.alignment : 'neutral',
    w: Math.max(1, Math.min(4, Math.round(Number(body?.w) || 1))),
    h: Math.max(1, Math.min(4, Math.round(Number(body?.h) || 1))),
  };
  if (!spec.name) throw Object.assign(new Error('Nothing to draw.'), { status: 400 });
  if (kind === 'npc') [spec.w, spec.h] = [5, 6];
  return spec;
}

/* ---------------------------------------------------------------- prompts */

const PAINT_STYLE = 'Game art for DESCEND, a grim medieval survival game set in a ruined city buried underground. Style: dark woodcut-inspired illustration with bold black ink outlines and flat, muted, earthy colours (umber, rust, bone, soot grey, tarnished bronze, verdigris), light grime and scratch texture, warm torchlight from the lower left, strong readable silhouette, high contrast. No text, lettering, border, frame, signature or watermark.';

const MOOD = {
  hostile: 'Their expression is menacing; they look ready to attack.',
  peaceful: 'Their expression is weary but kind.',
  neutral: 'Their expression is guarded and watchful.',
};

function paintPrompt(spec) {
  if (spec.kind === 'npc') {
    return `${PAINT_STYLE}\n\nSubject: a head-and-shoulders portrait of ${spec.name}${spec.type ? `, ${spec.type}` : ''}. ${spec.description} ${MOOD[spec.alignment]}\nComposition: facing the viewer, shoulders reaching the bottom edge, lit by a single torch from below left, background fading to pure black.`;
  }
  const orientation = spec.w > spec.h ? 'lying horizontally from left to right, spanning the full width of the frame' : spec.h > spec.w ? 'standing upright, spanning the full height of the frame' : 'in a three-quarter view, filling most of the frame';
  return `${PAINT_STYLE}\n\nSubject: a single ${spec.name}${spec.type ? ` (${spec.type})` : ''}. ${spec.description}\nComposition: the object alone, ${orientation}, centred, on a fully transparent background with no ground shadow.`;
}

const SVG_REFERENCES = [
  ['a rusted sword, 1 cell (viewBox 0 0 64 64)', itemIcon({ name: 'rusted sword', type: 'weapon' })],
  ['a threadbare gambeson, 1 cell', itemIcon({ name: 'threadbare gambeson', type: 'armor' })],
  ['a weeping copper mask (an artifact, with a faint glow), 1 cell', itemIcon({ name: 'weeping copper mask', type: 'artifact' })],
  ['a grey-bearded guard, portrait (viewBox 0 0 100 120)', npcPortrait({ name: 'Sergeant Holm', type: 'guard', description: 'grey-bearded jailer' }, 'neutral')],
].map(([what, svg]) => `<reference subject="${what}">\n${svg.replace(/ class="[^"]*"| aria-hidden="true"/g, '')}\n</reference>`).join('\n\n');

export const ILLUSTRATOR_PROMPT = `You are the illustrator for DESCEND, a grim medieval survival game set in a ruined city buried underground. You draw game art as hand-written SVG in the game's woodcut style. Here are drawings already in the game; match their style closely:

${SVG_REFERENCES}

Style rules:
- Bold dark outlines: stroke="#140e0a", stroke-width 2 (1 to 3 for details), stroke-linejoin="round", stroke-linecap="round".
- Flat, muted, earthy fills from this palette and close variants: iron #8d9091 #5b5e60 #c8cac6, rust #8f4a24, wood #6e4828 #4a2e17 #90633a, leather #5c3b22 #7c5535, cloth #6f665a #4f4940, sackcloth #9a8a66, bone #d9cdb2 #ad9f80, bronze #a8742e #d6a452 #6e4a1c, gold #d9b24a, verdigris #4f9a86, blood #8e2a1e, flame #ffb03a #fff0a0, skin #c7a17d #a67a55 #86593a #6b472c.
- Shade with a few darker flat shapes on the shadow side and thin light highlight strokes; light comes from the upper left. Add grime with small strokes: scratches, chips, stitches, rust flecks, wood grain.
- Glows only for things that give off light or magic: two or three circles in the glow colour at opacity 0.1 to 0.15 behind the subject.
- More detail than the references (roughly 30 to 90 elements), but a bold silhouette that still reads at 48 pixels.
- Transparent background: no background rectangle or scenery.
- No gradients, filters, masks, text or lettering, <image>, <script>, <style>, <foreignObject>, external references, or animation.

Reply with exactly one <svg> element that has xmlns="http://www.w3.org/2000/svg" and the viewBox you are given, and nothing else: no prose and no code fences.`;

function svgPrompt(spec) {
  if (spec.kind === 'npc') {
    return `Draw a head-and-shoulders portrait of ${spec.name}${spec.type ? `, ${spec.type}` : ''}. ${spec.description} ${MOOD[spec.alignment]}\nCanvas: viewBox="0 0 100 120". The bust faces the viewer with the shoulders reaching the bottom edge, like the reference portrait.`;
  }
  const w = spec.w * CELL;
  const h = spec.h * CELL;
  const layout = spec.w > spec.h ? 'Lay the object horizontally so it spans the canvas from left to right, with a small margin.' : spec.h > spec.w ? 'Stand the object upright so it spans the canvas from top to bottom, with a small margin.' : 'Fill most of the canvas with the object.';
  return `Draw this item for the inventory: ${spec.name}${spec.type ? ` (${spec.type})` : ''}. ${spec.description}\nCanvas: viewBox="0 0 ${w} ${h}" (${spec.w} by ${spec.h} inventory cells of ${CELL} units). ${layout}`;
}

/* ---------------------------------------------------------------- SVG safety */

/** Keeps only drawing markup. The browser also shows these through <img>, which never runs scripts. */
export function sanitizeSvg(text, viewBox) {
  const match = String(text).match(/<svg[\s\S]*<\/svg>/i);
  if (!match) throw new Error('The illustrator returned no drawing.');
  let svg = match[0];
  svg = svg.replace(/<!--[\s\S]*?-->/g, '');
  const banned = 'script|style|foreignObject|iframe|object|embed|image|a|animate\\w*|set';
  svg = svg.replace(new RegExp(`<(${banned})\\b[^>]*\\/>`, 'gi'), '');
  svg = svg.replace(new RegExp(`<(${banned})\\b[^>]*>[\\s\\S]*?<\\/\\1\\s*>`, 'gi'), '');
  svg = svg.replace(new RegExp(`<\\/?(${banned})\\b[^>]*>`, 'gi'), '');
  svg = svg.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  svg = svg.replace(/\s(?:xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, '');
  svg = svg.replace(/url\(\s*(?!['"]?#)[^)]*\)/gi, 'none');
  svg = svg.replace(/<svg\b([^>]*)>/i, (open, attrs) => {
    let a = attrs.replace(/\s(width|height)\s*=\s*("[^"]*"|'[^']*')/gi, '');
    if (!/xmlns\s*=/.test(a)) a += ' xmlns="http://www.w3.org/2000/svg"';
    if (!/viewBox\s*=/.test(a)) a += ` viewBox="${viewBox}"`;
    return `<svg${a}>`;
  });
  if (svg.length > 300_000) throw new Error('The drawing was too large.');
  if ((svg.match(/<(path|circle|ellipse|rect|polygon|polyline|line|g)\b/gi) || []).length < 3) throw new Error('The drawing was empty.');
  return svg;
}

/* ---------------------------------------------------------------- generation + cache */

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function cacheKey(spec, style) {
  return createHash('sha1').update(JSON.stringify([ART_VERSION, style, spec.kind, spec.name.toLowerCase(), spec.type, spec.description, spec.w, spec.h])).digest('hex').slice(0, 24);
}

/**
 * Returns the URL of an illustration for `spec`, generating it if it isn't cached.
 * @returns {Promise<{ url: string, style: 'paint' | 'ink', cached: boolean }>}
 */
export async function illustrate({ provider, auth, spec, signal }) {
  if (!provider.complete || provider.id === 'mock') throw Object.assign(new Error('This narrator cannot draw.'), { status: 501 });
  const painter = `${provider.id}:${auth.key || 'env'}:${auth.imageModel || 'default'}`;
  const style = provider.canPaint && !cannotPaint.has(painter) ? 'paint' : 'ink';
  const key = cacheKey(spec, style);
  for (const [k, ext] of [[key, 'webp'], [key, 'png'], [key, 'svg'], [cacheKey(spec, 'ink'), 'svg']]) {
    if (await exists(path.join(ART_DIR, `${k}.${ext}`))) return { url: `/art/${k}.${ext}`, style, cached: true };
  }
  if (inFlight.has(key)) return inFlight.get(key);

  const job = (async () => {
    await mkdir(ART_DIR, { recursive: true });
    if (style === 'paint') {
      try {
        const { bytes, ext } = await provider.paint({ auth, prompt: paintPrompt(spec), w: spec.w, h: spec.h, transparent: spec.kind === 'item', signal });
        await writeFile(path.join(ART_DIR, `${key}.${ext}`), bytes);
        return { url: `/art/${key}.${ext}`, style, cached: false };
      } catch (error) {
        // No access to the image model (e.g. an unverified organization): let the language model draw instead.
        if (!(error?.status >= 400 && error?.status < 500) || error?.status === 429) throw error;
        cannotPaint.add(painter);
        console.warn(`[descend] image model unavailable (${error.status}); drawing SVG instead.`);
      }
    }
    const viewBox = spec.kind === 'npc' ? '0 0 100 120' : `0 0 ${spec.w * CELL} ${spec.h * CELL}`;
    const { text } = await provider.complete({ auth, system: [ILLUSTRATOR_PROMPT], prompt: svgPrompt(spec), effort: 'medium', maxTokens: 32000, signal });
    const svg = sanitizeSvg(text, viewBox);
    const inkKey = style === 'paint' ? cacheKey(spec, 'ink') : key;
    await writeFile(path.join(ART_DIR, `${inkKey}.svg`), svg);
    return { url: `/art/${inkKey}.svg`, style: 'ink', cached: false };
  })();

  inFlight.set(key, job);
  try {
    return await job;
  } finally {
    inFlight.delete(key);
  }
}

const ART_TYPES = { '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png' };

/** Serves a cached illustration. Generated SVG gets a CSP that forbids scripts even if opened directly. */
export async function serveArt(name, res) {
  if (!/^[a-f0-9]{24}\.(svg|webp|png)$/.test(name)) return false;
  try {
    const data = await readFile(path.join(ART_DIR, name));
    res.writeHead(200, {
      'content-type': ART_TYPES[path.extname(name)],
      'cache-control': 'public, max-age=31536000, immutable',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
      'x-content-type-options': 'nosniff',
    });
    res.end(data);
    return true;
  } catch {
    return false;
  }
}
