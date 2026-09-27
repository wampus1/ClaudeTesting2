// Every sound in the game is synthesized with WebAudio: no files to load.
// Browsers only allow audio after a click or key press, so nothing plays until unlockAudio().

let ctx = null;
let master;
let sfxBus;
let ambBus;
let reverbIn;
const noiseCache = {};
const lastPlayed = {};
let config = { sound: true, volume: 0.7, ambience: true };
let ambience = null;

export function configureAudio(next) {
  config = { ...config, ...next };
  if (!ctx) return;
  master.gain.setTargetAtTime(config.sound ? config.volume : 0, ctx.currentTime, 0.05);
  if (config.sound && config.ambience) startAmbience();
  else stopAmbience();
}

/** Call from a user gesture. Creates the audio graph on first use. */
export function unlockAudio() {
  if (!ctx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    ctx = new AudioContext();
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.ratio.value = 4;
    compressor.connect(ctx.destination);
    master = ctx.createGain();
    master.gain.value = config.sound ? config.volume : 0;
    master.connect(compressor);
    sfxBus = ctx.createGain();
    sfxBus.connect(master);
    ambBus = ctx.createGain();
    ambBus.gain.value = 0.9;
    ambBus.connect(master);
    const reverb = ctx.createConvolver();
    reverb.buffer = impulse(3.2, 2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    reverbIn = ctx.createGain();
    reverbIn.connect(reverb).connect(wet).connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
  configureAudio({});
}

/** A cavern: decaying stereo noise. */
function impulse(seconds, decay) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
  }
  return buffer;
}

function noiseBuffer(color) {
  if (noiseCache[color]) return noiseCache[color];
  const length = ctx.sampleRate * 3;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (color === 'brown') {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      data[i] = white;
    }
  }
  noiseCache[color] = buffer;
  return buffer;
}

function envelope(gainNode, t, { attack = 0.005, dur = 0.3, peak = 0.2 }) {
  const g = gainNode.gain;
  g.setValueAtTime(0.0001, t);
  g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.exponentialRampToValueAtTime(0.0001, t + attack + dur);
}

function route(node, { dest = sfxBus, wet = 0.15 } = {}) {
  node.connect(dest);
  if (wet > 0) {
    const send = ctx.createGain();
    send.gain.value = wet;
    node.connect(send).connect(reverbIn);
  }
}

function tone({ freq, freqEnd, type = 'sine', at = 0, attack = 0.005, dur = 0.3, gain = 0.15, wet = 0.15, dest, detune = 0 }) {
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + attack + dur);
  osc.detune.value = detune;
  const g = ctx.createGain();
  envelope(g, t, { attack, dur, peak: gain });
  osc.connect(g);
  route(g, { dest, wet });
  osc.start(t);
  osc.stop(t + attack + dur + 0.05);
}

function burst({ at = 0, attack = 0.004, dur = 0.1, gain = 0.2, filter = 'bandpass', freq = 1000, freqEnd, q = 1, color = 'white', wet = 0.1, dest }) {
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(color);
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(freq, t);
  if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + attack + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  envelope(g, t, { attack, dur, peak: gain });
  src.connect(f).connect(g);
  route(g, { dest, wet });
  src.start(t, Math.random() * Math.max(0, 2.9 - attack - dur));
  src.stop(t + attack + dur + 0.05);
}

/** A struck metal bell: inharmonic partials with long, staggered decays. */
function bell(f0, { at = 0, gain = 0.1, length = 3, wet = 0.6 } = {}) {
  [[1, 1], [2.0, 0.6], [2.76, 0.45], [4.07, 0.3], [5.4, 0.2], [8.93, 0.12]].forEach(([ratio, level], i) => {
    tone({ freq: f0 * ratio, at, attack: 0.003, dur: length / (1 + i * 0.6), gain: gain * level, wet });
  });
}

