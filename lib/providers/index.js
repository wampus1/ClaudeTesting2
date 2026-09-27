// Picks the narrator for a request. The browser sends the provider, key and model it was
// given on the title screen as headers; anything missing falls back to the environment.

import * as anthropic from './anthropic.js';
import * as openai from './openai.js';
import * as mock from './mock.js';

const PROVIDERS = { anthropic, openai, mock };
const EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);

export class ProviderError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function serverConfig() {
  const effort = (process.env.DESCEND_EFFORT || 'medium').toLowerCase();
  return {
    forceMock: process.argv.includes('--mock') || /^(1|true|yes|on)$/i.test(process.env.DESCEND_MOCK || ''),
    effort: EFFORTS.has(effort) ? effort : 'medium',
    fallbacks: !/^(0|false|no|off)$/i.test(process.env.DESCEND_FALLBACKS || ''),
    env: {
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
      openai: Boolean(process.env.OPENAI_API_KEY),
    },
    defaults: {
      anthropic: process.env.DESCEND_MODEL_ANTHROPIC || process.env.DESCEND_MODEL || anthropic.DEFAULT_MODEL,
      openai: process.env.DESCEND_MODEL_OPENAI || openai.DEFAULT_MODEL,
      openaiImage: process.env.DESCEND_IMAGE_MODEL || openai.DEFAULT_IMAGE_MODEL,
    },
    // Models pinned by the environment; otherwise each provider picks its own default.
    pinned: {
      anthropic: process.env.DESCEND_MODEL_ANTHROPIC || process.env.DESCEND_MODEL || '',
      openai: process.env.DESCEND_MODEL_OPENAI || '',
      openaiImage: process.env.DESCEND_IMAGE_MODEL || '',
    },
  };
}

const header = (req, name) => {
  const value = req.headers[name];
  return typeof value === 'string' ? value.trim() : '';
};

/**
 * Resolves the provider module and its credentials for one request.
 * @returns {{ provider: object, auth: { key: string, model: string, imageModel: string, effort: string, fallbacks: boolean } }}
 */
export function resolve(req) {
  const config = serverConfig();
  let id = config.forceMock ? 'mock' : header(req, 'x-descend-provider');
  const key = header(req, 'x-descend-key');
  if (!id) id = config.env.anthropic ? 'anthropic' : config.env.openai ? 'openai' : '';
  const provider = PROVIDERS[id];
  if (!provider) throw new ProviderError('Choose a narrator on the title screen: enter a Claude or GPT key, or pick the demo.', 401);
  if (id !== 'mock' && !key && !config.env[id]) {
    throw new ProviderError(`No ${provider.label} API key. Enter one on the title screen.`, 401);
  }
  if (key && !/^[\x21-\x7e]{8,300}$/.test(key)) throw new ProviderError('That API key contains characters no key has.', 400);

  // Empty means "not chosen": the provider uses its default, and a key check may pick a better one.
  const model = header(req, 'x-descend-model').slice(0, 80) || config.pinned[id] || '';
  const imageModel = header(req, 'x-descend-image-model').slice(0, 80) || (id === 'openai' ? config.pinned.openaiImage : '');
  return { provider, auth: { key, model, imageModel, effort: config.effort, fallbacks: config.fallbacks } };
}
