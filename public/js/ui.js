// Interface pieces: HUD, character ledger, entity menus, examine cards, effects.

import { ATTRIBUTES, SLOTS } from './character.js';
import { itemIcon, itemIconKey, npcPortrait } from './icons.js';
import { alignmentOf, isDead } from './state.js';
import { smartQuotes } from './story.js';

const $ = (sel) => document.querySelector(sel);
export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const cap = (s) => (s ? String(s)[0].toUpperCase() + String(s).slice(1) : '');
const pct = (v, max) => `${Math.max(0, Math.min(100, (Number(v) / Number(max)) * 100))}%`;
const toNum = (v) => {
  const n = parseInt(String(v ?? '').replace(/[^\d+-]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
};

/* ---------------------------------------------------------------- time icons */

const TIME_ICONS = {
  dawn: '<svg viewBox="0 0 16 16"><path d="M1 12h14" stroke="#c98a5a" stroke-width="1.5"/><path d="M4 12a4 4 0 0 1 8 0" fill="#e8a060"/><path d="M8 3v2M3 6l1.4 1.4M13 6l-1.4 1.4" stroke="#e8a060" stroke-width="1.3" stroke-linecap="round"/></svg>',
  day: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="3.4" fill="#e8c05a"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3" stroke="#e8c05a" stroke-width="1.3" stroke-linecap="round"/></svg>',
  dusk: '<svg viewBox="0 0 16 16"><path d="M1 11h14" stroke="#8a5a6a" stroke-width="1.5"/><path d="M4 11a4 4 0 0 1 8 0" fill="#b0584a"/><path d="M3 14h10" stroke="#5a3a4a" stroke-width="1.2"/></svg>',
  night: '<svg viewBox="0 0 16 16"><path d="M10.5 2.2A6 6 0 1 0 13.8 11 5 5 0 0 1 10.5 2.2z" fill="#b8b4d8"/><circle cx="3" cy="3" r=".7" fill="#b8b4d8"/><circle cx="14" cy="5" r=".6" fill="#b8b4d8"/></svg>',
};

/* ---------------------------------------------------------------- HUD */

export function renderHud(state) {
  const s = state.stats;
  const loc = $('#hud-location');
  if (loc.textContent !== state.location) {
    loc.textContent = state.location;
    loc.classList.remove('fresh');
    void loc.offsetWidth;
    loc.classList.add('fresh');
  }
  $('#hud-time-icon').innerHTML = TIME_ICONS[state.time] || TIME_ICONS.night;
  $('#hud-day').textContent = `Day ${state.day} · ${cap(state.time)}`;
  const gate = $('#hud-gate');
  const open = state.time === 'day';
  gate.textContent = open ? 'Gate open' : 'Gate sealed';
  gate.className = `gate ${open ? 'open' : 'sealed'}`;

  const set = (key, value, max, low) => {
    $(`#bar-${key}`).style.width = pct(value, max);
    $(`#num-${key}`).textContent = `${value}/${max}`;
    $(`#bar-${key}`).closest('.vital').classList.toggle('low', low);
  };
  set('health', s.health, s.maxHealth, s.health <= Math.ceil(s.maxHealth * 0.3));
  set('hunger', s.hunger, 10, s.hunger >= 8);
  set('sanity', s.sanity, 10, s.sanity <= 3);
  $('#hud-artifacts').textContent = `${state.artifactsDelivered}/${state.artifactGoal}`;
  document.body.dataset.time = state.time;
}

/* ---------------------------------------------------------------- ledger */

function itemTile(item, attrs, cls) {
  const artifact = String(item.type).toLowerCase() === 'artifact';
  return `<button type="button" class="${cls}${artifact ? ' artifact' : ''}" ${attrs} title="${escapeHtml(item.name)}">
    ${itemIcon(item)}
    ${(item.qty || 1) > 1 ? `<span class="qty">×${item.qty}</span>` : ''}
    <span class="${cls === 'slot' ? 'slot-name' : 'pack-name'}">${escapeHtml(item.name)}</span>
  </button>`;
}

export function renderSheet(state) {
  const { character: c, stats: s } = state;
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
        <div><span>Days below</span><br><b>${state.day}</b></div>
        <div><span>Relics delivered</span><div class="relic-pips">${Array.from({ length: state.artifactGoal }, (_, i) => `<i class="${i < state.artifactsDelivered ? 'on' : ''}"></i>`).join('')}</div></div>
      </div>

      <h3>Worn &amp; wielded</h3>
      <div class="slots">
        ${SLOTS.map(({ key, label }) => {
          const item = state.equipment[key];
          if (!item) return `<div class="slot empty"><span class="slot-empty">·</span><span class="slot-label">${label}</span></div>`;
          return itemTile(item, `data-slot="${key}"`, 'slot').replace('</button>', `<span class="slot-label">${label}</span></button>`);
        }).join('')}
      </div>

      <h3>Pack</h3>
      ${state.pack.length
        ? `<div class="pack">${state.pack.map((item, i) => itemTile(item, `data-pack="${i}"`, 'pack-item')).join('')}</div>`
        : '<p class="empty-note">Nothing but lint and regret.</p>'}

      <h3>Faces in the dark</h3>
      ${faces.length
        ? `<div class="faces">${faces.map(([key, npc]) => {
            const dead = isDead(npc);
            const align = dead ? 'dead' : alignmentOf(npc);
            return `<button type="button" class="face${dead ? ' dead' : ''}" data-npc="${escapeHtml(key)}">
              <span class="face-art">${npcPortrait(npc, alignmentOf(npc))}</span>
              <span class="face-name">${escapeHtml(npc.name)}<small>${escapeHtml(npc.type || 'stranger')}${dead ? ' · dead' : ''}</small></span>
              <span class="face-dot ${align}"></span>
            </button>`;
          }).join('')}</div>`
        : '<p class="empty-note">No one has seen fit to share their name.</p>'}
    </div>`;
}

export function setSheetOpen(open) {
  const sheet = $('#sheet');
  sheet.classList.toggle('open', open);
  sheet.setAttribute('aria-hidden', String(!open));
  $('#btn-sheet').setAttribute('aria-expanded', String(open));
  if (open) $('#sheet-close').focus({ preventScroll: true });
}

/* ---------------------------------------------------------------- entity menu */

const GLYPHS = {
  examine: '◈', pickup: '⇡', attack: '⚔︎', talk: '❝', trade: '⚖︎', gift: '❦', steal: '☍',
  use: '✧', equip: '⛨︎', unequip: '⤓', drop: '⤈',
};
const LABELS = {
  examine: 'Examine', pickup: 'Pick Up', attack: 'Attack', talk: 'Talk', trade: 'Trade', gift: 'Gift', steal: 'Steal',
  use: 'Use', equip: 'Equip', unequip: 'Unequip', drop: 'Drop',
};

let menuCleanup = null;

export function closeMenu() {
  const menu = $('#entity-menu');
  menu.hidden = true;
  document.querySelectorAll('.entity.active').forEach((el) => el.classList.remove('active'));
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
  let left = Math.min(Math.max(margin, rect.left - 6), window.innerWidth - mw - margin);
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
  const scroller = anchor.closest('#story-scroll, .sheet-content');
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
const ITEM_SKIP = new Set(['name', 'description', 'type', 'qty', 'maxDurability', 'slot', 'durability']);
const label = (k) => cap(String(k).replace(/_/g, ' '));

function statChip(key, value) {
  const big = /^[+-]?\d+(\/\d+)?$/.test(String(value).trim());
  let v = escapeHtml(value);
  if (key === 'value') v = `${escapeHtml(value)}<small> cp</small>`;
  return `<div class="stat"><span class="stat-label">${escapeHtml(label(key))}</span><span class="stat-value${big ? ' big' : ''}">${v}</span></div>`;
}

let tiltCleanup = null;

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
        const gx = ((e.clientX - pr.left) / pr.width) * 100;
        const gy = ((e.clientY - pr.top) / pr.height) * 100;
        plate.style.setProperty('--gx', `${gx}%`);
        plate.style.setProperty('--gy', `${gy}%`);
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
  tiltCleanup?.();
  tiltCleanup = null;
  document.removeEventListener('keydown', examineKey);
  examineReturnFocus?.focus?.({ preventScroll: true });
}

function showExamine(html, cls, actions, onAction) {
  closeMenu();
  closeExamine();
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

/** Shows an item's card. `actions` are the buttons offered underneath. */
export function examineItem(item, actions, onAction) {
  const type = String(item.type || 'curio').toLowerCase();
  const artifact = type === 'artifact';
  const stats = [];
  for (const key of ITEM_STAT_ORDER) {
    if (key === 'durability' || item[key] == null || item[key] === '') continue;
    stats.push(statChip(key, item[key]));
  }
  for (const [key, value] of Object.entries(item)) {
    if (ITEM_SKIP.has(key) || ITEM_STAT_ORDER.includes(key) || value === '' || value == null) continue;
    stats.push(statChip(key, value));
  }
  const dur = toNum(item.durability);
  const maxDur = toNum(item.maxDurability) ?? dur;
  const durability = dur != null
    ? `<div class="meter"><div class="meter-head"><span>Durability</span><b>${dur}${maxDur ? ` / ${maxDur}` : ''}</b></div><div class="meter-track"><div class="meter-fill dur" style="width:${pct(dur, maxDur || dur || 1)}"></div></div></div>`
    : '';
  showExamine(`
    <div class="plate${artifact ? ' artifact' : ''}" data-icon="${itemIconKey(item)}">
      <div class="plate-art">${itemIcon(item)}</div>
      <div class="dust"></div><div class="glare"></div>
    </div>
    <p class="examine-kicker">${artifact ? '✶ Relic of the Dakavi' : escapeHtml(cap(type))}${(item.qty || 1) > 1 ? ` · ×${item.qty}` : ''}</p>
    <h2 class="examine-name">${escapeHtml(cap(item.name))}</h2>
    ${item.description ? `<p class="examine-desc">${escapeHtml(smartQuotes(item.description))}</p>` : ''}
    ${durability}
    ${stats.length ? `<div class="stat-grid">${stats.join('')}</div>` : ''}`,
  `item${artifact ? ' artifact' : ''}`, actions, onAction);
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
      <div class="plate-art">${npcPortrait(npc, alignment)}</div>
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
  overlay.className = `ending ${freed ? 'freedom' : 'death'}`;
  $('#ending-kicker').textContent = freed ? `After ${state.day} day${state.day === 1 ? '' : 's'} below` : `Day ${state.day} in Dakavinor`;
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