const SOUNDS = {
  click: () => {
    burst({ dur: 0.03, gain: 0.22, freq: 2600, q: 3 });
    tone({ freq: 1100, freqEnd: 700, dur: 0.04, gain: 0.05, wet: 0.05 });
  },
  hover: () => burst({ dur: 0.018, gain: 0.04, filter: 'highpass', freq: 3500, wet: 0 }),
  open: () => {
    burst({ attack: 0.04, dur: 0.3, gain: 0.16, freq: 450, freqEnd: 1900, q: 1.2, color: 'brown' });
    tone({ freq: 130, freqEnd: 90, dur: 0.2, gain: 0.07, wet: 0.1 });
  },
  close: () => burst({ attack: 0.02, dur: 0.24, gain: 0.13, freq: 1700, freqEnd: 450, q: 1.2, color: 'brown' }),
  menu: () => {
    burst({ dur: 0.04, gain: 0.14, freq: 1900, q: 2 });
    burst({ at: 0.05, dur: 0.05, gain: 0.1, freq: 1300, q: 2 });
  },
  page: () => burst({ attack: 0.05, dur: 0.4, gain: 0.1, freq: 900, freqEnd: 3200, q: 0.8 }),
  submit: () => {
    tone({ freq: 230, freqEnd: 140, type: 'triangle', dur: 0.12, gain: 0.14, wet: 0.2 });
    burst({ dur: 0.06, gain: 0.18, filter: 'lowpass', freq: 900 });
  },
  pickup: () => {
    [[1320, 0.1], [2651, 0.05], [3970, 0.035]].forEach(([f, g]) => tone({ freq: f, dur: 0.5, gain: g, wet: 0.3 }));
    burst({ dur: 0.025, gain: 0.08, filter: 'highpass', freq: 4000 });
  },
  coin: () => {
    [0, 0.07, 0.16].forEach((at, i) => {
      tone({ freq: 2100 + i * 350, at, dur: 0.22, gain: 0.07, wet: 0.25 });
      tone({ freq: 3300 + i * 500, at, dur: 0.15, gain: 0.04, wet: 0.25 });
    });
  },
  drop: () => {
    tone({ freq: 95, freqEnd: 45, dur: 0.22, gain: 0.3, wet: 0.1 });
    burst({ dur: 0.1, gain: 0.25, filter: 'lowpass', freq: 500, color: 'brown' });
  },
  equip: () => {
    burst({ dur: 0.12, gain: 0.18, freq: 700, q: 2, color: 'brown' });
    [[880, 0.07], [1777, 0.035]].forEach(([f, g]) => tone({ freq: f, at: 0.06, dur: 0.35, gain: g, wet: 0.3 }));
  },
  invalid: () => {
    tone({ freq: 160, freqEnd: 120, type: 'triangle', dur: 0.08, gain: 0.12, wet: 0.05 });
    tone({ freq: 150, freqEnd: 110, type: 'triangle', at: 0.11, dur: 0.1, gain: 0.12, wet: 0.05 });
  },
  rotate: () => burst({ dur: 0.1, gain: 0.1, freq: 1200, freqEnd: 2600, q: 1.5 }),
  drag: () => burst({ attack: 0.02, dur: 0.16, gain: 0.09, freq: 900, q: 0.7, color: 'brown' }),
  examine: () => {
    burst({ attack: 0.05, dur: 0.3, gain: 0.08, freq: 1400, freqEnd: 400, q: 0.9 });
    tone({ freq: 880, at: 0.05, dur: 0.6, gain: 0.025, wet: 0.7 });
  },
  hurt: () => {
    tone({ freq: 72, freqEnd: 36, dur: 0.35, gain: 0.45, wet: 0.2 });
    burst({ dur: 0.18, gain: 0.4, filter: 'lowpass', freq: 1000, freqEnd: 200, color: 'brown' });
    tone({ freq: 190, freqEnd: 90, type: 'sawtooth', dur: 0.28, gain: 0.035, wet: 0.2 });
  },
  heal: () => [523.3, 659.3, 784].forEach((f, i) => tone({ freq: f, at: i * 0.07, attack: 0.02, dur: 0.6, gain: 0.045, wet: 0.5 })),
  dread: () => {
    [98, 103.8, 146.8].forEach((f) => tone({ freq: f, attack: 0.8, dur: 1.8, gain: 0.07, wet: 0.7 }));
    tone({ freq: 1760, freqEnd: 1700, attack: 0.9, dur: 1.4, gain: 0.008, wet: 0.8 });
  },
  gain: () => SOUNDS.pickup(),
  lose: () => tone({ freq: 440, freqEnd: 300, type: 'triangle', dur: 0.25, gain: 0.05, wet: 0.2 }),
  gateOpen: () => {
    bell(196, { gain: 0.07 });
    burst({ at: 0.2, attack: 0.3, dur: 1, gain: 0.08, filter: 'bandpass', freq: 1800, q: 4 });
  },
  gateShut: () => {
    burst({ dur: 0.5, gain: 0.5, filter: 'lowpass', freq: 320, color: 'brown', wet: 0.5 });
    [110, 233, 347].forEach((f) => tone({ freq: f, dur: 1.3, gain: 0.06, wet: 0.7 }));
  },
  chime: () => bell(523.3, { gain: 0.05, length: 2 }),
  tick: () => [0, 0.5].forEach((at, i) => tone({ freq: i ? 2600 : 3100, at, attack: 0.001, dur: 0.02, gain: 0.05, wet: 0.05 })),
  deliver: () => {
    [659.3, 784, 987.8, 1318.5].forEach((f, i) => tone({ freq: f, type: 'triangle', at: i * 0.09, attack: 0.01, dur: 1.2, gain: 0.05, wet: 0.7 }));
    bell(329.6, { at: 0.35, gain: 0.05 });
  },
  place: () => burst({ attack: 0.4, dur: 1.1, gain: 0.12, freq: 240, freqEnd: 520, q: 0.7, color: 'brown', wet: 0.4 }),
  hostile: () => {
    tone({ freq: 110, type: 'sawtooth', attack: 0.02, dur: 0.6, gain: 0.05, wet: 0.3 });
    tone({ freq: 116.5, type: 'sawtooth', attack: 0.02, dur: 0.6, gain: 0.05, wet: 0.3 });
    tone({ freq: 55, freqEnd: 40, dur: 0.4, gain: 0.25, wet: 0.2 });
  },
  scribble: () => {
    for (let i = 0; i < 7; i++) burst({ at: i * 0.08 + Math.random() * 0.03, dur: 0.04, gain: 0.05, filter: 'bandpass', freq: 3000 + Math.random() * 2500, q: 2, wet: 0.05 });
  },
  death: () => {
    bell(98, { gain: 0.14, length: 5 });
    [55, 82.4].forEach((f) => tone({ freq: f, attack: 1.2, dur: 3.5, gain: 0.08, wet: 0.8 }));
  },
  freedom: () => {
    [392, 493.9, 587.3, 784].forEach((f) => tone({ freq: f, type: 'triangle', attack: 0.7, dur: 3, gain: 0.045, wet: 0.6 }));
    bell(784, { at: 0.4, gain: 0.05 });
  },
};

