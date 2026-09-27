// The inventory panel (left side): equipment on a paper doll, including the gadget and
// relic slots, above a grid pack where every item takes a footprint by what it is.
// Items are dragged between the grid and the slots; R (or right-click) rotates while dragging.

import { SLOTS } from './character.js';
import { COLS, ROWS, fits, footprint, itemShape } from './grid.js';
import { itemIcon } from './icons.js';
import { equip, unequip, slotAccepts, hasWatch } from './state.js';
import { artImg, requestArt } from './art.js';
import { sfx } from './audio.js';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const cap = (s) => (s ? String(s)[0].toUpperCase() + String(s).slice(1) : '');

// Faint outlines shown in empty slots.
const SLOT_GHOSTS = {
  weapon: { name: 'sword' }, head: { name: 'helm' }, body: { name: 'tunic' }, feet: { name: 'boots' },
  trinket: { name: 'ring' }, gadget1: { name: 'pocket watch' }, gadget2: { name: 'compass' }, relic: { name: 'humming stone', type: 'artifact' },
};

const FIGURE = `<svg viewBox="0 0 120 220" aria-hidden="true"><path d="M60 8 C44 8 38 22 39 36 C40 48 46 56 52 60 L50 66 C34 70 24 78 20 96 L12 146 C11 152 18 154 20 148 L32 104 L34 150 L30 212 C30 218 42 218 43 212 L52 158 L60 158 L68 158 L77 212 C78 218 90 218 90 212 L86 150 L88 104 L100 148 C102 154 109 152 108 146 L100 96 C96 78 86 70 70 66 L68 60 C74 56 80 48 81 36 C82 22 76 8 60 8 Z" fill="currentColor"/></svg>`;

let hooks = { getGame: () => null, onChange: () => {}, onAction: () => {}, onItemMenu: () => {} };
let drag = null;
let tooltipFor = null;

export function initInventory(options) {
  hooks = { ...hooks, ...options };
  const panel = $('#inventory');
  panel.addEventListener('pointerdown', onPointerDown);
  panel.addEventListener('pointerover', onHover);
  panel.addEventListener('pointermove', (e) => { if (tooltipFor && !drag) positionTooltip(e); });
  panel.addEventListener('pointerout', (e) => {
    if (!e.relatedTarget?.closest?.('[data-item]')) hideTooltip();
  });
  panel.addEventListener('keydown', (e) => {
    const el = e.target.closest?.('[data-item]');
    if (el && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      openMenuFor(el);
    }
  });
  panel.addEventListener('contextmenu', (e) => { if (drag?.started) e.preventDefault(); });
  $('#inventory-close').addEventListener('click', () => setInventoryOpen(false));
}

export const isInventoryOpen = () => $('#inventory').classList.contains('open');

export function setInventoryOpen(open) {
  const panel = $('#inventory');
  if (panel.classList.contains('open') === open) return;
  panel.classList.toggle('open', open);
  panel.setAttribute('aria-hidden', String(!open));
  $('#btn-inventory').setAttribute('aria-expanded', String(open));
  sfx(open ? 'open' : 'close');
  hideTooltip();
  if (open) {
    renderInventory();
    $('#inventory-close').focus({ preventScroll: true });
  }
}

/* ---------------------------------------------------------------- rendering */

function artInner(item) {
  const img = artImg('item', item);
  if (img) return img;
  const s = itemShape(item);
  return `<span class="icon-fit${s.orient ? ` o-${s.orient}` : ''}" style="--k:${s.scale}">${itemIcon(item)}</span>`;
}

/** The item's art in its natural (unrotated) proportions; `rot` turns the whole box a quarter turn. */
function artBox(item, rot) {
  const s = itemShape(item);
  return `<div class="art-box${rot ? ' rot' : ''}" style="--cw:${s.w};--ch:${s.h}">${artInner(item)}</div>`;
}

const isArtifact = (item) => /artifact|relic/i.test(item.type || '');

