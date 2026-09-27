import { ATTRIBUTES, SLOTS, randomName, rollCharacter } from './character.js';
import { itemIcon } from './icons.js';
import { applyTag, inferSlot, npcKey, alignmentOf, isDead } from './state.js';
import { Passage, entities, refreshNpcMentions } from './story.js';
import { startMotes } from './atmosphere.js';
import {
  renderHud, renderSheet, setSheetOpen, openMenu, closeMenu, examineItem, examineNpc,
  closeExamine, flash, showEnding, escapeHtml,
} from './ui.js';

const SAVE_KEY = 'descend.save.v1';
const $ = (sel) => document.querySelector(sel);

const WAITING_LINES = [
  'The torch gutters…',
  'Something shifts in the dark…',
  'Water drips, counting the moments…',
  'The dark considers your deed…',
  'Far below, something listens…',
  'Stone settles. Dust falls…',
];

/** The whole game: character sheet, the transcript sent to the narrator, and the rendered log. */
let game = null;
let draft = null;
let busy = false;

/* ---------------------------------------------------------------- persistence */

function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(game));
  } catch {
    // Storage full or blocked; the game continues unsaved.
  }
}

function loadSave() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (data?.version === 1 && data.state && Array.isArray(data.history) && Array.isArray(data.log)) return data;
  } catch {
    // Corrupt save; ignore it.
  }
  return null;
}

function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

/* ---------------------------------------------------------------- screens */

function show(screen) {
  for (const id of ['screen-title', 'screen-create', 'screen-game']) $(`#${id}`).hidden = id !== screen;
  closeMenu();
  closeExamine();
  setSheetOpen(false);
  $('#ending').hidden = true;
}

function showTitle() {
  const saved = loadSave();
  $('#btn-continue').hidden = !saved;
  $('#btn-continue').textContent = saved?.state.ended ? 'Read your last tale' : 'Continue the descent';
  show('screen-title');
}

/* ---------------------------------------------------------------- character creation */

function pronouns() {
  return document.querySelector('input[name="pronouns"]:checked')?.value || 'they/them';
}

function renderWrit() {
  const { character: c, stats: s, equipment, pack } = draft;
  const name = $('#cc-name').value.trim() || c.name;
  const [subject] = pronouns().split('/');
  const verb = subject === 'they' ? 'are' : 'is';
  $('#cc-body').innerHTML = `Let it be known that <strong>${escapeHtml(name)}</strong>, ${escapeHtml(c.background)}, having been found guilty of <strong>${escapeHtml(c.crime)}</strong>, ${verb} hereby sentenced to the ruins of Dakavinor, there to recover the relics of the old kingdom, or perish in the attempt.`;
  $('#cc-stats').innerHTML = `
    ${ATTRIBUTES.map((a) => `<div title="${escapeHtml(a.blurb)}"><dt>${a.label}</dt><dd>${s[a.key]}</dd></div>`).join('')}
    <div><dt>Health</dt><dd>${s.maxHealth}</dd></div>
    <div><dt>Coin</dt><dd>${s.coin}</dd></div>`;
  const gear = [
    ...SLOTS.map(({ key, label }) => (equipment[key] ? { item: equipment[key], note: label } : null)).filter(Boolean),
    ...pack.map((item) => ({ item, note: 'in the pack' })),
  ];
  $('#cc-gear').innerHTML = gear.map(({ item, note }) => `<li>${itemIcon(item)}<span>${escapeHtml(item.name)}<small>${escapeHtml(note)}</small></span></li>`).join('');
}

function startCreation() {
  const name = randomName();
  $('#cc-name').value = name;
  draft = rollCharacter({ name, pronouns: pronouns() });
  renderWrit();
  show('screen-create');
  $('#cc-name').focus();
}

