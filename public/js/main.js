import { ATTRIBUTES, SLOTS, randomName, rollCharacter } from './character.js';
import { itemIcon, PERSON_GLYPH, LEDGER_GLYPH } from './icons.js';
import { applyTag, npcKey, alignmentOf, isDead, hasWatch, slotAccepts, targetSlot, migrateState } from './state.js';
import { itemShape } from './grid.js';
import { Passage, entities, refreshNpcMentions } from './story.js';
import { startMotes } from './atmosphere.js';
import { settings, saveSettings, detectProvider, server, effectiveProvider, narratorReady, PROVIDER_LABELS } from './settings.js';
import { postJson, getJson, streamTurn } from './api.js';
import { needsCompaction, compact } from './memory.js';
import { initArt, requestArt, dropArt, resetArtSession } from './art.js';
import { sfx, unlockAudio, configureAudio } from './audio.js';
import { initInventory, renderInventory, setInventoryOpen, isInventoryOpen } from './inventory.js';
import {
  renderHud, renderSheet, setSheetOpen, openMenu, closeMenu, examineItem, examineNpc,
  closeExamine, flash, showEnding, escapeHtml, refreshExamineArt,
} from './ui.js';

const SAVE_KEY = 'descend.save.v2';
const OLD_SAVE_KEY = 'descend.save.v1';
const $ = (sel) => document.querySelector(sel);
const TIME_NOTICES = new Set(['elapsed', 'gate', 'dawn', 'time']);

const WAITING_LINES = [
  'The torch gutters…',
  'Something shifts in the dark…',
  'Water drips, counting the moments…',
  'The dark considers your deed…',
  'Far below, something listens…',
  'Stone settles. Dust falls…',
];

/**
 * The whole game: the character sheet, the recent transcript sent to the narrator, the chronicle
 * of condensed older turns, the full rendered log, and generated illustrations.
 */
let game = null;
let draft = null;
let busy = false;
let compacting = null;

/* ---------------------------------------------------------------- persistence */

function save() {
  if (!game) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(game));
    localStorage.removeItem(OLD_SAVE_KEY);
  } catch {
    // Storage full or blocked; the game continues unsaved.
  }
}

function loadSave() {
  try {
    let data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (!data) {
      const old = JSON.parse(localStorage.getItem(OLD_SAVE_KEY) || 'null');
      if (old?.version === 1 && old.state) data = { ...old, version: 2, state: migrateState(old.state), memory: [], art: {} };
    }
    if (data?.version === 2 && data.state && Array.isArray(data.history) && Array.isArray(data.log)) {
      data.memory ||= [];
      data.art ||= {};
      return data;
    }
  } catch {
    // Corrupt save; ignore it.
  }
  return null;
}

function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(OLD_SAVE_KEY);
  } catch { /* ignore */ }
}

/* ---------------------------------------------------------------- screens */

function show(screen) {
  for (const id of ['screen-title', 'screen-create', 'screen-game']) $(`#${id}`).hidden = id !== screen;
  closeMenu();
  closeExamine();
  setSheetOpen(false);
  setInventoryOpen(false);
  document.body.classList.remove('inventory-open');
  $('#ending').hidden = true;
}

function showTitle() {
  const saved = loadSave();
  $('#btn-continue').hidden = !saved;
  $('#btn-continue').textContent = saved?.state.ended ? 'Read your last tale' : 'Continue the descent';
  show('screen-title');
  refreshNarratorCard();
}

/* ---------------------------------------------------------------- the narrator card (title screen) */

let checkTimer = 0;
let checkResult = null;
// A key pasted before a narrator was chosen, whose prefix didn't say which it belongs to.
let unassignedKey = '';

