import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT } from './prompt.js';
import { mockNarrate } from './mock.js';

const EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);

export function getConfig() {
  const effort = (process.env.DESCEND_EFFORT || 'medium').toLowerCase();
  return {
    mock: process.argv.includes('--mock') || /^(1|true|yes|on)$/i.test(process.env.DESCEND_MOCK || ''),
    model: process.env.DESCEND_MODEL || 'claude-opus-5',
    effort: EFFORTS.has(effort) ? effort : 'medium',
    fallbacks: !/^(0|false|no|off)$/i.test(process.env.DESCEND_FALLBACKS || ''),
  };
}

let client;
function getClient() {
  // Resolves credentials from ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, or an `ant auth login` profile.
  client ??= new Anthropic();
  return client;
}

/**
 * Streams one narrator turn.
 * @param {object} opts
 * @param {Anthropic.Beta.BetaMessageParam[]} opts.history prior turns (plain text content)
 * @param {string} opts.userContent the new user message (state block + action)
 * @param {AbortSignal} opts.signal aborts the request when the player disconnects
 * @param {(text: string) => void} opts.onText receives story text deltas as they arrive
 */
export async function narrate({ history, userContent, signal, onText }) {
  const config = getConfig();
  if (config.mock) return mockNarrate({ history, userContent, signal, onText });

  const params = {
    model: config.model,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: config.effort },
    // Auto-caches the conversation prefix so each turn only pays full price for the new message.
    cache_control: { type: 'ephemeral' },
    system: SYSTEM_PROMPT,
    messages: [...history, { role: 'user', content: userContent }],
  };
  if (config.fallbacks) {
    // If a safety classifier declines the turn, the API re-runs it on a recommended fallback model.
    params.betas = ['server-side-fallback-2026-07-01'];
    params.fallbacks = 'default';
  }

  const stream = getClient().beta.messages.stream(params, { signal });
  stream.on('text', (delta) => onText(delta));
  const message = await stream.finalMessage();

  return {
    stopReason: message.stop_reason,
    model: message.model,
    usage: {
      input: message.usage.input_tokens,
      output: message.usage.output_tokens,
      cacheRead: message.usage.cache_read_input_tokens ?? 0,
      cacheWrite: message.usage.cache_creation_input_tokens ?? 0,
    },
  };
}

/** Maps an SDK error to a message the player can act on, plus whether retrying may help. */
export function describeError(error) {
  if (error instanceof Anthropic.AuthenticationError) {
    return { message: 'The narrator has no voice: the Anthropic API key is missing or invalid. Set ANTHROPIC_API_KEY (or run `npm run mock` to play without one).', retry: false };
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return { message: `This API key may not use the model "${getConfig().model}".`, retry: false };
  }
  if (error instanceof Anthropic.NotFoundError) {
    return { message: `The model "${getConfig().model}" was not found. Check DESCEND_MODEL.`, retry: false };
  }
  if (error instanceof Anthropic.RateLimitError) {
    return { message: 'The narrator is overwhelmed (rate limited). Wait a moment and try again.', retry: true };
  }
  if (error instanceof Anthropic.BadRequestError) {
    return { message: `The narrator rejected the request: ${error.message}`, retry: false };
  }
  if (error instanceof Anthropic.InternalServerError || (error instanceof Anthropic.APIError && error.status >= 500)) {
    return { message: 'The narrator faltered (the API is overloaded or erroring). Try again.', retry: true };
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return { message: 'Could not reach the Anthropic API. Check your connection and try again.', retry: true };
  }
  if (error instanceof Anthropic.APIError) {
    return { message: `API error ${error.status ?? ''}: ${error.message}`.trim(), retry: true };
  }
  if (/api[_ ]?key|credential|auth/i.test(String(error?.message))) {
    return { message: 'No Anthropic credentials found. Set ANTHROPIC_API_KEY in your environment or a .env file (or run `npm run mock` to play without one).', retry: false };
  }
  return { message: String(error?.message || error), retry: true };
}