function beginGame() {
  const state = structuredClone(draft);
  state.character.name = $('#cc-name').value.trim() || draft.character.name;
  state.character.pronouns = pronouns();
  game = { version: 1, state, history: [], log: [] };
  entities.clear();
  save();
  enterGame();
  runTurn(null);
}

/* ---------------------------------------------------------------- game screen */

function npcClass(key) {
  const npc = game.state.npcs[key];
  if (!npc) return 'neutral';
  return `${alignmentOf(npc)}${isDead(npc) ? ' dead' : ''}`;
}

function renderNotices(container, notices) {
  if (!notices.length) return;
  const seen = new Set();
  const unique = notices.filter((n) => !seen.has(n.text) && seen.add(n.text));
  const list = document.createElement('ul');
  list.className = 'notices';
  list.innerHTML = unique.map((n, i) => `<li class="notice ${n.kind}" style="animation-delay:${i * 80}ms">${escapeHtml(n.text)}</li>`).join('');
  container.appendChild(list);
}

function createTurnElement(action) {
  const turn = document.createElement('section');
  turn.className = 'turn';
  if (action) {
    const line = document.createElement('div');
    line.className = 'turn-action';
    line.textContent = action;
    turn.appendChild(line);
  }
  const passage = document.createElement('div');
  passage.className = 'passage';
  turn.appendChild(passage);
  $('#story').appendChild(turn);
  return { turn, passageEl: passage };
}

/** A decorative initial on the tale's first paragraph, unless it opens on a highlighted name. */
function markDropCap(passageEl) {
  const first = passageEl.querySelector('p');
  if (first?.firstChild?.nodeType === Node.TEXT_NODE && /^\s*\p{L}/u.test(first.firstChild.textContent)) first.classList.add('dropcap');
}

function enterGame() {
  show('screen-game');
  const story = $('#story');
  story.innerHTML = '';
  entities.clear();
  // Replay the saved log; state tags were already applied, so only the prose is rebuilt.
  for (const entry of game.log) {
    const { turn, passageEl } = createTurnElement(entry.action);
    const passage = new Passage(passageEl, { npcClass });
    passage.push(entry.raw);
    passage.end();
    if (entry === game.log[0]) markDropCap(passageEl);
    renderNotices(turn, entry.notices || []);
  }
  renderHud(game.state);
  renderSheet(game.state);
  const ended = Boolean(game.state.ended);
  setInputEnabled(!ended);
  requestAnimationFrame(() => { $('#story-scroll').scrollTop = $('#story-scroll').scrollHeight; });
  if (ended) showEnding(game.state, newGame, () => {});
  else $('#action-input').focus({ preventScroll: true });
}

function setInputEnabled(enabled) {
  const input = $('#action-input');
  input.disabled = !enabled;
  $('#btn-act').disabled = !enabled;
  input.placeholder = game?.state.ended ? 'Your tale is ended.' : 'What do you do?';
}

function nearBottom() {
  const s = $('#story-scroll');
  return s.scrollHeight - s.scrollTop - s.clientHeight < 140;
}

function scrollToBottom(force) {
  const s = $('#story-scroll');
  if (force || nearBottom()) s.scrollTop = s.scrollHeight;
}

function autosize() {
  const input = $('#action-input');
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
}

/** Adds an action to the input box, e.g. "pick up rusted sword". */
function appendAction(text) {
  if (game?.state.ended) return;
  const input = $('#action-input');
  const current = input.value.trim().replace(/[.,;]+$/, '');
  input.value = current ? `${current}, then ${text[0].toLowerCase()}${text.slice(1)}` : text;
  autosize();
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}

/* ---------------------------------------------------------------- a turn */

async function* readEvents(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline;
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) yield JSON.parse(line);
    }
  }
  if (buffer.trim()) yield JSON.parse(buffer);
}

function effectsFor(notices) {
  for (const n of notices) {
    if (n.stat === 'health' && n.delta < 0) return flash('hurt');
    if (n.stat === 'sanity' && n.delta < 0) return flash('dread');
    if (n.kind === 'deliver') return flash('boon');
  }
}

