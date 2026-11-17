// Cloud account: the player's progress is copied to Supabase under a secret
// code (GEN-XXXX-XXXX-XXXX). No e-mail, no password, no personal data: whoever
// has the code opens the account on any phone or browser.

import { CLOUD } from './config.js';

const ACCOUNT_KEY = 'genesis.account';
// the game's creator (owner code) never shows up in the ranking
const isOwner = () => { try { return localStorage.getItem('genesis.owner') === '1'; } catch { return false; } };
const payload = (state) => (isOwner() ? { ...state, creator: true } : state);
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I (easy to read)
export const CODE_RULE = /^GEN-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/;

export const cloudOn = () => Boolean(CLOUD.url && CLOUD.key);

export function accountCode() {
  try { return (JSON.parse(localStorage.getItem(ACCOUNT_KEY) || 'null') || {}).code || ''; } catch { return ''; }
}
function setAccountCode(code) {
  try { localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ code, at: new Date().toISOString() })); } catch { /* storage blocked */ }
}

/** Tidies what the player typed: spaces, lowercase, missing dashes. */
export function cleanCode(raw) {
  const s = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^GEN/, '');
  if (s.length !== 12) return String(raw || '').trim().toUpperCase();
  return `GEN-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}

function newCode() {
  const r = crypto.getRandomValues(new Uint8Array(12));
  const c = [...r].map((b) => ALPHABET[b % 32]).join(''); // 256 % 32 = 0: no bias
  return `GEN-${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}`;
}

async function rpc(fn, body, { keepalive = false, timeout = 12000 } = {}) {
  const headers = { 'Content-Type': 'application/json', apikey: CLOUD.key };
  if (CLOUD.key.startsWith('eyJ')) headers.Authorization = `Bearer ${CLOUD.key}`; // legacy anon key (JWT)
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`${CLOUD.url.replace(/\/$/, '')}/rest/v1/rpc/${fn}`, {
      method: 'POST', headers, body: JSON.stringify(body), keepalive, signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`cloud ${fn} ${res.status}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } finally {
    clearTimeout(timer);
  }
}

/** Creates an account with this phone's progress and keeps its code here. */
export async function createAccount(save) {
  const code = newCode();
  await rpc('genesis_create', { p_code: code, p_data: payload(save.state) });
  setAccountCode(code);
  lastPushed = JSON.stringify(payload(save.state));
  return code;
}

/** Progress stored under a code, or null when the code does not exist. */
export async function fetchAccount(code) {
  const data = await rpc('genesis_load', { p_code: cleanCode(code) });
  return data && typeof data === 'object' ? data : null;
}

/** Opens an existing account on this phone (replaces the progress here). */
export async function enterAccount(save, code) {
  const clean = cleanCode(code);
  if (!CODE_RULE.test(clean)) return { ok: false, msg: 'O código tem este formato: GEN-XXXX-XXXX-XXXX.' };
  let data;
  try { data = await fetchAccount(clean); } catch { return { ok: false, msg: 'Sem internet agora. Conecte e tente de novo.' }; }
  if (!data) return { ok: false, msg: 'Não achamos uma conta com esse código. Confira as letras.' };
  save.replace(data);
  setAccountCode(clean);
  lastPushed = JSON.stringify(save.state);
  return { ok: true };
}

// ---- keeping the copy in the cloud up to date ----
let lastPushed = '';
let timer = null;
let pushing = false;

export async function pushNow(save, { keepalive = false } = {}) {
  const code = accountCode();
  if (!cloudOn() || !code || pushing) return;
  const json = JSON.stringify(payload(save.state));
  if (json === lastPushed) return;
  pushing = true;
  try {
    const ok = await rpc('genesis_save', { p_code: code, p_data: payload(save.state) }, { keepalive });
    if (ok) lastPushed = json;
  } catch { /* offline: tries again on the next change */ } finally {
    pushing = false;
  }
}

/**
 * At boot: when the account was played on another phone more recently, bring
 * that progress here. Then every change is sent a few seconds later.
 */
export async function startSync(save) {
  if (!cloudOn()) return { pulled: false };
  let pulled = false;
  const code = accountCode();
  if (code) {
    try {
      const remote = await fetchAccount(code);
      if (remote && (remote.savedAt || 0) > (save.state.savedAt || 0)) {
        save.replace(remote);
        pulled = true;
      }
      lastPushed = remote ? JSON.stringify(remote) : '';
    } catch { /* offline: keep playing with what is here */ }
  }
  save.onWrite = () => {
    clearTimeout(timer);
    timer = setTimeout(() => pushNow(save), 4000);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { clearTimeout(timer); pushNow(save, { keepalive: true }); }
  });
  if (code) pushNow(save);
  return { pulled };
}

/** Top 50 and this player's place. kind: 'trofeus' | 'arena' | 'estrelas'. */
export async function fetchRanking(kind) {
  return rpc('genesis_ranking', { p_kind: kind, p_code: accountCode() || null });
}