function packItem(item) {
  const fp = footprint(item);
  return `<div class="inv-item${isArtifact(item) ? ' artifact' : ''}" data-item data-id="${esc(item.id)}" style="--x:${item.x};--y:${item.y};--w:${fp.w};--h:${fp.h}" tabindex="0" role="button" aria-label="${esc(item.name)}">
    ${artBox(item, item.rot)}
    ${(item.qty || 1) > 1 ? `<span class="qty">×${item.qty}</span>` : ''}
  </div>`;
}

function looseItem(item) {
  const fp = footprint(item);
  return `<div class="inv-item loose-item${isArtifact(item) ? ' artifact' : ''}" data-item data-id="${esc(item.id)}" style="--w:${fp.w};--h:${fp.h}" tabindex="0" role="button" aria-label="${esc(item.name)} (loose)">
    ${artBox(item, item.rot)}
  </div>`;
}

function slotBox({ key, label, special }, item) {
  let inner;
  if (item) {
    const s = itemShape(item);
    const long = s.w !== s.h && Math.max(s.w, s.h) / Math.min(s.w, s.h) >= 2 && s.w > s.h;
    // Long things lie corner to corner in a square slot; everything else is scaled to fit.
    const n = long ? (s.w + s.h) / Math.SQRT2 / 0.95 : Math.max(s.w, s.h) / 0.88;
    inner = `<div class="slot-art${long ? ' diag' : ''}" style="--n:${n.toFixed(3)}">${artBox(item, false)}</div>`;
  } else {
    inner = `<span class="slot-ghost">${itemIcon(SLOT_GHOSTS[key])}</span>`;
  }
  return `<div class="slot-box slot-${key}${special ? ' special' : ''}${item ? ' filled' : ''}" data-slot="${key}"${item ? ' data-item tabindex="0" role="button"' : ''} aria-label="${label}${item ? `: ${esc(item.name)}` : ' (empty)'}">
    ${inner}
    <span class="slot-label">${label}</span>
  </div>`;
}

export function renderInventory() {
  const game = hooks.getGame();
  if (!game) return;
  hideTooltip();
  const { state } = game;
  const slot = (key) => slotBox(SLOTS.find((s) => s.key === key), state.equipment[key]);
  const packed = state.pack.filter((i) => i.x != null);
  const loose = state.pack.filter((i) => i.x == null);
  const used = packed.reduce((n, i) => n + footprint(i).w * footprint(i).h, 0);

  $('#inventory-content').innerHTML = `
    <header class="inv-head">
      <h2>Pack &amp; Person</h2>
      <span class="inv-coin" title="Coin"><span class="coin-glyph" aria-hidden="true"></span><b class="num">${state.stats.coin}</b> copper${state.stats.coin === 1 ? '' : 's'}</span>
    </header>
    <div class="doll">
      <div class="doll-figure">${FIGURE}</div>
      <div class="doll-col doll-left">${slot('weapon')}</div>
      <div class="doll-col doll-center">${slot('head')}${slot('body')}${slot('feet')}</div>
      <div class="doll-col doll-right">${slot('trinket')}</div>
      <div class="reliquary">
        <span class="reliquary-label">Gadgets &amp; relic</span>
        ${slot('gadget1')}${slot('gadget2')}${slot('relic')}
        ${hasWatch(state) ? '<span class="reliquary-note">The watch tells the hour</span>' : ''}
      </div>
    </div>
    <div class="pack-head"><h3>Pack</h3><span class="pack-fill num">${used}/${COLS * ROWS}</span></div>
    <div class="grid-wrap">
      <div class="inv-grid" id="inv-grid" style="--cols:${COLS};--rows:${ROWS}">
        <div class="grid-hl" id="grid-hl" hidden></div>
        ${packed.map(packItem).join('')}
      </div>
    </div>
    ${loose.length ? `<div class="loose"><h3>Carried loose. No room in the pack</h3><div class="loose-row">${loose.map(looseItem).join('')}</div></div>` : ''}
    <p class="inv-hint">Drag to move or equip · <kbd>R</kbd> or right-click rotates while dragging · drop on the action bar to use</p>`;

  if (isInventoryOpen()) {
    for (const item of state.pack) requestArt('item', item);
    for (const item of Object.values(state.equipment)) if (item) requestArt('item', item);
  }
}

