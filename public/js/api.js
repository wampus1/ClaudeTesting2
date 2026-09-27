// Calls to the game server. Every request carries the narrator settings as headers.

import { apiHeaders } from './settings.js';

export class ApiError extends Error {
  constructor(message, { status = 0, auth = false, retry = true } = {}) {
    super(message);
    this.status = status;
    this.auth = auth;
    this.retry = retry;
  }
}

export async function postJson(path, body, { signal } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...apiHeaders() },
      body: JSON.stringify(body ?? {}),
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('The game server cannot be reached. Is it still running?', { retry: true });
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.error || `The server answered ${response.status}.`, { status: response.status, auth: Boolean(data.auth) || response.status === 401, retry: response.status >= 500 });
  return data;
}

export async function getJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new ApiError(`The server answered ${response.status}.`, { status: response.status });
  return response.json();
}

/** Streams a narrator turn: yields {type:'turn'|'text'|'done'|'refusal'|'error', ...} events. */
export async function* streamTurn(body, { signal } = {}) {
  let response;
  try {
    response = await fetch('/api/turn', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...apiHeaders() },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    throw new ApiError('The game server cannot be reached. Is it still running?', { retry: true });
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(data.error || `The narrator did not answer (${response.status}).`, { status: response.status, auth: Boolean(data.auth), retry: response.status >= 500 });
  }
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
