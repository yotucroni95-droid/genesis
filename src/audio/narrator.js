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

function bestVoice() {
  const voices = (window.speechSynthesis && window.speechSynthesis.getVoices()) || [];
  const pt = voices.filter((v) => /^pt(-|_)?BR/i.test(v.lang) || v.lang === 'pt-BR');
  const all = pt.length ? pt : voices.filter((v) => /^pt/i.test(v.lang));
  const rank = (v) => (/(natural|neural|premium|enhanced|online)/i.test(v.name) ? 0 : /google/i.test(v.name) ? 1 : /(luciana|francisca|thalita|antonio|daniel)/i.test(v.name) ? 2 : 3);
  return all.sort((a, b) => rank(a) - rank(b))[0] || null;
}
if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = () => {};

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
  const u = new SpeechSynthesisUtterance(text.replace(/[*_"“”]/g, ''));
  const v = bestVoice();
  if (v) u.voice = v;
  u.lang = 'pt-BR';
  u.rate = 0.95;
  u.pitch = 1;
  window.speechSynthesis.speak(u);
}