/* ---------------------------------------------------------------- tooltip */

function itemFrom(el) {
  const game = hooks.getGame();
  if (!game || !el) return null;
  if (el.dataset.slot) {
    const item = game.state.equipment[el.dataset.slot];
    return item ? { kind: 'slot', slot: el.dataset.slot, item } : null;
  }
  const item = game.state.pack.find((i) => i.id === el.dataset.id);
  return item ? { kind: 'pack', item } : null;
}

function onHover(e) {
  if (drag || e.pointerType === 'touch') return;
  const el = e.target.closest('[data-item]');
  if (!el) return;
  const source = itemFrom(el);
  if (!source || tooltipFor === el) return;
  tooltipFor = el;
  const { item } = source;
  const s = itemShape(item);
  const stats = [];
  if (item.damage) stats.push(`Damage ${item.damage}`);
  if (item.defense && item.defense !== '0') stats.push(`Defense ${item.defense}`);
  if (item.durability) stats.push(`Durability ${item.durability}${item.maxDurability ? `/${item.maxDurability}` : ''}`);
  if (item.uses) stats.push(`Uses ${item.uses}`);
  if (item.value) stats.push(`${item.value} cp`);
  const tip = $('#item-tooltip');
  tip.innerHTML = `
    <div class="tt-name${isArtifact(item) ? ' artifact' : ''}">${esc(cap(item.name))}</div>
    <div class="tt-meta">${esc(cap(item.type || 'curio'))} · ${s.w}×${s.h}${(item.qty || 1) > 1 ? ` · ×${item.qty}` : ''}${source.kind === 'slot' ? ' · equipped' : item.x == null ? ' · loose' : ''}</div>
    ${stats.length ? `<div class="tt-stats">${esc(stats.join(' · '))}</div>` : ''}
    ${item.effect ? `<div class="tt-effect">${esc(item.effect)}</div>` : ''}
    ${item.description ? `<div class="tt-desc">${esc(item.description)}</div>` : ''}
    <div class="tt-hint">Click for actions · drag to move</div>`;
  tip.hidden = false;
  positionTooltip(e);
}

function positionTooltip(e) {
  const tip = $('#item-tooltip');
  const pad = 16;
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  let x = e.clientX + pad;
  let y = e.clientY + pad;
  if (x + w > window.innerWidth - 8) x = e.clientX - w - pad;
  if (y + h > window.innerHeight - 8) y = e.clientY - h - pad;
  tip.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
}

export function hideTooltip() {
  tooltipFor = null;
  const tip = $('#item-tooltip');
  if (tip) tip.hidden = true;
}

/* ---------------------------------------------------------------- click menu */

function openMenuFor(el) {
  const source = itemFrom(el);
  if (!source) return;
  hideTooltip();
  hooks.onItemMenu(el, source, {
    rotate: () => rotateInPlace(source.item),
    equipTo: (slot) => {
      const at = source.item.x != null ? { x: source.item.x, y: source.item.y, rot: source.item.rot } : null;
      equip(hooks.getGame().state, source.item, slot, at);
      sfx('equip');
      hooks.onChange();
    },
    unequip: () => {
      if (!unequip(hooks.getGame().state, source.slot)) return;
      sfx('drop');
      hooks.onChange();
    },
  });
}

function rotateInPlace(item) {
  const { pack } = hooks.getGame().state;
  if (item.x != null && fits(pack, item, item.x, item.y, !item.rot)) {
    item.rot = !item.rot;
    sfx('rotate');
    hooks.onChange();
  } else {
    sfx('invalid');
  }
}

