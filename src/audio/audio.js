// Sound effects and music made by the browser itself (Web Audio), so the
// game needs no audio files. One switch mutes everything (for church time).

let ctx = null;
let master = null;
let musicGain = null;
let sfxGain = null;
let muted = false;
let music = null; // { timer, name }

const KEY = 'genesis.muted';
try { muted = localStorage.getItem(KEY) === '1'; } catch { /* storage blocked */ }

// volume of each part (0 to 1), set in Configurações
const VOL_KEY = 'genesis.volume';
const vol = { music: 1, sfx: 1, voice: 1 };
try { Object.assign(vol, JSON.parse(localStorage.getItem(VOL_KEY) || '{}')); } catch { /* storage blocked */ }
const MUSIC_BASE = 0.12;
const SFX_BASE = 0.6;
const musicLevel = (duck = false) => (duck ? 0.035 : MUSIC_BASE) * vol.music;
export function getVolume() { return { ...vol }; }
export function setVolume(part, value) {
  vol[part] = Math.max(0, Math.min(1, Number(value) || 0));
  try { localStorage.setItem(VOL_KEY, JSON.stringify(vol)); } catch { /* ignore */ }
  if (!ctx) return;
  if (part === 'music') musicGain.gain.setTargetAtTime(musicLevel(Boolean(voiceSrc)), ctx.currentTime, 0.05);
  if (part === 'sfx') sfxGain.gain.setTargetAtTime(SFX_BASE * vol.sfx, ctx.currentTime, 0.05);
}

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = musicLevel();
  musicGain.connect(master);
  sfxGain = ctx.createGain();
  sfxGain.gain.value = SFX_BASE * vol.sfx;
  sfxGain.connect(master);
  return ctx;
}

// Recorded effects (Pixabay licence, from the media-use skill). Each name
// maps to [file, volume]; anything not listed here is synthesised.
const SAMPLES = {
  click: [['click-soft', 0.35]],
  coin: [['ping', 0.5]],
  correct: [['chime', 0.45]],
  wrong: [['error', 0.4]],
  star: [['sparkle', 0.55]],
  open: [['impact-bass-1', 0.6], ['sparkle', 0.5, 0.25]],
  scroll: [['sparkle', 0.6]],
  fanfare: [['riser', 0.45], ['chime', 0.6, 0.9]],
  enter: [['whoosh-short', 0.5]],
  transition: [['whoosh', 0.25]],
  resist: [['chime', 0.55]],
  notify: [['notification', 0.4]],
};
const buffers = {};
let samplesLoading = false;

