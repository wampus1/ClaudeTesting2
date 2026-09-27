// Player settings, kept in this browser: which narrator, API keys, models, art, sound.
// Keys are sent only to the game's own server (on this computer), which passes them to the API.

const STORAGE_KEY = 'descend.settings.v1';

const DEFAULTS = {
  provider: '',
  keys: { anthropic: '', openai: '' },
  models: { anthropic: '', openai: '' },
  imageModel: '',
  illustrations: true,
  sound: true,
  ambience: true,
  volume: 0.7,
};

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      ...DEFAULTS,
      ...saved,
      keys: { ...DEFAULTS.keys, ...saved.keys },
      models: { ...DEFAULTS.models, ...saved.models },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export const settings = load();

export function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage blocked: settings last until the page closes.
  }
}

/** Claude keys start sk-ant-; OpenAI keys start sk- (including sk-proj-). */
export function detectProvider(key) {
  const k = String(key || '').trim();
  if (/^sk-ant-/.test(k)) return 'anthropic';
  if (/^sk-/.test(k)) return 'openai';
  return null;
}

/** The server's status: which keys it has from .env, default models, and whether demo mode is forced. */
export const server = { forceMock: false, env: { anthropic: false, openai: false }, defaults: {} };

export const effectiveProvider = () => (server.forceMock ? 'mock' : settings.provider);

/** Is there a narrator to talk to? */
export function narratorReady() {
  const p = effectiveProvider();
  if (p === 'mock') return true;
  if (p !== 'anthropic' && p !== 'openai') return false;
  return Boolean(settings.keys[p] || server.env[p]);
}

export function apiHeaders() {
  const p = effectiveProvider();
  const headers = { 'x-descend-provider': p || '' };
  if (p === 'anthropic' || p === 'openai') {
    if (settings.keys[p]) headers['x-descend-key'] = settings.keys[p];
    if (settings.models[p]) headers['x-descend-model'] = settings.models[p];
    if (p === 'openai' && settings.imageModel) headers['x-descend-image-model'] = settings.imageModel;
  }
  return headers;
}

export const PROVIDER_LABELS = { anthropic: 'Claude', openai: 'GPT', mock: 'Demo' };