/* ---------------------------------------------------------------- drag and drop */

function cellSize() {
  const grid = $('#inv-grid');
  return grid ? grid.getBoundingClientRect().width / COLS : 40;
}

function onPointerDown(e) {
  if (e.button !== 0) return;
  // A drag whose release happened outside the window never finished; drop it.
  if (drag) cancelDrag();
  const el = e.target.closest('[data-item]');
  if (!el) return;
  const game = hooks.getGame();
  const source = itemFrom(el);
  if (!game || !source || game.state.ended) return;
  e.preventDefault();
  drag = { source, el, x0: e.clientX, y0: e.clientY, started: false, rot: source.kind === 'pack' ? Boolean(source.item.rot) : false, target: null };
  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('pointerup', onDragEnd);
  window.addEventListener('pointercancel', cancelDrag);
  window.addEventListener('blur', cancelDrag);
}

function beginDrag() {
  const { item } = drag.source;
  const cell = cellSize();
  const fp = footprint({ ...item, rot: drag.rot });
  if (drag.source.kind === 'pack' && item.x != null) {
    const rect = drag.el.getBoundingClientRect();
    drag.ox = Math.min(Math.max(drag.x0 - rect.left, 4), fp.w * cell - 4);
    drag.oy = Math.min(Math.max(drag.y0 - rect.top, 4), fp.h * cell - 4);
  } else {
    drag.ox = (fp.w * cell) / 2;
    drag.oy = (fp.h * cell) / 2;
  }
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.style.setProperty('--cell', `${cell}px`);
  drag.ghost = ghost;
  renderGhost();
  document.body.appendChild(ghost);
  drag.el.classList.add('is-dragging');
  document.body.classList.add('dragging-item');
  drag.started = true;
  hideTooltip();
  sfx('drag');
  window.addEventListener('keydown', onDragKey);
  window.addEventListener('contextmenu', onDragContext);
}

function renderGhost() {
  const { item } = drag.source;
  const fp = footprint({ ...item, rot: drag.rot });
  drag.ghost.innerHTML = `<div class="inv-item${isArtifact(item) ? ' artifact' : ''}" style="--w:${fp.w};--h:${fp.h}">${artBox(item, drag.rot)}</div>`;
}

function rotateDrag() {
  const cell = cellSize();
  drag.rot = !drag.rot;
  // Turn around the cursor: the rotated item is held by its middle.
  const fp = footprint({ ...drag.source.item, rot: drag.rot });
  drag.ox = (fp.w * cell) / 2;
  drag.oy = (fp.h * cell) / 2;
  renderGhost();
  sfx('rotate');
  if (drag.last) onDragMove(drag.last);
}

function onDragKey(e) {
  if (e.key === 'r' || e.key === 'R') {
    e.preventDefault();
    rotateDrag();
  } else if (e.key === 'Escape') {
    cancelDrag();
  }
}

function onDragContext(e) {
  e.preventDefault();
  rotateDrag();
}