/** Fields of the most recent [Item] tag with this name, so a terse [Gain] still gets its stats. */
function lastSeenItem(name) {
  const key = npcKey(name);
  let found = null;
  for (const entity of entities.values()) if (entity.kind === 'item' && entity.key === key) found = entity.data;
  if (!found) return {};
  const { name: _name, ...fields } = found;
  return fields;
}

async function runTurn(action) {
  if (busy || !game || game.state.ended) return;
  busy = true;
  setInputEnabled(false);
  $('#btn-act').textContent = '…';

  const before = structuredClone(game.state);
  const { turn, passageEl } = createTurnElement(action);
  passageEl.classList.add('streaming');
  const waiting = document.createElement('div');
  waiting.className = 'waiting';
  waiting.innerHTML = `<span class="ember"></span><span class="waiting-text">${WAITING_LINES[Math.floor(Math.random() * WAITING_LINES.length)]}</span>`;
  passageEl.before(waiting);
  scrollToBottom(true);

  game.state.turn = (before.turn || 0) + 1;
  const notices = [];
  const passage = new Passage(passageEl, {
    npcClass,
    onTag: (tag) => {
      if (tag.kind === 'gain') tag.fields = { ...lastSeenItem(tag.value), ...tag.fields };
      const changes = applyTag(game.state, tag);
      if (tag.kind === 'npc') {
        const key = npcKey(tag.value);
        if (game.state.npcs[key]) refreshNpcMentions($('#story'), key, game.state.npcs[key]);
      }
      if (changes.length) {
        notices.push(...changes);
        effectsFor(changes);
        renderHud(game.state);
      }
    },
  });

  let userContent = null;
  let outcome = null;
  try {
    const response = await fetch('/api/turn', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ history: game.history, state: before, action }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw Object.assign(new Error(body.error || `The narrator did not answer (${response.status}).`), { retry: response.status >= 500 });
    }
    for await (const event of readEvents(response)) {
      if (event.type === 'turn') userContent = event.userContent;
      else if (event.type === 'text') {
        waiting.remove();
        const follow = nearBottom();
        passage.push(event.text);
        if (follow) scrollToBottom(true);
      } else outcome = event;
    }
    if (!outcome) throw Object.assign(new Error('The narrator fell silent mid-sentence. The connection was lost.'), { retry: true });
    if (outcome.type === 'error') throw Object.assign(new Error(outcome.message), { retry: outcome.retry });
    if (outcome.type === 'refusal') throw Object.assign(new Error(outcome.message), { retry: false });
    if (!userContent || !passage.raw.trim()) throw Object.assign(new Error('The narrator had nothing to say. Try again.'), { retry: true });
  } catch (error) {
    // Undo everything this turn did and offer the action back.
    game.state = before;
    turn.remove();
    waiting.remove();
    renderHud(game.state);
    renderSheet(game.state);
    for (const [key, npc] of Object.entries(game.state.npcs)) refreshNpcMentions($('#story'), key, npc);
    showError(error, action);
    busy = false;
    $('#btn-act').textContent = 'Act';
    setInputEnabled(true);
    if (action) {
      $('#action-input').value = action;
      autosize();
    }
    return;
  }

  passage.end();
  passageEl.classList.remove('streaming');
  if (!game.log.length) markDropCap(passageEl);
  renderNotices(turn, notices);

  if (game.state.stats.health <= 0 && !game.state.ended) game.state.ended = 'death';
  game.history.push({ role: 'user', content: userContent }, { role: 'assistant', content: passage.raw });
  game.log.push({ action, raw: passage.raw, notices });
  save();

  renderHud(game.state);
  renderSheet(game.state);
  scrollToBottom(false);
  busy = false;
  $('#btn-act').textContent = 'Act';
  setInputEnabled(!game.state.ended);
  if (game.state.ended) setTimeout(() => showEnding(game.state, newGame, () => {}), 1800);
  else if (!matchMedia('(pointer: coarse)').matches) $('#action-input').focus({ preventScroll: true });
}