function refreshNarratorCard() {
  const provider = effectiveProvider();
  document.querySelectorAll('.provider-pick button').forEach((b) => {
    const on = b.dataset.provider === provider;
    b.setAttribute('aria-checked', String(on));
    b.classList.toggle('on', on);
    b.disabled = server.forceMock && b.dataset.provider !== 'mock';
  });
  const keyed = provider === 'anthropic' || provider === 'openai';
  // The key field is always offered (except in the demo): pasting a key picks Claude or GPT by its prefix.
  $('#key-row').hidden = provider === 'mock';
  const input = $('#api-key');
  if (document.activeElement !== input) input.value = keyed ? settings.keys[provider] || '' : unassignedKey;
  input.placeholder = provider === 'anthropic' ? 'Paste your Claude key (sk-ant-…)' : provider === 'openai' ? 'Paste your OpenAI key (sk-…)' : 'Paste a Claude or GPT API key';
  const model = $('#model-input');
  model.disabled = !keyed;
  model.value = keyed ? settings.models[provider] || '' : '';
  model.placeholder = keyed ? server.defaults[provider] || '' : 'Choose Claude or GPT first';
  $('#opt-illustrations').checked = settings.illustrations;
  $('#opt-sound').checked = settings.sound;
  $('#opt-ambience').checked = settings.ambience;
  $('#opt-volume').value = settings.volume;
  setKeyStatus();
}

function setKeyStatus(text, tone = '') {
  const el = $('#key-status');
  const provider = effectiveProvider();
  if (text == null) {
    if (server.forceMock) text = 'The server was started in demo mode (npm run mock): a canned tale, no AI.';
    else if (!provider && unassignedKey) text = 'Is this a Claude key or a GPT key? Pick one above.';
    else if (!provider) text = 'Paste a Claude or GPT API key to play. It stays in this browser. Or try the demo, which needs nothing.';
    else if (provider === 'mock') text = 'Demo: a short canned tale with no AI and no cost.';
    else if (checkResult?.provider === provider && checkResult.key === settings.keys[provider]) ({ text, tone } = checkResult);
    else if (!settings.keys[provider] && server.env[provider]) text = `Using the ${PROVIDER_LABELS[provider]} key from the server's .env file.`;
    else if (!settings.keys[provider]) text = `Paste your ${PROVIDER_LABELS[provider]} API key. It stays in this browser and is only sent to this game's own server.`;
    else text = 'Key saved. Press Check to test it.';
  }
  el.textContent = text;
  el.className = `key-status ${tone}`;
}

async function checkKey() {
  const provider = effectiveProvider();
  if (provider !== 'anthropic' && provider !== 'openai') return;
  if (!settings.keys[provider] && !server.env[provider]) return setKeyStatus();
  const key = settings.keys[provider];
  setKeyStatus('Checking the key…', 'pending');
  try {
    const result = await postJson('/api/check', {});
    if (effectiveProvider() !== provider || settings.keys[provider] !== key) return;
    if (!result.ok) {
      checkResult = { provider, key, text: result.message, tone: 'bad' };
      sfx('invalid');
    } else {
      // Remember the models the key can actually use, unless the player chose their own.
      if (!settings.models[provider] && result.model && result.model !== server.defaults[provider]) settings.models[provider] = result.model;
      if (provider === 'openai' && result.imageModel && !settings.imageModel) settings.imageModel = result.imageModel;
      saveSettings();
      const art = provider === 'openai' ? (result.imageModel ? ` Illustrations painted by ${result.imageModel}.` : ' Illustrations will be drawn as ink sketches.') : '';
      checkResult = { provider, key, text: `Key accepted. ${PROVIDER_LABELS[provider]} will narrate with ${result.model}.${art}${result.note ? ` ${result.note}` : ''}`, tone: result.available === false ? 'warn' : 'good' };
      sfx('chime');
    }
  } catch (error) {
    checkResult = { provider, key, text: error.message, tone: 'bad' };
  }
  refreshNarratorCard();
}

