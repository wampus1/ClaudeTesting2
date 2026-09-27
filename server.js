import './lib/env.js';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolve, serverConfig, ProviderError } from './lib/providers/index.js';
import { SYSTEM_PROMPT, buildUserTurn, chronicleBlock, CHRONICLER_PROMPT, CONDENSER_PROMPT, buildSummaryPrompt } from './lib/prompt.js';
import { illustrate, readSpec, serveArt } from './lib/art.js';

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const MAX_HISTORY_MESSAGES = 1000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'This tale has grown too long to carry. Begin a new descent.');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw new HttpError(400, 'Malformed request body.');
  }
}

/** Validates the client-held transcript: alternating user/assistant turns of plain text. */
function validateHistory(history) {
  if (history == null) return [];
  if (!Array.isArray(history)) throw new HttpError(400, 'history must be an array.');
  if (history.length > MAX_HISTORY_MESSAGES) {
    throw new HttpError(413, 'This tale has grown too long to carry. Begin a new descent.');
  }
  const messages = history.map((message, i) => {
    const expected = i % 2 === 0 ? 'user' : 'assistant';
    if (!message || message.role !== expected || typeof message.content !== 'string' || !message.content) {
      throw new HttpError(400, 'The saved transcript is corrupted. Begin a new descent.');
    }
    return { role: message.role, content: message.content };
  });
  if (messages.length % 2 !== 0) throw new HttpError(400, 'The saved transcript is corrupted. Begin a new descent.');
  return messages;
}

function validateMemory(memory) {
  if (memory == null) return [];
  if (!Array.isArray(memory) || memory.length > 50 || memory.some((m) => typeof m !== 'string' || m.length > 8000)) {
    throw new HttpError(400, 'The saved chronicle is corrupted.');
  }
  return memory;
}

/** Runs `fn` with an AbortSignal that fires if the player disconnects first. */
function abortOnClose(res) {
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableFinished) controller.abort();
  });
  return controller;
}

function failure(provider, auth, error) {
  if (error instanceof ProviderError || error instanceof HttpError) return { message: error.message, retry: false, auth: error.status === 401 };
  if (error?.refusal) return { message: 'The request was declined. Try another course.', retry: false };
  return provider.describeError(error, auth);
}

/* ---------------------------------------------------------------- routes */

async function handleTurn(req, res) {
  const { provider, auth } = resolve(req);
  const body = await readJson(req);
  const history = validateHistory(body.history);
  const memory = validateMemory(body.memory);
  const opening = body.opening === true || (history.length === 0 && memory.length === 0);
  const action = typeof body.action === 'string' ? body.action.trim() : '';
  if (!opening && !action) throw new HttpError(400, 'Say what you do.');
  const userContent = buildUserTurn(body.state, opening ? null : action);
  const system = [SYSTEM_PROMPT, chronicleBlock(memory)].filter(Boolean);

  const controller = abortOnClose(res);
  res.writeHead(200, {
    'content-type': 'application/x-ndjson; charset=utf-8',
    'cache-control': 'no-store',
    'x-accel-buffering': 'no',
  });
  res.socket?.setNoDelay(true);
  const send = (event) => res.write(`${JSON.stringify(event)}\n`);

  // The client appends exactly this text to its transcript, keeping the history append-only.
  send({ type: 'turn', userContent });

  try {
    const result = await provider.narrate({
      auth,
      system,
      messages: [...history, { role: 'user', content: userContent }],
      signal: controller.signal,
      onText: (text) => send({ type: 'text', text }),
    });
    if (result.stopReason === 'refusal') {
      send({ type: 'refusal', message: 'The narrator will not tell that part of the tale. Try another course.' });
    } else {
      send({ type: 'done', ...result });
    }
  } catch (error) {
    if (controller.signal.aborted || provider.isAbort(error)) return;
    console.error(`[descend] narration failed (${provider.id}):`, error?.message || error);
    send({ type: 'error', ...failure(provider, auth, error) });
  }
  res.end();
}