function showError(error, action) {
  document.querySelector('.story-error')?.remove();
  const box = document.createElement('div');
  box.className = 'story-error';
  box.innerHTML = `<p>${escapeHtml(error.message || 'Something went wrong.')}</p>`;
  if (error.retry !== false || !action) {
    const retry = document.createElement('button');
    retry.className = 'btn btn-small';
    retry.type = 'button';
    retry.textContent = action ? 'Try again' : 'Begin again';
    retry.addEventListener('click', () => {
      box.remove();
      $('#action-input').value = '';
      autosize();
      runTurn(action);
    });
    box.appendChild(retry);
  }
  $('#story').appendChild(box);
  scrollToBottom(true);
}

/* ---------------------------------------------------------------- interacting with entities */

const NPC_ACTIONS = ['attack', 'examine', 'talk', 'trade', 'gift', 'steal'];

function npcActionText(action, name) {
  return {
    attack: `Attack ${name}`,
    talk: `Talk to ${name}`,
    trade: `Trade with ${name}`,
    gift: `Gift ${name} `,
    steal: `Steal from ${name}`,
  }[action];
}

function openNpc(anchor, key, fallback) {
  const npc = game.state.npcs[key] || fallback;
  const dead = isDead(npc);
  const alignment = alignmentOf(npc);
  const act = (action) => {
    if (action === 'examine') {
      examineNpc(game.state.npcs[key] || npc, NPC_ACTIONS.filter((a) => a !== 'examine'), act);
    } else {
      appendAction(npcActionText(action, npc.name));
    }
  };
  openMenu(anchor, {
    title: npc.name,
    subtitle: `${npc.type || 'stranger'} · ${dead ? 'dead' : alignment}`,
    tone: dead ? 'neutral' : alignment,
    actions: dead ? ['examine', 'steal'] : NPC_ACTIONS,
  }, act);
}

function openStoryItem(anchor, entity) {
  const item = entity.data;
  const act = (action) => {
    if (action === 'examine') examineItem(item, ['pickup'], act);
    else if (action === 'pickup') appendAction(`pick up ${entity.name}`);
  };
  openMenu(anchor, { title: entity.name, subtitle: item.type || 'item', tone: 'item', actions: ['examine', 'pickup'] }, act);
}

function openCarriedItem(anchor, item, equipped) {
  const actions = ['examine', 'use'];
  if (equipped) actions.push('unequip');
  else if (inferSlot(item)) actions.push('equip');
  actions.push('drop');
  const act = (action) => {
    if (action === 'examine') {
      examineItem(item, actions.filter((a) => a !== 'examine'), act);
      return;
    }
    setSheetOpen(false);
    appendAction(`${action} ${item.name}`);
  };
  openMenu(anchor, { title: item.name, subtitle: equipped ? `${item.type || 'item'} · equipped` : item.type || 'item', tone: 'item', actions }, act);
}

function onStoryActivate(target) {
  const el = target.closest('.entity');
  if (!el) return;
  const entity = entities.get(el.dataset.eid);
  if (!entity) return;
  if (entity.kind === 'npc') openNpc(el, entity.key, entity.data);
  else openStoryItem(el, entity);
}

