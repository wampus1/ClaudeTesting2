// GPT, via the OpenAI SDK. Narration uses Chat Completions; illustrations use the GPT Image models.

import OpenAI from 'openai';

export const id = 'openai';
export const label = 'GPT';
export const DEFAULT_MODEL = 'gpt-6-astra';
export const DEFAULT_IMAGE_MODEL = 'gpt-image-2';
export const canPaint = true;

// Used when checking a key: the first of these the key can see becomes the default.
const PREFERRED_MODELS = ['gpt-6-astra', 'gpt-6-sol', 'gpt-5.6-sol', 'gpt-5.5', 'gpt-5.4', 'gpt-5.2', 'gpt-5.1', 'gpt-5', 'gpt-4.1', 'gpt-4o'];
const PREFERRED_IMAGE_MODELS = ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini'];

const clients = new Map();

function client(auth) {
  const key = auth.key || '';
  if (!clients.has(key)) {
    if (clients.size > 8) clients.clear();
    // With no key the SDK reads OPENAI_API_KEY.
    clients.set(key, key ? new OpenAI({ apiKey: key }) : new OpenAI());
  }
  return clients.get(key);
}

const isReasoningModel = (model) => /^(o\d|gpt-5|gpt-6)/.test(model) && !/chat-latest/.test(model);

// Not every reasoning model accepts every level, so the top of the game's scale maps to `high`.
const REASONING = { low: 'low', medium: 'medium', high: 'high', xhigh: 'high', max: 'high' };

function chatParams(auth, messages, effort, maxTokens) {
  const model = auth.model || DEFAULT_MODEL;
  const params = { model, messages, max_completion_tokens: maxTokens };
  if (isReasoningModel(model)) params.reasoning_effort = REASONING[effort] || 'medium';
  return params;
}

/** Streams one narrator turn. */
export async function narrate({ auth, system, messages, signal, onText }) {
  const stream = await client(auth).chat.completions.create({
    ...chatParams(auth, [{ role: 'system', content: system.join('\n\n') }, ...messages], auth.effort, 16000),
    stream: true,
    stream_options: { include_usage: true },
  }, { signal });

  let finish = null;
  let refused = false;
  let model = auth.model || DEFAULT_MODEL;
  let usage = null;
  for await (const chunk of stream) {
    model = chunk.model || model;
    if (chunk.usage) usage = chunk.usage;
    const choice = chunk.choices?.[0];
    if (!choice) continue;
    if (choice.delta?.refusal) refused = true;
    if (choice.delta?.content) onText(choice.delta.content);
    if (choice.finish_reason) finish = choice.finish_reason;
  }
  return {
    stopReason: refused || finish === 'content_filter' ? 'refusal' : finish === 'length' ? 'max_tokens' : 'end_turn',
    model,
    usage: {
      input: usage?.prompt_tokens ?? 0,
      output: usage?.completion_tokens ?? 0,
      cacheRead: usage?.prompt_tokens_details?.cached_tokens ?? 0,
      cacheWrite: 0,
    },
  };
}

/** A one-off text completion (chronicle summaries, SVG drawings). */
export async function complete({ auth, system, prompt, effort = 'low', maxTokens = 16000, signal }) {
  const response = await client(auth).chat.completions.create(
    chatParams(auth, [{ role: 'system', content: system.join('\n\n') }, { role: 'user', content: prompt }], effort, maxTokens),
    { signal },
  );
  const choice = response.choices?.[0];
  if (choice?.message?.refusal || choice?.finish_reason === 'content_filter') {
    throw Object.assign(new Error('The request was declined.'), { refusal: true });
  }
  return { text: choice?.message?.content || '', stopReason: choice?.finish_reason };
}