function initNarratorCard() {
  document.querySelectorAll('.provider-pick button').forEach((b) => b.addEventListener('click', () => {
    settings.provider = b.dataset.provider;
    if (unassignedKey && settings.provider !== 'mock') {
      settings.keys[settings.provider] = unassignedKey;
      unassignedKey = '';
    }
    saveSettings();
    resetArtSession();
    refreshNarratorCard();
    if (settings.provider !== 'mock' && settings.keys[settings.provider]) checkKey();
  }));
  const input = $('#api-key');
  input.addEventListener('input', () => {
    const key = input.value.trim();
    const detected = detectProvider(key);
    if (detected && detected !== settings.provider && !server.forceMock) settings.provider = detected;
    const provider = effectiveProvider();
    if (provider === 'anthropic' || provider === 'openai') settings.keys[provider] = key;
    else unassignedKey = key;
    saveSettings();
    resetArtSession();
    refreshNarratorCard();
    clearTimeout(checkTimer);
    if (key.length > 20) checkTimer = setTimeout(checkKey, 700);
  });
  $('#btn-key-show').addEventListener('click', (e) => {
    const shown = input.type === 'text';
    input.type = shown ? 'password' : 'text';
    e.currentTarget.textContent = shown ? 'Show' : 'Hide';
    e.currentTarget.setAttribute('aria-pressed', String(!shown));
  });
  $('#btn-key-check').addEventListener('click', checkKey);
  $('#btn-key-forget').addEventListener('click', () => {
    settings.keys = { anthropic: '', openai: '' };
    saveSettings();
    checkResult = null;
    input.value = '';
    refreshNarratorCard();
  });
  $('#model-input').addEventListener('change', (e) => {
    const provider = effectiveProvider();
    if (provider !== 'anthropic' && provider !== 'openai') return;
    settings.models[provider] = e.target.value.trim();
    saveSettings();
    checkResult = null;
    checkKey();
  });
  const bind = (id, key, parse = (el) => el.checked) => $(id).addEventListener('input', (e) => {
    settings[key] = parse(e.target);
    saveSettings();
    configureAudio(settings);
  });
  bind('#opt-illustrations', 'illustrations');
  bind('#opt-sound', 'sound');
  bind('#opt-ambience', 'ambience');
  bind('#opt-volume', 'volume', (el) => Number(el.value));
}

function requireNarrator() {
  if (narratorReady()) return true;
  const card = $('#narrator-card');
  card.classList.remove('nudge');
  void card.offsetWidth;
  card.classList.add('nudge');
  sfx('invalid');
  setKeyStatus(effectiveProvider() ? 'Enter an API key first, or choose the demo.' : 'Choose who narrates first: Claude, GPT, or the demo.', 'bad');
  ($('#key-row').hidden ? $('.provider-pick button') : $('#api-key')).focus();
  return false;
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
  game = { version: 2, state, history: [], memory: [], log: [], art: {} };
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

/** Notices under a passage. Time passing is only noticed by someone with a watch. */
function renderNotices(container, notices, knewTime) {
  const shown = notices.filter((n) => !n.silent && (knewTime || !TIME_NOTICES.has(n.kind)));
  if (!shown.length) return;
  const seen = new Set();
  const unique = shown.filter((n) => !seen.has(n.text) && seen.add(n.text));
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
    renderNotices(turn, entry.notices || [], entry.knewTime);
  }
  renderAll();
  const ended = Boolean(game.state.ended);
  setInputEnabled(!ended);
  requestAnimationFrame(() => { $('#story-scroll').scrollTop = $('#story-scroll').scrollHeight; });
  if (ended) showEnding(game.state, newGame, () => {});
  else $('#action-input').focus({ preventScroll: true });
}

