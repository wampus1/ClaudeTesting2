import './lib/env.js';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { narrate, describeError, getConfig } from './lib/narrator.js';
import { buildUserTurn } from './lib/prompt.js';

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
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
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
  return history.map((message, i) => {
    const expected = i % 2 === 0 ? 'user' : 'assistant';
    if (!message || message.role !== expected || typeof message.content !== 'string' || !message.content) {
      throw new HttpError(400, 'The saved transcript is corrupted. Begin a new descent.');
    }
    return { role: message.role, content: message.content };
  });
}

async function handleTurn(req, res) {
  const body = await readJson(req);
  const history = validateHistory(body.history);
  if (history.length % 2 !== 0) throw new HttpError(400, 'The saved transcript is corrupted. Begin a new descent.');

  const opening = history.length === 0;
  const action = typeof body.action === 'string' ? body.action.trim() : '';
  if (!opening && !action) throw new HttpError(400, 'Say what you do.');
  const userContent = buildUserTurn(body.state, opening ? null : action);

  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableFinished) controller.abort();
  });

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
    const result = await narrate({
      history,
      userContent,
      signal: controller.signal,
      onText: (text) => send({ type: 'text', text }),
    });
    if (result.stopReason === 'refusal') {
      send({ type: 'refusal', message: 'The narrator will not tell that part of the tale. Try another course.' });
    } else {
      send({ type: 'done', ...result });
    }
  } catch (error) {
    if (controller.signal.aborted || error instanceof Anthropic.APIUserAbortError) return;
    console.error('[descend] narration failed:', error?.message || error);
    send({ type: 'error', ...describeError(error) });
  }
  res.end();
}

async function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);
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

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/turn') return await handleTurn(req, res);
    if (req.method === 'GET' && req.url === '/api/status') {
      const { mock, model } = getConfig();
      return sendJson(res, 200, { mock, model });
    }
    if (req.method === 'GET' || req.method === 'HEAD') return await serveStatic(req, res);
    throw new HttpError(405, 'Method not allowed');
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status === 500) console.error('[descend]', error);
    if (!res.headersSent) sendJson(res, status, { error: error.message });
    else res.end();
  }
});

server.listen(PORT, HOST, () => {
  const { mock, model, effort } = getConfig();
  console.log(`\n  DESCEND is listening on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(mock ? '  Narrator: mock mode (no API calls)\n' : `  Narrator: ${model} (effort: ${effort})\n`);
});