/** GPT Image models take arbitrary sizes (aspect 1:3–3:1, multiples of 16) from gpt-image-2 on; older ones take three fixed sizes. */
function imageSize(model, w, h) {
  const aspect = w / h;
  if (/^gpt-image-2/.test(model)) {
    if (aspect >= 2.5) return '1536x512';
    if (aspect >= 1.8) return '1536x768';
    if (aspect >= 1.3) return '1536x1024';
    if (aspect <= 0.4) return '512x1536';
    if (aspect <= 0.56) return '768x1536';
    if (aspect <= 0.77) return '1024x1536';
    return '1024x1024';
  }
  if (aspect >= 1.3) return '1536x1024';
  if (aspect <= 0.77) return '1024x1536';
  return '1024x1024';
}

/**
 * Paints an illustration with the image model and returns the image bytes.
 * @param {{ prompt: string, w: number, h: number, transparent: boolean }} spec
 */
export async function paint({ auth, prompt, w, h, transparent, signal }) {
  const model = auth.imageModel || DEFAULT_IMAGE_MODEL;
  const params = {
    model,
    prompt,
    size: imageSize(model, w, h),
    quality: process.env.DESCEND_IMAGE_QUALITY || 'medium',
    output_format: 'webp',
    output_compression: 85,
    background: transparent ? 'transparent' : 'opaque',
    n: 1,
  };
  let response;
  try {
    response = await client(auth).images.generate(params, { signal });
  } catch (error) {
    // Transparency is still in preview on some image models; retry once letting the model choose.
    if (!(error instanceof OpenAI.BadRequestError) || !transparent) throw error;
    response = await client(auth).images.generate({ ...params, background: 'auto' }, { signal });
  }
  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error('The image model returned no image.');
  return { bytes: Buffer.from(b64, 'base64'), ext: 'webp' };
}

/** Validates the key by listing models (free), and picks the best narrator and image models it can use. */
export async function check(auth) {
  const ids = new Set();
  for await (const model of client(auth).models.list()) ids.add(model.id);
  const model = auth.model || PREFERRED_MODELS.find((m) => ids.has(m)) || DEFAULT_MODEL;
  const imageModel = auth.imageModel || PREFERRED_IMAGE_MODELS.find((m) => ids.has(m)) || null;
  return {
    model,
    imageModel,
    available: ids.has(model),
    note: ids.has(model) ? null : `This key can't see ${model}.`,
  };
}

export function describeError(error, auth) {
  const model = auth?.model || DEFAULT_MODEL;
  if (error instanceof OpenAI.AuthenticationError) {
    return { message: 'OpenAI rejected this API key. Check that it was copied in full.', retry: false, auth: true };
  }
  if (error instanceof OpenAI.PermissionDeniedError) {
    return { message: `This OpenAI key may not use "${model}" (some models need a verified organization).`, retry: false, auth: true };
  }
  if (error instanceof OpenAI.NotFoundError) {
    return { message: `The model "${model}" was not found. Check the model setting on the title screen.`, retry: false };
  }
  if (error instanceof OpenAI.RateLimitError) {
    const quota = /quota|billing/i.test(error.message);
    return { message: quota ? 'This OpenAI account is out of credit (insufficient quota).' : 'The narrator is overwhelmed (rate limited). Wait a moment and try again.', retry: !quota };
  }
  if (error instanceof OpenAI.BadRequestError) {
    return { message: `The narrator rejected the request: ${error.message}`, retry: false };
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return { message: 'Could not reach the OpenAI API. Check your connection and try again.', retry: true };
  }
  if (error instanceof OpenAI.APIError && error.status >= 500) {
    return { message: 'The narrator faltered (the OpenAI API is overloaded or erroring). Try again.', retry: true };
  }
  if (error instanceof OpenAI.APIError) {
    return { message: `OpenAI API error ${error.status ?? ''}: ${error.message}`.trim(), retry: true };
  }
  if (/api[_ ]?key/i.test(String(error?.message))) {
    return { message: 'No OpenAI API key has been entered.', retry: false, auth: true };
  }
  return { message: String(error?.message || error), retry: true };
}

export function isAbort(error) {
  return error instanceof OpenAI.APIUserAbortError;
}