function renderAll() {
  renderHud(game.state);
  if ($('#sheet').classList.contains('open')) renderSheet(game);
  if (isInventoryOpen()) renderInventory();
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

/** Sounds and screen effects for what just happened. */
function effectsFor(notices) {
  const knowsTime = hasWatch(game.state);
  for (const n of notices) {
    if (n.stat === 'health') { if (n.delta < 0) { flash('hurt'); sfx('hurt'); } else sfx('heal'); }
    else if (n.stat === 'sanity' && n.delta < 0) { flash('dread'); sfx('dread'); }
    else if (n.stat === 'coin' && n.delta > 0) sfx('coin');
    else if (n.kind === 'gain') sfx('pickup');
    else if (n.kind === 'lose') sfx(n.broke ? 'drop' : 'lose');
    else if (n.kind === 'deliver') { flash('boon'); sfx('deliver'); }
    else if (n.kind === 'place') sfx('place');
    else if (n.kind === 'hostile') sfx('hostile');
    else if (n.kind === 'gate' && knowsTime) sfx(n.open ? 'gateOpen' : 'gateShut');
    else if (n.kind === 'dawn' && knowsTime) sfx('chime');
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

  const { turn, passageEl } = createTurnElement(action);
  passageEl.classList.add('streaming');
  const waiting = document.createElement('div');
  waiting.className = 'waiting';
  waiting.innerHTML = `<span class="ember"></span><span class="waiting-text">${WAITING_LINES[Math.floor(Math.random() * WAITING_LINES.length)]}</span>`;
  passageEl.before(waiting);
  scrollToBottom(true);

  // The chronicler may still be condensing old pages; the narrator must see the result.
  if (compacting) await compacting;

  const before = structuredClone(game.state);
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
      if (tag.kind === 'gain') requestArt('item', { ...tag.fields, name: tag.value });
      if (changes.length) {
        notices.push(...changes);
        effectsFor(changes);
        renderAll();
      }
    },
  });

  let userContent = null;
  let outcome = null;
  let firstText = true;
  try {
    const events = streamTurn({
      history: game.history,
      memory: game.memory.map((m) => m.summary),
      state: before,
      action,
      opening: action == null && game.log.length === 0,
    });
    for await (const event of events) {
      if (event.type === 'turn') userContent = event.userContent;
      else if (event.type === 'text') {
        if (firstText) {
          firstText = false;
          waiting.remove();
          sfx('page');
        }
        const follow = nearBottom();
        passage.push(event.text);
        if (follow) scrollToBottom(true);
      } else outcome = event;
    }
    if (!outcome) throw Object.assign(new Error('The narrator fell silent mid-sentence. The connection was lost.'), { retry: true });
    if (outcome.type === 'error') throw Object.assign(new Error(outcome.message), { retry: outcome.retry, auth: outcome.auth });
    if (outcome.type === 'refusal') throw Object.assign(new Error(outcome.message), { retry: false });
    if (!userContent || !passage.raw.trim()) throw Object.assign(new Error('The narrator had nothing to say. Try again.'), { retry: true });
  } catch (error) {
    // Undo everything this turn did and offer the action back.
    game.state = before;
    turn.remove();
    waiting.remove();
    renderAll();
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
  const knewTime = hasWatch(game.state);
  renderNotices(turn, notices, knewTime);

  if (game.state.stats.health <= 0 && !game.state.ended) game.state.ended = 'death';
  game.history.push({ role: 'user', content: userContent }, { role: 'assistant', content: passage.raw });
  game.log.push({ action, raw: passage.raw, notices, knewTime });
  save();

  renderAll();
  scrollToBottom(false);
  busy = false;
  $('#btn-act').textContent = 'Act';
  setInputEnabled(!game.state.ended);
  if (game.state.ended) {
    sfx(game.state.ended === 'freedom' ? 'freedom' : 'death');
    setTimeout(() => showEnding(game.state, newGame, () => {}), 1800);
    return;
  }
  if (!matchMedia('(pointer: coarse)').matches) $('#action-input').focus({ preventScroll: true });
  if (needsCompaction(game)) runCompaction();
}

/** Condenses the oldest turns into the chronicle, in the background. */
function runCompaction() {
  if (compacting) return;
  const target = game;
  const note = document.createElement('div');
  note.className = 'chronicler';
  note.innerHTML = '<span class="quill" aria-hidden="true">✒</span> The chronicler condenses the oldest pages…';
  $('#story').appendChild(note);
  scrollToBottom(false);
  sfx('scribble');
  compacting = compact(target)
    .then((count) => {
      if (game !== target) return;
      save();
      note.classList.add('done');
      note.innerHTML = `<span class="quill" aria-hidden="true">✒</span> ${count} older turn${count === 1 ? '' : 's'} condensed into the chronicle (see the ledger).`;
      if ($('#sheet').classList.contains('open')) renderSheet(game);
    })
    .catch((error) => {
      console.warn('[descend] chronicle not updated:', error.message);
      note.remove();
    })
    .finally(() => {
      compacting = null;
    });
}

