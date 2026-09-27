// Claude, via the Anthropic SDK.

import Anthropic from '@anthropic-ai/sdk';

export const id = 'anthropic';
export const label = 'Claude';
export const DEFAULT_MODEL = 'claude-opus-5';
export const canPaint = false;

const clients = new Map();

/** One SDK client per key. With no key, the SDK resolves ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, or an `ant auth login` profile. */
function client(auth) {
  const key = auth.key || '';
  if (!clients.has(key)) {
    if (clients.size > 8) clients.clear();
    clients.set(key, key ? new Anthropic({ apiKey: key }) : new Anthropic());
  }
  return clients.get(key);
}

function baseParams(auth, { system, messages, effort, maxTokens }) {
  const params = {
    model: auth.model || DEFAULT_MODEL,
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    output_config: { effort },
    // Auto-caches the prompt prefix (system prompt + transcript) so repeat calls pay full price only for what's new.
    cache_control: { type: 'ephemeral' },
    system: system.map((text) => ({ type: 'text', text })),
    messages,
  };
  if (auth.fallbacks) {
    // If a safety classifier declines the request, the API re-runs it on a recommended fallback model.
    params.betas = ['server-side-fallback-2026-07-01'];
    params.fallbacks = 'default';
  }
  return params;
}

function usageOf(message) {
  return {
    input: message.usage.input_tokens,
    output: message.usage.output_tokens,
    cacheRead: message.usage.cache_read_input_tokens ?? 0,
    cacheWrite: message.usage.cache_creation_input_tokens ?? 0,
  };
}

/** Streams one narrator turn. `system` is a list of text blocks; `messages` is the plain-text transcript. */
export async function narrate({ auth, system, messages, signal, onText }) {
  const stream = client(auth).beta.messages.stream(
    baseParams(auth, { system, messages, effort: auth.effort, maxTokens: 16000 }),
    { signal },
  );
  stream.on('text', (delta) => onText(delta));
  const message = await stream.finalMessage();
  return { stopReason: message.stop_reason === 'refusal' ? 'refusal' : message.stop_reason, model: message.model, usage: usageOf(message) };
}

/** A one-off text completion (chronicle summaries, SVG drawings). Streams under the hood so long outputs can't time out. */
export async function complete({ auth, system, prompt, effort = 'low', maxTokens = 16000, signal }) {
  const stream = client(auth).beta.messages.stream(
    baseParams(auth, { system, messages: [{ role: 'user', content: prompt }], effort, maxTokens }),
    { signal },
  );
  const message = await stream.finalMessage();
  if (message.stop_reason === 'refusal') throw Object.assign(new Error('The request was declined.'), { refusal: true });
  const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { text, stopReason: message.stop_reason, usage: usageOf(message) };
}

/** Validates the key by listing models (free), and reports the model the game will use. */
export async function check(auth) {
  const ids = [];
  for await (const model of client(auth).models.list({ limit: 100 })) {
    ids.push(model.id);
    if (ids.length >= 200) break;
  }
  const model = auth.model || DEFAULT_MODEL;
  return {
    model,
    available: ids.includes(model),
    note: ids.includes(model) ? null : `This key can't see ${model}. Available: ${ids.slice(0, 6).join(', ')}${ids.length > 6 ? '…' : ''}`,
  };
}

/** Maps an SDK error to a message the player can act on, plus whether retrying may help. */
export function describeError(error, auth) {
  const model = auth?.model || DEFAULT_MODEL;
  if (error instanceof Anthropic.AuthenticationError) {
    return { message: 'Anthropic rejected this API key. Check that it was copied in full.', retry: false, auth: true };
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return { message: `This Anthropic key may not use the model "${model}".`, retry: false, auth: true };
  }
  if (error instanceof Anthropic.NotFoundError) {
    return { message: `The model "${model}" was not found. Check the model setting on the title screen.`, retry: false };
  }
  if (error instanceof Anthropic.RateLimitError) {
    return { message: 'The narrator is overwhelmed (rate limited). Wait a moment and try again.', retry: true };
  }
  if (error instanceof Anthropic.BadRequestError) {
    return { message: `The narrator rejected the request: ${error.message}`, retry: false };
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return { message: 'Could not reach the Anthropic API. Check your connection and try again.', retry: true };
  }
  if (error instanceof Anthropic.APIError && error.status >= 500) {
    return { message: 'The narrator faltered (the Anthropic API is overloaded or erroring). Try again.', retry: true };
  }
  if (error instanceof Anthropic.APIError) {
    return { message: `Anthropic API error ${error.status ?? ''}: ${error.message}`.trim(), retry: true };
  }
  if (/api[_ ]?key|credential|authentication method/i.test(String(error?.message))) {
    return { message: 'No Anthropic API key has been entered.', retry: false, auth: true };
  }
  return { message: String(error?.message || error), retry: true };
}

export function isAbort(error) {
  return error instanceof Anthropic.APIUserAbortError;
}
