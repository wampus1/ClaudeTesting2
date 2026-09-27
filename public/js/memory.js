// The chronicle: when the transcript sent to the narrator grows past its budget, the oldest
// turns are summarized into a short chronicle entry and dropped from the transcript.
// The story on screen is never touched; only what the narrator is sent shrinks.

import { postJson } from './api.js';

const params = new URLSearchParams(globalThis.location?.search || '');
/** Estimated tokens of transcript + chronicle sent with each turn before older turns are condensed. `?budget=` overrides it for testing. */
export const CONTEXT_BUDGET = Math.max(1500, Number(params.get('budget')) || 24000);
/** The most recent turns are always kept word for word. */
const KEEP_RECENT = Math.max(2, Math.min(6, Math.floor(CONTEXT_BUDGET / 2000)));
/** Once the chronicle itself grows past this, its entries are merged into one. */
const CHRONICLE_BUDGET = Math.max(600, Math.round(CONTEXT_BUDGET / 10));

const estimate = (text) => Math.ceil(String(text).length / 3.6);
const chronicleText = (game) => game.memory.map((m) => m.summary).join('\n\n');

export function contextTokens(game) {
  return estimate(game.history.map((m) => m.content).join('')) + estimate(chronicleText(game));
}

export function needsCompaction(game) {
  return contextTokens(game) > CONTEXT_BUDGET && game.history.length / 2 > KEEP_RECENT;
}

function actionOf(userContent) {
  const match = userContent.match(/<action>([\s\S]*?)<\/action>/);
  return match ? match[1].trim() : '(the story begins)';
}

/**
 * Summarizes the oldest turns into a chronicle entry. The game is only changed if the
 * summary arrives, so a failure leaves everything as it was.
 * @returns {Promise<number>} how many turns were condensed
 */
export async function compact(game) {
  const turns = game.history.length / 2;
  let count = 0;
  let tokens = contextTokens(game);
  while (turns - count > KEEP_RECENT && tokens > CONTEXT_BUDGET * 0.5) {
    tokens -= estimate(game.history[2 * count].content) + estimate(game.history[2 * count + 1].content);
    count += 1;
  }
  if (!count) return 0;

  const passages = [];
  for (let i = 0; i < count; i++) {
    passages.push({ action: actionOf(game.history[2 * i].content), text: game.history[2 * i + 1].content });
  }
  const character = { name: game.state.character.name, pronouns: game.state.character.pronouns };
  const { summary } = await postJson('/api/summarize', { character, chronicle: game.memory.map((m) => m.summary), turns: passages });

  let memory = [...game.memory, { summary, turns: count, clock: game.state.clock }];
  if (memory.length > 1 && estimate(memory.map((m) => m.summary).join('\n\n')) > CHRONICLE_BUDGET) {
    try {
      const merged = await postJson('/api/summarize', { mode: 'condense', character, chronicle: memory.map((m) => m.summary) });
      memory = [{ summary: merged.summary, turns: memory.reduce((n, m) => n + m.turns, 0), clock: game.state.clock, merged: true }];
    } catch {
      // Keep the separate entries; merging can be tried again next time.
    }
  }
  game.memory = memory;
  game.history.splice(0, 2 * count);
  return count;
}
