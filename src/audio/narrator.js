// Narrator: reads the story aloud. If a recorded voice file exists for a
// line (content/voices.json lists them), it is played; otherwise the phone's
// own best Portuguese voice is used.

import { isMuted } from './audio.js';

const KEY = 'genesis.narrator';
let auto = true;
try { auto = localStorage.getItem(KEY) !== '0'; } catch { /* ignore */ }
let current = null;
let recorded = null;

export function narratorOn() { return auto; }
export function setNarrator(on) {
  auto = on;
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* ignore */ }
  if (!on) stopSpeaking();
}

let voicesReady = null;
function getVoices() {
  // Chrome on Android loads the list later: wait for it once
  if (!window.speechSynthesis) return Promise.resolve([]);
  const now = window.speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);
  if (!voicesReady) {
    voicesReady = new Promise((resolve) => {
      window.speechSynthesis.onvoiceschanged = () => resolve(window.speechSynthesis.getVoices());
      setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1500);
    });
  }
  return voicesReady;
}

/** Only Brazilian Portuguese voices; never Portugal's. Best-sounding first. */
async function bestVoice() {
  const voices = await getVoices();
  const br = voices.filter((v) => /^pt[-_]br$/i.test(v.lang) || /brasil|brazil/i.test(v.name));
  const rank = (v) => (/(natural|neural|premium|enhanced|online)/i.test(v.name) ? 0
    : /google/i.test(v.name) ? 1
      : /(luciana|francisca|thalita|antonio|daniel|felipe)/i.test(v.name) ? 2
        : /(grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley)/i.test(v.name) ? 9 : 3);
  return br.sort((a, b) => rank(a) - rank(b))[0] || null;
}

export async function loadRecorded(assets) {
  if (recorded) return recorded;
  try { recorded = (await assets.loadJSON('voices.json')).files || {}; } catch { recorded = {}; }
  return recorded;
}

export function stopSpeaking() {
  if (current && current.pause) current.pause();
  current = null;
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}

/** key: optional id of a recorded file, e.g. "cap0_s1-0". */
export function speak(text, key) {
  stopSpeaking();
  if (isMuted()) return;
  if (key && recorded && recorded[key]) {
    current = new Audio(recorded[key]);
    current.play().catch(() => {});
    return;
  }
  if (!window.speechSynthesis) return;
  bestVoice().then((v) => {
    if (!v) return; // no Brazilian voice on this phone: stay silent instead of using Portugal's
    const u = new SpeechSynthesisUtterance(text.replace(/[*_"“”]/g, ''));
    u.voice = v;
    u.lang = v.lang;
    u.rate = 0.95;
    u.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  });
}
