// Narrator: plays the recorded natural voices (generated with Kokoro from the
// media-use skill and listed in content/voices.json). No robotic fallback:
// a line without a recording simply stays silent.

import { playVoice, stopVoice } from './audio.js';

const KEY = 'genesis.narrator';
let auto = true;
try { auto = localStorage.getItem(KEY) !== '0'; } catch { /* ignore */ }
let recorded = null;

export function narratorOn() { return auto; }
export function setNarrator(on) {
  auto = on;
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* ignore */ }
  if (!on) stopSpeaking();
}

export async function loadRecorded(assets) {
  if (recorded) return recorded;
  try { recorded = (await assets.loadJSON('voices.json')).files || {}; } catch { recorded = {}; }
  return recorded;
}

export function hasVoice(key) { return Boolean(recorded && recorded[key]); }

export function stopSpeaking() { stopVoice(); }

/** key: id of the recorded line, e.g. "cap0_s1-0", "verse-v01". */
export function speak(_text, key) {
  if (key && recorded && recorded[key]) playVoice(recorded[key]);
}