async function handleSummarize(req, res) {
  const { provider, auth } = resolve(req);
  const body = await readJson(req);
  const mode = body.mode === 'condense' ? 'condense' : 'summarize';
  const turns = Array.isArray(body.turns) ? body.turns.slice(0, 200) : [];
  const chronicle = validateMemory(body.chronicle);
  if (mode === 'summarize' && !turns.length) throw new HttpError(400, 'Nothing to summarize.');
  if (mode === 'condense' && chronicle.length < 2) throw new HttpError(400, 'Nothing to condense.');
  const controller = abortOnClose(res);
  try {
    const { text } = await provider.complete({
      auth,
      system: [mode === 'condense' ? CONDENSER_PROMPT : CHRONICLER_PROMPT],
      prompt: buildSummaryPrompt({ character: body.character, turns, chronicle, mode }),
      effort: 'low',
      maxTokens: 8000,
      signal: controller.signal,
    });
    const summary = text.replace(/\[[^\]]*\]/g, '').trim();
    if (!summary) throw new Error('The chronicler wrote nothing.');
    sendJson(res, 200, { summary });
  } catch (error) {
    if (controller.signal.aborted) return;
    console.error(`[descend] summary failed (${provider.id}):`, error?.message || error);
    sendJson(res, 502, { error: failure(provider, auth, error).message });
  }
}

async function handleArt(req, res) {
  const { provider, auth } = resolve(req);
  const spec = readSpec(await readJson(req));
  const controller = abortOnClose(res);
  try {
    sendJson(res, 200, await illustrate({ provider, auth, spec, signal: controller.signal }));
  } catch (error) {
    if (controller.signal.aborted) return;
    if (error?.status === 501) return sendJson(res, 501, { error: error.message });
    console.error(`[descend] illustration failed (${provider.id}, ${spec.name}):`, error?.message || error);
    sendJson(res, 502, { error: failure(provider, auth, error).message });
  }
}

async function handleCheck(req, res) {
  let resolved;
  try {
    resolved = resolve(req);
  } catch (error) {
    return sendJson(res, 200, { ok: false, message: error.message });
  }
  const { provider, auth } = resolved;
  try {
    const result = await provider.check(auth);
    sendJson(res, 200, { ok: true, provider: provider.id, ...result });
  } catch (error) {
    const { message } = failure(provider, auth, error);
    sendJson(res, 200, { ok: false, provider: provider.id, message });
  }
}

async function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.startsWith('/art/')) {
    if (await serveArt(pathname.slice(5), res)) return;
    throw new HttpError(404, 'Not found');
  }
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) throw new HttpError(403, 'Forbidden');
  try {
    const data = await readFile(filePath);
    res.writeHead(200, {
      'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(data);
  } catch {
    throw new HttpError(404, 'Not found');
  }
}

const ROUTES = {
  'POST /api/turn': handleTurn,
  'POST /api/summarize': handleSummarize,
  'POST /api/art': handleArt,
  'POST /api/check': handleCheck,
  'GET /api/status': (req, res) => {
    const { forceMock, env, defaults } = serverConfig();
    sendJson(res, 200, { forceMock, env, defaults });
  },
};

const server = http.createServer(async (req, res) => {
  try {
    const route = ROUTES[`${req.method} ${req.url.split('?')[0]}`];
    if (route) return await route(req, res);
    if (req.method === 'GET' || req.method === 'HEAD') return await serveStatic(req, res);
    throw new HttpError(405, 'Method not allowed');
  } catch (error) {
    const status = error.status || 500;
    if (status === 500) console.error('[descend]', error);
    if (!res.headersSent) sendJson(res, status, { error: error.message, auth: status === 401 });
    else res.end();
  }
});

server.listen(PORT, HOST, () => {
  const { forceMock, env, defaults, effort } = serverConfig();
  console.log(`\n  DESCEND is listening on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  if (forceMock) console.log('  Narrator: demo mode (no API calls)\n');
  else {
    const keys = [env.anthropic && `Claude (${defaults.anthropic})`, env.openai && `GPT (${defaults.openai})`].filter(Boolean);
    console.log(`  Keys from environment: ${keys.length ? keys.join(', ') : 'none (enter one on the title screen)'}; effort: ${effort}\n`);
  }
});