function onSheetActivate(target) {
  const slot = target.closest('[data-slot]');
  const packed = target.closest('[data-pack]');
  const face = target.closest('[data-npc]');
  if (slot) {
    const item = game.state.equipment[slot.dataset.slot];
    if (item) openCarriedItem(slot, item, true);
  } else if (packed) {
    const item = game.state.pack[Number(packed.dataset.pack)];
    if (item) openCarriedItem(packed, item, false);
  } else if (face) {
    const npc = game.state.npcs[face.dataset.npc];
    if (!npc) return;
    const act = (action) => {
      if (action === 'examine') examineNpc(npc, NPC_ACTIONS.filter((a) => a !== 'examine'), (a) => { setSheetOpen(false); appendAction(npcActionText(a, npc.name)); });
      else { setSheetOpen(false); appendAction(npcActionText(action, npc.name)); }
    };
    const dead = isDead(npc);
    openMenu(face, { title: npc.name, subtitle: `${npc.type || 'stranger'} · ${dead ? 'dead' : alignmentOf(npc)}`, tone: dead ? 'neutral' : alignmentOf(npc), actions: dead ? ['examine'] : NPC_ACTIONS }, act);
  }
}

/* ---------------------------------------------------------------- new game / menu */

function newGame() {
  if (game && !game.state.ended && game.log.length && !confirm('Abandon this prisoner to the dark and begin anew?')) return;
  clearSave();
  game = null;
  startCreation();
}

/* ---------------------------------------------------------------- wiring */

function wire() {
  $('#btn-new').addEventListener('click', () => {
    if (loadSave() && !loadSave().state.ended && !confirm('Your current prisoner will be lost to the dark. Begin anew?')) return;
    clearSave();
    startCreation();
  });
  $('#btn-continue').addEventListener('click', () => {
    game = loadSave();
    if (game) enterGame();
  });

  $('#btn-reroll').addEventListener('click', () => {
    draft = rollCharacter({ name: $('#cc-name').value.trim() || randomName(), pronouns: pronouns() });
    renderWrit();
    const writ = document.querySelector('.writ');
    writ.style.animation = 'none';
    void writ.offsetWidth;
    writ.style.animation = '';
  });
  $('#btn-begin').addEventListener('click', beginGame);
  $('#cc-name').addEventListener('input', renderWrit);
  document.querySelectorAll('input[name="pronouns"]').forEach((r) => r.addEventListener('change', renderWrit));

  const form = $('#action-form');
  const input = $('#action-input');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const action = input.value.trim();
    if (!action || busy) return;
    input.value = '';
    autosize();
    document.querySelector('.story-error')?.remove();
    runTurn(action);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  input.addEventListener('input', autosize);

  const story = $('#story');
  story.addEventListener('click', (e) => onStoryActivate(e.target));
  story.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.entity')) {
      e.preventDefault();
      onStoryActivate(e.target);
    }
  });

  $('#btn-sheet').addEventListener('click', () => {
    const open = !$('#sheet').classList.contains('open');
    if (open) renderSheet(game.state);
    setSheetOpen(open);
  });
  $('#sheet-close').addEventListener('click', () => setSheetOpen(false));
  $('#sheet-content').addEventListener('click', (e) => onSheetActivate(e.target));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#entity-menu').hidden && $('#examine').hidden && $('#sheet').classList.contains('open')) {
      setSheetOpen(false);
      $('#btn-sheet').focus();
    }
  });

  const menuButton = $('#btn-menu');
  const menu = $('#game-menu');
  const closeGameMenu = () => { menu.hidden = true; menuButton.setAttribute('aria-expanded', 'false'); };
  menuButton.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
    menuButton.setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.addEventListener('click', (e) => { if (!menu.contains(e.target)) closeGameMenu(); });
  menu.addEventListener('click', (e) => {
    const choice = e.target.closest('button')?.dataset.menu;
    closeGameMenu();
    if (choice === 'new') newGame();
    if (choice === 'title') showTitle();
  });
}

async function showNarratorStatus() {
  try {
    const status = await (await fetch('/api/status')).json();
    $('#narrator-status').textContent = status.mock
      ? 'Mock narrator: a canned tale, no AI calls'
      : `Narrated by ${status.model}`;
  } catch {
    $('#narrator-status').textContent = 'The narrator cannot be reached. Is the server running?';
  }
}

wire();
startMotes($('#motes'));
showTitle();
showNarratorStatus();