function loadSamples() {
  if (samplesLoading || !ctx) return;
  samplesLoading = true;
  const files = new Set(Object.values(SAMPLES).flat().map(([f]) => f));
  for (const f of files) {
    fetch(`assets/sfx/${f}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
      .then((b) => new Promise((res, rej) => ctx.decodeAudioData(b, res, rej)))
      .then((buf) => { buffers[f] = buf; })
      .catch(() => { /* keep the synthesised version */ });
  }
}

function playSample(name) {
  const list = SAMPLES[name];
  if (!list || !list.every(([f]) => buffers[f])) return false;
  for (const [f, vol, delay = 0] of list) {
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    g.gain.value = vol;
    src.buffer = buffers[f];
    src.connect(g).connect(sfxGain);
    src.start(ctx.currentTime + delay);
  }
  return true;
}

let unlocked = false;
let keepAlive = null;

/**
 * Call on taps. Phones only allow sound inside a real "activation" event:
 * touchend / pointerup / click — NOT when the finger first touches. On the
 * first one we resume the audio engine and play a tiny silent sound, which
 * is what iOS needs to really open the audio.
 */
export function unlockAudio() {
  const c = ensure();
  if (!c) return;
  // iPhone: treat the game like a media app, so it plays even with the
  // silent switch on (Safari 16.4+).
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* not supported */ }
  if (c.state !== 'running') c.resume().catch(() => {});
  if (!unlocked) {
    const b = c.createBuffer(1, 1, 22050);
    const s = c.createBufferSource();
    s.buffer = b;
    s.connect(c.destination);
    s.start(0);
    // older iPhones: a silent looping <audio> keeps the media channel open
    // so Web Audio is not muted by the silent switch
    if (!keepAlive) {
      keepAlive = document.createElement('audio');
      keepAlive.setAttribute('playsinline', '');
      keepAlive.loop = true;
      keepAlive.volume = 0;
      keepAlive.src = 'data:audio/wav;base64,UklGRmQGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YUAGAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';
      keepAlive.play().then(() => { unlocked = true; }).catch(() => {});
    }
    if (c.state === 'running') unlocked = true;
  }
  loadSamples();
}

export function isMuted() { return muted; }

export function setMuted(value) {
  muted = value;
  try { localStorage.setItem(KEY, value ? '1' : '0'); } catch { /* ignore */ }
  if (master) master.gain.setTargetAtTime(value ? 0 : 1, ctx.currentTime, 0.05);
  if (value) stopVoice();
}

export function toggleMuted() { setMuted(!muted); return muted; }

// ---------- effects ----------

function tone(freq, start, dur, { type = 'square', vol = 0.5, slide = 0, out = sfxGain } = {}) {
  const c = ensure();
  if (!c || muted) return;
  const t = c.currentTime + start;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(start, dur, vol = 0.3) {
  const c = ensure();
  if (!c || muted) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = c.createBufferSource();
  const g = c.createGain();
  g.gain.value = vol;
  s.buffer = buf;
  s.connect(g).connect(sfxGain);
  s.start(c.currentTime + start);
}

const SFX = {
  click: () => tone(660, 0, 0.06, { type: 'triangle', vol: 0.3 }),
  coin: () => { tone(988, 0, 0.08); tone(1319, 0.07, 0.22); },
  correct: () => { tone(523, 0, 0.1, { type: 'triangle' }); tone(659, 0.08, 0.1, { type: 'triangle' }); tone(784, 0.16, 0.25, { type: 'triangle' }); },
  wrong: () => { tone(220, 0, 0.25, { type: 'sawtooth', vol: 0.25, slide: -80 }); },
  star: () => { tone(1047, 0, 0.12, { type: 'triangle' }); tone(1568, 0.06, 0.3, { type: 'sine', vol: 0.4 }); },
  step: () => noise(0, 0.04, 0.05),
  shake: () => { noise(0, 0.12, 0.2); tone(110, 0, 0.12, { type: 'square', vol: 0.15 }); },
  open: () => { noise(0, 0.3, 0.35); [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.05 + i * 0.06, 0.3, { type: 'triangle', vol: 0.35 })); },
  scroll: () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.07, 0.18, { type: 'sine', vol: 0.4 })); },
  fanfare: () => { [[523, 0], [523, 0.12], [523, 0.24], [659, 0.36], [784, 0.6], [659, 0.78], [784, 0.9], [1047, 1.05]].forEach(([f, t]) => tone(f, t, 0.35, { type: 'square', vol: 0.3 })); },
  enter: () => { tone(392, 0, 0.1, { type: 'triangle' }); tone(784, 0.08, 0.2, { type: 'triangle' }); },
  talk: () => tone(440 + Math.random() * 120, 0, 0.04, { type: 'square', vol: 0.12 }),
  transition: () => noise(0, 0.25, 0.08),
  notify: () => { tone(880, 0, 0.1, { type: 'sine' }); tone(1320, 0.08, 0.2, { type: 'sine' }); },
  hiss: () => { noise(0, 0.55, 0.22); tone(180, 0, 0.5, { type: 'sawtooth', vol: 0.08, slide: -60 }); },
  heartbeat: () => { tone(62, 0, 0.12, { type: 'sine', vol: 0.7 }); tone(58, 0.16, 0.12, { type: 'sine', vol: 0.5 }); },
  rustle: () => { noise(0, 0.09, 0.12); noise(0.05, 0.07, 0.08); },
  bubble: () => { tone(740, 0, 0.05, { type: 'sine', vol: 0.35 }); tone(1110, 0.05, 0.08, { type: 'sine', vol: 0.3 }); },
  warn: () => { tone(330, 0, 0.15, { type: 'square', vol: 0.2 }); tone(330, 0.25, 0.15, { type: 'square', vol: 0.2 }); },
  resist: () => { tone(392, 0, 0.15, { type: 'triangle' }); tone(523, 0.1, 0.15, { type: 'triangle' }); tone(784, 0.2, 0.4, { type: 'sine', vol: 0.5 }); },
};

export function sfx(name) {
  if (muted || !ensure()) return;
  if (playSample(name)) return;
  const f = SFX[name];
  if (f) f();
}

// ---------- recorded voices (narrator and characters) ----------

const voiceCache = new Map();
let voiceSrc = null;

export function stopVoice() {
  if (voiceSrc) { try { voiceSrc.stop(); } catch { /* already stopped */ } }
  voiceSrc = null;
  if (musicGain && ctx) musicGain.gain.setTargetAtTime(musicLevel(), ctx.currentTime, 0.3);
}

/** Plays a recorded line (m4a). Music gets quieter while someone speaks. */
export async function playVoice(url) {
  const c = ensure();
  if (!c || muted) return;
  stopVoice();
  let buf = voiceCache.get(url);
  if (!buf) {
    try {
      const data = await (await fetch(url)).arrayBuffer();
      buf = await new Promise((res, rej) => c.decodeAudioData(data, res, rej));
      voiceCache.set(url, buf);
      if (voiceCache.size > 40) voiceCache.delete(voiceCache.keys().next().value);
    } catch { return; }
  }
  if (muted) return;
  const src = c.createBufferSource();
  const g = c.createGain();
  g.gain.value = 1.4 * vol.voice;
  src.buffer = buf;
  src.connect(g).connect(master);
  musicGain.gain.setTargetAtTime(musicLevel(true), c.currentTime, 0.15);
  src.onended = () => { if (voiceSrc === src) stopVoice(); };
  voiceSrc = src;
  src.start();
}

// ---------- music: small looping tunes per mood ----------

const N = (n) => 440 * 2 ** ((n - 69) / 12); // MIDI note to frequency
const TUNES = {
  lobby: { bpm: 92, lead: [72, 76, 79, 76, 74, 77, 81, 77, 72, 76, 79, 84, 83, 79, 76, 74], bass: [48, 48, 53, 53, 48, 48, 55, 55], wave: 'triangle' },
  ceu: { bpm: 70, lead: [76, 79, 84, 83, 79, 76, 74, 76, 79, 81, 79, 76, 74, 72, 74, 76], bass: [52, 57, 53, 55], wave: 'sine' },
  eden: { bpm: 96, lead: [67, 71, 74, 72, 71, 67, 69, 71, 72, 74, 76, 74, 72, 71, 69, 67], bass: [43, 43, 48, 50], wave: 'triangle' },
  fora_eden: { bpm: 72, lead: [69, 72, 76, 74, 72, 69, 67, 69, 72, 71, 69, 67, 64, 65, 67, 69], bass: [45, 41, 43, 40], wave: 'triangle' },
  campos: { bpm: 100, lead: [72, 74, 76, 79, 76, 74, 72, 67, 69, 72, 74, 72, 69, 67, 69, 72], bass: [48, 45, 41, 43], wave: 'square' },
  arca: { bpm: 104, lead: [74, 78, 81, 78, 76, 79, 83, 79, 74, 78, 81, 86, 85, 81, 78, 76], bass: [50, 47, 43, 45], wave: 'triangle' },
  arena: { bpm: 138, lead: [76, 76, 79, 76, 81, 79, 76, 74, 76, 76, 79, 83, 81, 79, 76, 79], bass: [52, 52, 57, 55], wave: 'square' },
};

export function playMusic(name) {
  if (music && music.name === name) return;
  stopMusic();
  const tune = TUNES[name];
  const c = ensure();
  if (!tune || !c) return;
  const step = 60 / tune.bpm / 2; // eighth notes
  let i = 0;
  let next = c.currentTime + 0.1;
  const timer = setInterval(() => {
    if (!ctx) return;
    while (next < ctx.currentTime + 0.3) {
      if (!muted) {
        const lead = tune.lead[i % tune.lead.length];
        if (i % 2 === 0 || Math.random() < 0.5) tone(N(lead), next - ctx.currentTime, step * 1.6, { type: tune.wave, vol: 0.5, out: musicGain });
        if (i % 4 === 0) tone(N(tune.bass[Math.floor(i / 4) % tune.bass.length]), next - ctx.currentTime, step * 3.6, { type: 'triangle', vol: 0.7, out: musicGain });
      }
      next += step;
      i += 1;
    }
  }, 100);
  music = { name, timer };
}

export function stopMusic() {
  if (music) clearInterval(music.timer);
  music = null;
}

// pause the music when the app goes to the background
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend(); else ctx.resume().catch(() => {});
});