const MIN_GAP = { hover: 70, click: 30, tick: 400 };

export function sfx(name) {
  if (!ctx || !config.sound || ctx.state !== 'running' || !SOUNDS[name]) return;
  const now = performance.now();
  if (now - (lastPlayed[name] || 0) < (MIN_GAP[name] ?? 25)) return;
  lastPlayed[name] = now;
  try {
    SOUNDS[name]();
  } catch {
    // A sound failing must never break the game.
  }
}

/* ---------------------------------------------------------------- ambience */

function startAmbience() {
  if (ambience || !ctx) return;
  const t = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(1, t + 3);
  out.connect(ambBus);

  // Wind in the tunnels: brown noise through a slowly wandering low-pass filter.
  const wind = ctx.createBufferSource();
  wind.buffer = noiseBuffer('brown');
  wind.loop = true;
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = 'lowpass';
  windFilter.frequency.value = 380;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.06;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 160;
  lfo.connect(lfoDepth).connect(windFilter.frequency);
  const windGain = ctx.createGain();
  windGain.gain.value = 0.05;
  wind.connect(windFilter).connect(windGain).connect(out);

  // A low drone, felt more than heard.
  const drones = [55, 82.7].map((f) => {
    const osc = ctx.createOscillator();
    osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = 0.012;
    osc.connect(g).connect(out);
    return osc;
  });

  wind.start();
  lfo.start();
  drones.forEach((o) => o.start());

  const timers = [];
  const drip = () => {
    if (!ambience) return;
    const f = 900 + Math.random() * 900;
    tone({ freq: f, freqEnd: f * 0.55, attack: 0.002, dur: 0.1, gain: 0.02 + Math.random() * 0.035, wet: 0.8, dest: out });
    timers.push(setTimeout(drip, 1800 + Math.random() * 6000));
  };
  const rumble = () => {
    if (!ambience) return;
    burst({ attack: 1.2, dur: 2.5, gain: 0.08, filter: 'lowpass', freq: 90, color: 'brown', wet: 0.3, dest: out });
    timers.push(setTimeout(rumble, 25000 + Math.random() * 35000));
  };
  timers.push(setTimeout(drip, 1500), setTimeout(rumble, 12000));
  ambience = { out, sources: [wind, lfo, ...drones], timers };
}

function stopAmbience() {
  if (!ambience) return;
  const { out, sources, timers } = ambience;
  ambience = null;
  timers.forEach(clearTimeout);
  out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
  setTimeout(() => sources.forEach((s) => { try { s.stop(); } catch { /* already stopped */ } }), 2000);
}
