// Interface pieces: HUD, character ledger, entity menus, examine cards, effects.

import { ATTRIBUTES } from './character.js';
import { itemIcon, itemIconKey, npcPortrait } from './icons.js';
import { alignmentOf, isDead, hasWatch } from './state.js';
import { smartQuotes } from './story.js';
import { clockParts, formatHour } from './clock.js';
import { artImg, artKey, requestArt, isPending, artEnabled } from './art.js';
import { sfx } from './audio.js';

const $ = (sel) => document.querySelector(sel);
export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const cap = (s) => (s ? String(s)[0].toUpperCase() + String(s).slice(1) : '');
const pct = (v, max) => `${Math.max(0, Math.min(100, (Number(v) / Number(max)) * 100))}%`;
const toNum = (v) => {
  const n = parseInt(String(v ?? '').replace(/[^\d+-]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
};
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/* ---------------------------------------------------------------- HUD */

const WATCH_FACE = `<svg class="watch-face" viewBox="0 0 32 34" aria-hidden="true">
  <circle cx="16" cy="4" r="2.4" fill="none" stroke="#d9b24a" stroke-width="1.4"/>
  <circle cx="16" cy="19" r="13" fill="#d9b24a" stroke="#140e0a" stroke-width="1.5"/>
  <circle cx="16" cy="19" r="10.2" fill="#efe4c6" stroke="#140e0a" stroke-width="1"/>
  <path d="M16 10.5v1.6M16 26v1.6M7.5 19h1.6M22.9 19h1.6" stroke="#140e0a" stroke-width="1"/>
  <path class="hand hour" d="M16 19 L16 13" stroke="#140e0a" stroke-width="1.8" stroke-linecap="round"/>
  <path class="hand minute" d="M16 19 L16 10.8" stroke="#140e0a" stroke-width="1.1" stroke-linecap="round"/>
  <circle cx="16" cy="19" r="1.1" fill="#140e0a"/>
</svg>`;

let lastHands = null;

function renderClock(state) {
  const box = $('#hud-clock');
  if (!hasWatch(state)) {
    box.className = 'hud-clock unknown';
    box.title = 'Equip a pocket watch to tell the hour';
    box.innerHTML = '<span class="hour-unknown">The hour is unknown</span>';
    lastHands = null;
    return;
  }
  const t = clockParts(state.clock);
  if (!box.querySelector('.watch-face')) {
    box.className = 'hud-clock known';
    box.title = 'Your pocket watch';
    box.innerHTML = `${WATCH_FACE}<span class="clock-text"><b class="num clock-hour"></b> <span class="clock-day"></span></span><span class="gate"></span>`;
  }
  // Angles grow with the clock so the hands always sweep forward; if time is rolled back
  // (a failed turn is undone) they jump back instead of spinning backwards.
  const minuteAngle = t.total * 6;
  const hourAngle = t.total * 0.5;
  const hands = box.querySelectorAll('.hand');
  hands.forEach((hand) => { hand.style.transition = lastHands !== null && minuteAngle < lastHands ? 'none' : ''; });
  box.querySelector('.hand.minute').style.transform = `rotate(${minuteAngle}deg)`;
  box.querySelector('.hand.hour').style.transform = `rotate(${hourAngle}deg)`;
  lastHands = minuteAngle;
  box.querySelector('.clock-hour').textContent = formatHour(t);
  box.querySelector('.clock-day').textContent = `Day ${t.day}`;
  const gate = box.querySelector('.gate');
  gate.textContent = t.gateOpen ? 'Gate open' : 'Gate sealed';
  gate.className = `gate ${t.gateOpen ? 'open' : 'sealed'}`;
}

export function renderHud(state) {
  const s = state.stats;
  const loc = $('#hud-location');
  if (loc.textContent !== state.location) {
    loc.textContent = state.location;
    loc.classList.remove('fresh');
    void loc.offsetWidth;
    loc.classList.add('fresh');
  }
  renderClock(state);
  const set = (key, value, max, low) => {
    $(`#bar-${key}`).style.width = pct(value, max);
    $(`#num-${key}`).textContent = `${value}/${max}`;
    $(`#bar-${key}`).closest('.vital').classList.toggle('low', low);
  };
  set('health', s.health, s.maxHealth, s.health <= Math.ceil(s.maxHealth * 0.3));
  set('hunger', s.hunger, 10, s.hunger >= 8);
  set('sanity', s.sanity, 10, s.sanity <= 3);
  $('#hud-artifacts').textContent = `${state.artifactsDelivered}/${state.artifactGoal}`;
}

/* ---------------------------------------------------------------- ledger */

function faceArt(npc) {
  return artImg('npc', npc) || npcPortrait(npc, alignmentOf(npc));
}

export function renderSheet(game) {
  const { state, memory = [] } = game;
  const { character: c, stats: s } = state;
  const watch = hasWatch(state);
  const t = clockParts(state.clock);
  const faces = Object.entries(state.npcs).sort((a, b) => (b[1].lastSeen ?? 0) - (a[1].lastSeen ?? 0));
  $('#sheet-content').innerHTML = `
    <div class="ledger">
      <p class="ledger-kicker">The Warden's Ledger · Prisoner of Dakavinor</p>
      <h2 class="ledger-name">${escapeHtml(c.name)}</h2>
      <p class="ledger-sub">${escapeHtml(cap(c.background))}, condemned for <em>${escapeHtml(c.crime)}</em>. <span class="ledger-pronouns">(${escapeHtml(c.pronouns)})</span></p>

      <div class="ledger-vitals">
        <div class="lv health"><span class="lv-label">Health</span><span class="lv-bar"><i style="width:${pct(s.health, s.maxHealth)}"></i></span><span class="lv-num">${s.health}/${s.maxHealth}</span></div>
        <div class="lv hunger"><span class="lv-label">Hunger</span><span class="lv-bar"><i style="width:${pct(s.hunger, 10)}"></i></span><span class="lv-num">${s.hunger}/10</span></div>
        <div class="lv sanity"><span class="lv-label">Sanity</span><span class="lv-bar"><i style="width:${pct(s.sanity, 10)}"></i></span><span class="lv-num">${s.sanity}/10</span></div>
      </div>

      <h3>Measure</h3>
      <div class="ledger-attrs">
        ${ATTRIBUTES.map((a) => `<div class="attr" title="${escapeHtml(a.blurb)}"><b>${s[a.key]}</b><span>${a.label}</span><small>${escapeHtml(a.blurb)}</small></div>`).join('')}
      </div>
      <div class="ledger-facts">
        <div><span>Coin</span><br><b>${s.coin}</b> copper${s.coin === 1 ? '' : 's'}</div>
        <div title="${watch ? '' : 'Without a watch, the days blur together'}"><span>Days below</span><br><b>${watch ? t.day : '?'}</b></div>
        <div><span>Relics delivered</span><div class="relic-pips">${Array.from({ length: state.artifactGoal }, (_, i) => `<i class="${i < state.artifactsDelivered ? 'on' : ''}"></i>`).join('')}</div></div>
      </div>

      <h3>Faces in the dark</h3>
      ${faces.length
        ? `<div class="faces">${faces.map(([key, npc]) => {
            const dead = isDead(npc);
            const align = dead ? 'dead' : alignmentOf(npc);
            return `<button type="button" class="face${dead ? ' dead' : ''}" data-npc="${escapeHtml(key)}">
              <span class="face-art">${faceArt(npc)}</span>
              <span class="face-name">${escapeHtml(npc.name)}<small>${escapeHtml(npc.type || 'stranger')}${dead ? ' · dead' : ''}</small></span>
              <span class="face-dot ${align}"></span>
            </button>`;
          }).join('')}</div>`
        : '<p class="empty-note">No one has seen fit to share their name.</p>'}

      <h3>The chronicle</h3>
      ${memory.length
        ? `<p class="chron-note">Older pages, condensed so the narrator remembers what the full text no longer shows.</p>
           ${memory.map((m, i) => `<p class="chron-entry"><span class="chron-mark">${ROMAN[i] || i + 1}</span>${escapeHtml(smartQuotes(m.summary))}</p>`).join('')}`
        : '<p class="empty-note">Nothing yet has faded enough to need the chronicler.</p>'}
    </div>`;
}

export function setSheetOpen(open) {
  const sheet = $('#sheet');
  if (sheet.classList.contains('open') === open) return;
  sheet.classList.toggle('open', open);
  sheet.setAttribute('aria-hidden', String(!open));
  $('#btn-sheet').setAttribute('aria-expanded', String(open));
  sfx(open ? 'open' : 'close');
  if (open) $('#sheet-close').focus({ preventScroll: true });
}

/* ---------------------------------------------------------------- entity menu */

const GLYPHS = {
  examine: '◈', pickup: '⇡', attack: '⚔︎', talk: '❝', trade: '⚖︎', gift: '❦', steal: '☍',
  use: '✧', equip: '⛨︎', unequip: '⤓', drop: '⤈', rotate: '⟳',
};
const LABELS = {
  examine: 'Examine', pickup: 'Pick Up', attack: 'Attack', talk: 'Talk', trade: 'Trade', gift: 'Gift', steal: 'Steal',
  use: 'Use', equip: 'Equip', unequip: 'Unequip', drop: 'Drop', rotate: 'Rotate',
};

let menuCleanup = null;

export function closeMenu() {
  const menu = $('#entity-menu');
  menu.hidden = true;
  document.querySelectorAll('.entity.active, [data-item].active').forEach((el) => el.classList.remove('active'));
  menuCleanup?.();
  menuCleanup = null;
}

/**
 * Opens the small action menu next to `anchor`.
 * @param {HTMLElement} anchor
 * @param {{ title: string, subtitle?: string, tone: string, actions: string[] }} spec
 * @param {(action: string) => void} onSelect
 */
export function openMenu(anchor, spec, onSelect) {
  closeMenu();
  sfx('menu');
  const menu = $('#entity-menu');
  menu.innerHTML = `
    <div class="menu-title ${spec.tone}">${escapeHtml(spec.title)}${spec.subtitle ? `<small>${escapeHtml(spec.subtitle)}</small>` : ''}</div>
    ${spec.actions.map((a) => `<button type="button" role="menuitem" data-action="${a}"><span class="glyph">${GLYPHS[a]}</span>${LABELS[a]}</button>`).join('')}`;
  menu.hidden = false;
  menu.classList.remove('above');
  anchor.classList.add('active');

  const rect = anchor.getClientRects()[0] || anchor.getBoundingClientRect();
  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;
  const margin = 8;
  const left = Math.min(Math.max(margin, rect.left - 6), window.innerWidth - mw - margin);
  let top = rect.bottom + 10;
  if (top + mh > window.innerHeight - margin) {
    top = rect.top - mh - 10;
    menu.classList.add('above');
  }
  menu.style.left = `${left}px`;
  menu.style.top = `${Math.max(margin, top)}px`;
  menu.style.setProperty('--arrow', `${Math.min(mw - 24, Math.max(10, rect.left + Math.min(rect.width, 60) / 2 - left - 5))}px`);

  const onClick = (e) => {
    const button = e.target.closest('button[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    closeMenu();
    onSelect(action);
  };
  const onOutside = (e) => {
    if (!menu.contains(e.target) && e.target !== anchor) closeMenu();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { closeMenu(); anchor.focus?.(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const buttons = [...menu.querySelectorAll('button')];
      const i = buttons.indexOf(document.activeElement);
      buttons[(i + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length].focus();
    }
  };
  menu.addEventListener('click', onClick);
  setTimeout(() => document.addEventListener('pointerdown', onOutside), 0);
  document.addEventListener('keydown', onKey);
  // Close once the anchor has scrolled noticeably away (small scrolls, e.g. focus nudges, are ignored).
  const scroller = anchor.closest('#story-scroll, .sheet-content, .inventory-content');
  const startScroll = scroller?.scrollTop ?? 0;
  const onScroll = () => { if (Math.abs(scroller.scrollTop - startScroll) > 40) closeMenu(); };
  scroller?.addEventListener('scroll', onScroll);
  window.addEventListener('resize', closeMenu, { once: true });
  menuCleanup = () => {
    menu.removeEventListener('click', onClick);
    document.removeEventListener('pointerdown', onOutside);
    document.removeEventListener('keydown', onKey);
    scroller?.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', closeMenu);
  };
  menu.querySelector('button')?.focus({ preventScroll: true });
}

/* ---------------------------------------------------------------- examine */

const ITEM_STAT_ORDER = ['damage', 'defense', 'durability', 'uses', 'weight', 'value', 'effect'];
const NPC_SKIP = new Set(['name', 'description', 'alignment', 'type', 'health', 'relationship', 'firstseen', 'lastseen', 'firstSeen', 'lastSeen', 'maxhealth', 'maxHealth', 'peakHealth']);
const ITEM_SKIP = new Set(['name', 'description', 'type', 'qty', 'maxDurability', 'slot', 'durability', 'id', 'x', 'y', 'rot']);
const label = (k) => cap(String(k).replace(/_/g, ' '));

function statChip(key, value) {
  const big = /^[+-]?\d+(\/\d+)?$/.test(String(value).trim());
  let v = escapeHtml(value);
  if (key === 'value') v = `${escapeHtml(value)}<small> cp</small>`;
  return `<div class="stat"><span class="stat-label">${escapeHtml(label(key))}</span><span class="stat-value${big ? ' big' : ''}">${v}</span></div>`;
}

let tiltCleanup = null;
let examined = null;

function attachTilt(card) {
  const stage = $('#examine');
  const plate = card.querySelector('.plate');
  let frame = 0;
  const onMove = (e) => {
    const r = card.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
    const y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      card.style.setProperty('--ry', `${x * 7}deg`);
      card.style.setProperty('--rx', `${-y * 6}deg`);
      if (plate) {
        const pr = plate.getBoundingClientRect();
        plate.style.setProperty('--gx', `${((e.clientX - pr.left) / pr.width) * 100}%`);
        plate.style.setProperty('--gy', `${((e.clientY - pr.top) / pr.height) * 100}%`);
        plate.style.setProperty('--tx', `${x * 9}px`);
        plate.style.setProperty('--ty', `${y * 7}px`);
      }
    });
  };
  const onLeave = () => {
    card.style.setProperty('--ry', '0deg');
    card.style.setProperty('--rx', '0deg');
    plate?.style.setProperty('--tx', '0px');
    plate?.style.setProperty('--ty', '0px');
  };
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerleave', onLeave);
  tiltCleanup = () => {
    cancelAnimationFrame(frame);
    stage.removeEventListener('pointermove', onMove);
    stage.removeEventListener('pointerleave', onLeave);
  };
}

let examineReturnFocus = null;
let examineKey = null;

export function closeExamine() {
  const overlay = $('#examine');
  if (overlay.hidden) return;
  overlay.hidden = true;
  examined = null;
  tiltCleanup?.();
  tiltCleanup = null;
  document.removeEventListener('keydown', examineKey);
  examineReturnFocus?.focus?.({ preventScroll: true });
}

function showExamine(html, cls, actions, onAction) {
  closeMenu();
  closeExamine();
  sfx('examine');
  examineReturnFocus = document.activeElement;
  const overlay = $('#examine');
  const card = $('#examine-card');
  card.className = `examine-card ${cls}`;
  card.style.setProperty('--rx', '0deg');
  card.style.setProperty('--ry', '0deg');
  card.innerHTML = `
    <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>
    <button class="examine-close" type="button" aria-label="Close">✕</button>
    ${html}
    ${actions.length ? `<div class="examine-actions">${actions.map((a) => `<button type="button" class="btn btn-small${a === 'attack' || a === 'steal' ? ' danger' : ''}" data-action="${a}">${LABELS[a]}</button>`).join('')}</div>` : ''}`;
  overlay.hidden = false;
  card.scrollTop = 0;

  card.querySelector('.examine-close').addEventListener('click', closeExamine);
  overlay.querySelector('[data-close]').onclick = closeExamine;
  card.querySelectorAll('.examine-actions button').forEach((b) => b.addEventListener('click', () => {
    closeExamine();
    onAction(b.dataset.action);
  }));
  examineKey = (e) => {
    if (e.key === 'Escape') closeExamine();
    if (e.key === 'Tab') {
      const focusable = [...card.querySelectorAll('button')];
      const i = focusable.indexOf(document.activeElement);
      e.preventDefault();
      focusable[(i + (e.shiftKey ? -1 : 1) + focusable.length) % focusable.length]?.focus();
    }
  };
  document.addEventListener('keydown', examineKey);
  attachTilt(card);
  card.querySelector('.examine-close').focus({ preventScroll: true });
}

/** The plate's picture: generated art when there is some, otherwise the hand-drawn one while the artist works. */
function plateArt(kind, subject, fallback) {
  requestArt(kind, subject);
  const img = artImg(kind, subject, 'plate-img');
  const sketching = !img && artEnabled() && isPending(kind, subject);
  return `<div class="plate-art${img ? ' has-art' : ''}">${img || fallback}</div>${sketching ? '<div class="sketching">The artist is sketching…</div>' : ''}`;
}

/** Called when an illustration arrives: swaps it into the open examine card. */
export function refreshExamineArt(key) {
  if (!examined || artKey(examined.kind, examined.subject) !== key) return;
  const plate = document.querySelector('#examine-card .plate');
  const img = artImg(examined.kind, examined.subject, 'plate-img');
  if (!plate || !img) return;
  plate.querySelector('.sketching')?.remove();
  const art = plate.querySelector('.plate-art');
  art.classList.add('has-art', 'arrived');
  art.innerHTML = img;
}

/** Shows an item's card. `actions` are the buttons offered underneath. */
export function examineItem(item, actions, onAction) {
  const type = String(item.type || 'curio').toLowerCase();
  const artifact = type === 'artifact' || type === 'relic';
  const stats = [];
  for (const key of ITEM_STAT_ORDER) {
    if (key === 'durability' || item[key] == null || item[key] === '') continue;
    stats.push(statChip(key, item[key]));
  }
  for (const [key, value] of Object.entries(item)) {
    if (ITEM_SKIP.has(key) || ITEM_STAT_ORDER.includes(key) || value === '' || value == null || typeof value === 'object') continue;
    stats.push(statChip(key, value));
  }
  const dur = toNum(item.durability);
  const maxDur = toNum(item.maxDurability) ?? dur;
  const durability = dur != null
    ? `<div class="meter"><div class="meter-head"><span>Durability</span><b>${dur}${maxDur ? ` / ${maxDur}` : ''}</b></div><div class="meter-track"><div class="meter-fill dur" style="width:${pct(dur, maxDur || dur || 1)}"></div></div></div>`
    : '';
  showExamine(`
    <div class="plate${artifact ? ' artifact' : ''}" data-icon="${itemIconKey(item)}">
      ${plateArt('item', item, itemIcon(item))}
      <div class="dust"></div><div class="glare"></div>
    </div>
    <p class="examine-kicker">${artifact ? '✶ Relic of the Dakavi' : escapeHtml(cap(type))}${(item.qty || 1) > 1 ? ` · ×${item.qty}` : ''}</p>
    <h2 class="examine-name">${escapeHtml(cap(item.name))}</h2>
    ${item.description ? `<p class="examine-desc">${escapeHtml(smartQuotes(item.description))}</p>` : ''}
    ${durability}
    ${stats.length ? `<div class="stat-grid">${stats.join('')}</div>` : ''}`,
  `item${artifact ? ' artifact' : ''}`, actions, onAction);
  examined = { kind: 'item', subject: item };
}

/** Shows an NPC's card. */
export function examineNpc(npc, actions, onAction) {
  const alignment = alignmentOf(npc);
  const dead = isDead(npc);
  const hp = toNum(npc.health);
  const maxHp = Math.max(hp ?? 0, toNum(npc.maxhealth ?? npc.maxHealth ?? npc.peakHealth) ?? 0);
  const rel = Math.max(-10, Math.min(10, toNum(npc.relationship) ?? 0));
  const feeling = rel <= -7 ? 'Loathes you' : rel <= -3 ? 'Distrusts you' : rel < 3 ? 'Indifferent' : rel < 7 ? 'Warm to you' : 'Devoted';
  const stats = [];
  for (const [key, value] of Object.entries(npc)) {
    if (NPC_SKIP.has(key) || value === '' || value == null || typeof value === 'object') continue;
    stats.push(statChip(key, value));
  }
  showExamine(`
    <div class="plate portrait${dead ? ' dead' : ''}">
      ${plateArt('npc', npc, npcPortrait(npc, alignment))}
      ${dead ? '<div class="stamp">Slain</div>' : ''}
      <div class="dust"></div><div class="glare"></div>
    </div>
    <p class="examine-kicker">${escapeHtml(cap(npc.type || 'stranger'))} · ${dead ? 'Dead' : cap(alignment)}</p>
    <h2 class="examine-name">${escapeHtml(cap(npc.name))}</h2>
    ${npc.description ? `<p class="examine-desc">${escapeHtml(smartQuotes(npc.description))}</p>` : ''}
    ${hp != null ? `<div class="meter"><div class="meter-head"><span>Health</span><b>${dead ? 'None' : hp}</b></div><div class="meter-track"><div class="meter-fill" style="width:${pct(hp, maxHp || 1)}"></div></div></div>` : ''}
    <div class="meter"><div class="meter-head"><span>Regard for you</span><b>${feeling} (${rel > 0 ? '+' : ''}${rel})</b></div><div class="meter-track relation"><div class="meter-mark" style="left:${((rel + 10) / 20) * 100}%"></div></div></div>
    ${stats.length ? `<div class="stat-grid">${stats.join('')}</div>` : ''}`,
  `npc ${alignment}`, dead ? actions.filter((a) => a === 'examine') : actions, onAction);
  examined = { kind: 'npc', subject: npc };
}

/* ---------------------------------------------------------------- effects */

export function flash(kind) {
  const el = document.querySelector('.flash');
  el.className = 'flash';
  void el.offsetWidth;
  el.classList.add(kind);
  if (kind === 'hurt') {
    document.body.classList.remove('shake');
    void document.body.offsetWidth;
    document.body.classList.add('shake');
    setTimeout(() => document.body.classList.remove('shake'), 450);
  }
}

export function showEnding(state, onNew, onRead) {
  const overlay = $('#ending');
  const freed = state.ended === 'freedom';
  const { day } = clockParts(state.clock);
  overlay.className = `ending ${freed ? 'freedom' : 'death'}`;
  $('#ending-kicker').textContent = freed ? `After ${day} day${day === 1 ? '' : 's'} below` : `Day ${day} in Dakavinor`;
  $('#ending-title').textContent = freed ? 'Daylight' : 'The dark keeps you';
  const name = escapeHtml(state.character.name);
  $('#ending-text').innerHTML = freed
    ? `${name} climbs the Long Stair for the last time, into a sun that burns like judgement. The Crown keeps its word, this once.`
    : `${name} will not climb the Long Stair again. <span class="num">${state.artifactsDelivered}</span> of <span class="num">${state.artifactGoal}</span> relics were delivered. Someone else will find what’s left.`;
  overlay.hidden = false;
  $('#btn-ending-new').onclick = onNew;
  $('#btn-ending-read').onclick = () => { overlay.hidden = true; onRead?.(); };
  $('#btn-ending-new').focus();
}