function showError(error, action) {
  document.querySelector('.story-error')?.remove();
  const box = document.createElement('div');
  box.className = 'story-error';
  box.innerHTML = `<p>${escapeHtml(error.message || 'Something went wrong.')}</p>`;
  const buttons = document.createElement('div');
  buttons.className = 'story-error-actions';
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
    buttons.appendChild(retry);
  }
  if (error.auth) {
    const settingsButton = document.createElement('button');
    settingsButton.className = 'btn btn-small btn-ghost';
    settingsButton.type = 'button';
    settingsButton.textContent = 'Change the narrator or key';
    settingsButton.addEventListener('click', showTitle);
    buttons.appendChild(settingsButton);
  }
  box.appendChild(buttons);
  $('#story').appendChild(box);
  sfx('invalid');
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

function openNpc(anchor, key, fallback, { closePanels = false } = {}) {
  const npc = game.state.npcs[key] || fallback;
  const dead = isDead(npc);
  const alignment = alignmentOf(npc);
  const act = (action) => {
    if (action === 'examine') {
      examineNpc(game.state.npcs[key] || npc, NPC_ACTIONS.filter((a) => a !== 'examine'), act);
    } else {
      if (closePanels) setSheetOpen(false);
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

/** The menu for something carried: from the inventory grid or an equipment slot. */
function openCarriedMenu(anchor, source, ops) {
  const { item } = source;
  const actions = ['examine', 'use'];
  if (source.kind === 'slot') actions.push('unequip');
  else {
    if (slotAccepts(targetSlot(game.state, item), item)) actions.push('equip');
    const shape = itemShape(item);
    if (item.x != null && shape.w !== shape.h) actions.push('rotate');
  }
  actions.push('drop');
  const act = (action) => {
    if (action === 'examine') examineItem(item, actions.filter((a) => a !== 'examine' && a !== 'rotate'), act);
    else if (action === 'use' || action === 'drop') appendAction(`${action} ${item.name}`);
    else if (action === 'equip') ops.equipTo(targetSlot(game.state, item));
    else if (action === 'unequip') ops.unequip();
    else if (action === 'rotate') ops.rotate();
  };
  const where = source.kind === 'slot' ? 'equipped' : item.x == null ? 'loose' : 'in the pack';
  openMenu(anchor, { title: item.name, subtitle: `${item.type || 'item'} · ${where}`, tone: 'item', actions }, act);
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
  const face = target.closest('[data-npc]');
  if (!face) return;
  const npc = game.state.npcs[face.dataset.npc];
  if (npc) openNpc(face, face.dataset.npc, npc, { closePanels: true });
}

function afterInventoryChange() {
  save();
  renderAll();
}

/* ---------------------------------------------------------------- new game / menus */

function newGame() {
  if (game && !game.state.ended && game.log.length && !confirm('Abandon this prisoner to the dark and begin anew?')) return;
  clearSave();
  game = null;
  startCreation();
}

function toggleInventory(open = !isInventoryOpen()) {
  if (open && window.innerWidth < 1100) setSheetOpen(false);
  setInventoryOpen(open);
  document.body.classList.toggle('inventory-open', open);
}

function toggleSheet(open = !$('#sheet').classList.contains('open')) {
  if (open) {
    renderSheet(game);
    if (window.innerWidth < 1100) toggleInventory(false);
  }
  setSheetOpen(open);
}

/* ---------------------------------------------------------------- wiring */

function wire() {
  initNarratorCard();
  $('#btn-inventory').innerHTML = PERSON_GLYPH;
  $('#btn-sheet').innerHTML = LEDGER_GLYPH;

  $('#btn-new').addEventListener('click', () => {
    if (!requireNarrator()) return;
    const saved = loadSave();
    if (saved && !saved.state.ended && !confirm('Your current prisoner will be lost to the dark. Begin anew?')) return;
    clearSave();
    startCreation();
  });
  $('#btn-continue').addEventListener('click', () => {
    if (!requireNarrator()) return;
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
    sfx('page');
  });
  $('#btn-begin').addEventListener('click', () => {
    sfx('gateShut');
    beginGame();
  });
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
    sfx('submit');
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

  $('#btn-inventory').addEventListener('click', () => toggleInventory());
  $('#btn-sheet').addEventListener('click', () => toggleSheet());
  $('#sheet-close').addEventListener('click', () => setSheetOpen(false));
  $('#inventory-close').addEventListener('click', () => document.body.classList.remove('inventory-open'));
  $('#sheet-content').addEventListener('click', (e) => onSheetActivate(e.target));

  document.addEventListener('keydown', (e) => {
    const typing = e.target.closest?.('input, textarea, select, [contenteditable]');
    const inGame = !$('#screen-game').hidden;
    const overlay = !$('#entity-menu').hidden || !$('#examine').hidden;
    if (e.key === 'Escape' && inGame && !overlay) {
      if ($('#sheet').classList.contains('open')) setSheetOpen(false);
      else if (isInventoryOpen()) toggleInventory(false);
      return;
    }
    if (overlay || !inGame || !game || e.ctrlKey || e.metaKey) return;
    // Plain I / L when not typing; Alt+I / Alt+L work from inside the action box too.
    if (typing ? !e.altKey : e.altKey) return;
    if (e.code === 'KeyI') { e.preventDefault(); toggleInventory(); }
    if (e.code === 'KeyL') { e.preventDefault(); toggleSheet(); }
  });

  const menuButton = $('#btn-menu');
  const menu = $('#game-menu');
  const soundLabel = () => { menu.querySelector('[data-menu="sound"]').textContent = `Sound: ${settings.sound ? 'on' : 'off'}`; };
  const closeGameMenu = () => { menu.hidden = true; menuButton.setAttribute('aria-expanded', 'false'); };
  menuButton.addEventListener('click', (e) => {
    e.stopPropagation();
    soundLabel();
    menu.hidden = !menu.hidden;
    menuButton.setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.addEventListener('click', (e) => { if (!menu.contains(e.target)) closeGameMenu(); });
  menu.addEventListener('click', (e) => {
    const choice = e.target.closest('button')?.dataset.menu;
    if (choice === 'sound') {
      settings.sound = !settings.sound;
      saveSettings();
      configureAudio(settings);
      soundLabel();
      return;
    }
    closeGameMenu();
    if (choice === 'new') newGame();
    if (choice === 'title') showTitle();
  });

  // Browsers allow sound only after the player does something.
  const unlock = () => {
    unlockAudio();
    configureAudio(settings);
  };
  window.addEventListener('pointerdown', unlock, { once: true, capture: true });
  window.addEventListener('keydown', unlock, { once: true, capture: true });

  // Interface sounds.
  document.addEventListener('click', (e) => {
    if (e.target.closest('.btn, .rail-btn, .provider-pick button, .game-menu button, .pronouns label')) sfx('click');
  }, true);
  document.addEventListener('pointerover', (e) => {
    const el = e.target.closest('.btn, .rail-btn, .entity, .provider-pick button, .entity-menu button');
    if (el && !el.contains(e.relatedTarget)) sfx('hover');
  });

  // A generated picture that fails to load falls back to the hand-drawn one.
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!img?.classList?.contains('art-img')) return;
    dropArt(img.getAttribute('src'));
    save();
    img.remove();
  }, true);

  initInventory({
    getGame: () => game,
    onChange: afterInventoryChange,
    onAction: appendAction,
    onItemMenu: openCarriedMenu,
  });
  initArt({
    getGame: () => game,
    onSave: save,
    onReady: (key) => {
      refreshExamineArt(key);
      if (isInventoryOpen()) renderInventory();
      if (key.startsWith('npc:') && $('#sheet').classList.contains('open')) renderSheet(game);
    },
  });
}

async function loadServerStatus() {
  try {
    Object.assign(server, await getJson('/api/status'));
  } catch {
    setKeyStatus('The game server cannot be reached. Is it still running?', 'bad');
    return;
  }
  // Default to whatever the server already has a key for.
  if (!settings.provider) settings.provider = server.env.anthropic ? 'anthropic' : server.env.openai ? 'openai' : '';
  refreshNarratorCard();
  const provider = effectiveProvider();
  if ((provider === 'anthropic' || provider === 'openai') && (settings.keys[provider] || server.env[provider])) checkKey();
}

wire();
configureAudio(settings);
startMotes($('#motes'));
showTitle();
loadServerStatus();
