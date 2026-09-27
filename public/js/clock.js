// The game clock: minutes since midnight before the first day. Shared by the browser and the server.

export const START_CLOCK = 19 * 60 + 15; // Day 1, 19:15: dusk, as the gate is shut behind the prisoner.
export const GATE_OPENS = 7 * 60;
export const GATE_CLOSES = 19 * 60;
const DAY = 24 * 60;
const MAX_STEP = 3 * DAY;

export function clockParts(clock) {
  const total = Math.max(0, Math.round(Number(clock) || 0));
  const day = Math.floor(total / DAY) + 1;
  const minuteOfDay = total % DAY;
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  let period = 'night';
  if (minuteOfDay >= 5 * 60 && minuteOfDay < GATE_OPENS) period = 'dawn';
  else if (minuteOfDay >= GATE_OPENS && minuteOfDay < GATE_CLOSES) period = 'day';
  else if (minuteOfDay >= GATE_CLOSES && minuteOfDay < 20 * 60) period = 'dusk';
  return { total, day, minuteOfDay, hour, minute, period, gateOpen: period === 'day' };
}

export const formatHour = (parts) => `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;

const NUMBER_WORDS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, ninety: 90,
  few: 3, several: 4, couple: 2, some: 2,
};
const UNIT_MINUTES = { d: DAY, day: DAY, days: DAY, h: 60, hr: 60, hrs: 60, hour: 60, hours: 60, m: 1, min: 1, mins: 1, minute: 1, minutes: 1 };

/** Turns the narrator's "[Elapsed: ...]" text into minutes: "20 minutes", "2 hours", "an hour and a half", "1h 30m". */
export function parseElapsed(text) {
  const amountOf = (word) => (/^\d/.test(word) ? parseFloat(word) : NUMBER_WORDS[word]);
  const half = (all, n, unit) => (amountOf(n) != null ? `${amountOf(n) + 0.5} ${unit}` : all);
  let s = String(text ?? '').toLowerCase().replace(/-/g, ' ');
  s = s.replace(/\b(\d+(?:\.\d+)?|[a-z]+) and a half (hours?|days?)\b/g, half);
  s = s.replace(/\b(\d+(?:\.\d+)?|[a-z]+) (hours?|days?) and a half\b/g, half);
  let minutes = 0;
  let matched = false;
  if (/\bhalf (an|a) hour\b|\bhalf hour\b/.test(s)) { minutes += 30; matched = true; }
  if (/\bquarter (of an |an )?hour\b/.test(s)) { minutes += 15; matched = true; }
  const re = /(\d+(?:\.\d+)?|[a-z]+)\s*(?:of\s+(?:an?\s+)?)?(days?|d|hours?|hrs?|h|minutes?|mins?|m)\b/g;
  for (const m of s.matchAll(re)) {
    const amount = amountOf(m[1]);
    if (amount == null) continue;
    // "half an hour" and "quarter hour" were counted above.
    if (m[1] === 'an' && /\b(half|quarter) (of )?an hour/.test(s)) continue;
    minutes += amount * UNIT_MINUTES[m[2]];
    matched = true;
  }
  if (!matched) minutes = /\bmoment|instant|breath|second/.test(s) ? 1 : 10;
  return Math.max(1, Math.min(MAX_STEP, Math.round(minutes)));
}

export function formatDuration(minutes) {
  const m = Math.round(minutes);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'}`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return `${h} hour${h === 1 ? '' : 's'}${rest ? ` ${rest} min` : ''}`;
}