function onDragMove(e) {
  if (!drag) return;
  drag.last = { clientX: e.clientX, clientY: e.clientY };
  if (!drag.started) {
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 5) return;
    beginDrag();
  }
  drag.ghost.style.transform = `translate(${e.clientX - drag.ox}px, ${e.clientY - drag.oy}px)`;
  const game = hooks.getGame();
  const { item } = drag.source;
  const under = document.elementFromPoint(e.clientX, e.clientY);
  const hl = $('#grid-hl');
  document.querySelectorAll('.drop-ok, .drop-bad').forEach((el) => el.classList.remove('drop-ok', 'drop-bad'));
  if (hl) hl.hidden = true;
  drag.target = null;

  const gridEl = under?.closest('#inv-grid');
  const slotEl = under?.closest('.slot-box');
  if (gridEl) {
    const rect = gridEl.getBoundingClientRect();
    const cell = rect.width / COLS;
    const x = Math.round((e.clientX - drag.ox - rect.left) / cell);
    const y = Math.round((e.clientY - drag.oy - rect.top) / cell);
    const ok = fits(game.state.pack, item, x, y, drag.rot, drag.source.kind === 'pack' ? item : null);
    const fp = footprint({ ...item, rot: drag.rot });
    hl.hidden = false;
    hl.className = `grid-hl ${ok ? 'ok' : 'bad'}`;
    hl.style.cssText = `--x:${Math.max(0, Math.min(COLS - 1, x))};--y:${Math.max(0, Math.min(ROWS - 1, y))};--w:${Math.min(fp.w, COLS - Math.max(0, x))};--h:${Math.min(fp.h, ROWS - Math.max(0, y))}`;
    drag.target = { type: 'grid', x, y, ok };
  } else if (slotEl) {
    const slot = slotEl.dataset.slot;
    const sameSlot = drag.source.kind === 'slot' && drag.source.slot === slot;
    const ok = !sameSlot && slotAccepts(slot, item);
    slotEl.classList.add(ok ? 'drop-ok' : 'drop-bad');
    drag.target = { type: 'slot', slot, ok };
  } else if (under?.closest('#action-form')) {
    $('#action-form').classList.add('drop-ok');
    drag.target = { type: 'use', ok: true };
  }
}

function moveBetweenSlots(state, from, to) {
  const moving = state.equipment[from];
  const other = state.equipment[to];
  if (other && !slotAccepts(from, other)) {
    unequip(state, to);
    state.equipment[to] = moving;
    state.equipment[from] = null;
  } else {
    state.equipment[to] = moving;
    state.equipment[from] = other;
  }
}

function onDragEnd(e) {
  if (!drag) return;
  const { source, target, started, el } = drag;
  if (!started) {
    finishDrag();
    openMenuFor(el);
    return;
  }
  const game = hooks.getGame();
  const { state } = game;
  const { item } = source;
  let changed = false;
  if (target?.type === 'grid' && target.ok) {
    if (source.kind === 'pack') Object.assign(item, { x: target.x, y: target.y, rot: drag.rot });
    else unequip(state, source.slot, { x: target.x, y: target.y, rot: drag.rot });
    sfx('drop');
    changed = true;
  } else if (target?.type === 'slot' && target.ok) {
    const hadWatch = hasWatch(state);
    if (source.kind === 'pack') {
      const at = item.x != null ? { x: item.x, y: item.y, rot: item.rot } : null;
      equip(state, item, target.slot, at);
    } else {
      moveBetweenSlots(state, source.slot, target.slot);
    }
    sfx(!hadWatch && hasWatch(state) ? 'tick' : 'equip');
    changed = true;
  } else if (target?.type === 'use') {
    hooks.onAction(`use ${item.name}`);
    sfx('click');
  } else if (target) {
    sfx('invalid');
  }
  finishDrag();
  if (changed) hooks.onChange();
  e?.preventDefault?.();
}

function cancelDrag() {
  if (drag?.started) sfx('invalid');
  finishDrag();
}

function finishDrag() {
  window.removeEventListener('pointermove', onDragMove);
  window.removeEventListener('pointerup', onDragEnd);
  window.removeEventListener('pointercancel', cancelDrag);
  window.removeEventListener('blur', cancelDrag);
  window.removeEventListener('keydown', onDragKey);
  window.removeEventListener('contextmenu', onDragContext);
  if (drag) {
    drag.ghost?.remove();
    drag.el?.classList.remove('is-dragging');
  }
  document.body.classList.remove('dragging-item');
  document.querySelectorAll('.drop-ok, .drop-bad').forEach((node) => node.classList.remove('drop-ok', 'drop-bad'));
  const hl = $('#grid-hl');
  if (hl) hl.hidden = true;
  drag = null;
}
