// Arena online: private rooms on Supabase (see supabase/arena_online.sql).
// Each phone plays with a random secret token; the server keeps the clock,
// the score and one answer per question. Ready for 2x2 (mode/team), today 1x1.

import { rpc, cloudOn } from './account.js';

const TOKEN_KEY = 'genesis.roomToken';
export const ROOM_RULE = /^[A-HJ-NP-Z2-9]{6}$/;

export function roomToken() {
  try {
    let t = localStorage.getItem(TOKEN_KEY);
    if (!t) {
      t = [...crypto.getRandomValues(new Uint8Array(18))].map((b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(TOKEN_KEY, t);
    }
    return t;
  } catch { return 'sem-armazenamento-' + Math.random().toString(16).slice(2, 18); }
}

export const cleanRoom = (raw) => String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
export const roomsOn = cloudOn;

/** Server error text → message for the player. */
export function roomError(err) {
  const m = String((err && err.message) || err);
  if (/nao existe/.test(m)) return 'Não achei essa sala. Confira o código.';
  if (/cheia/.test(m)) return 'Essa sala já está cheia.';
  if (/ja comecou/.test(m)) return 'Essa partida já começou.';
  if (/nao esta/.test(m)) return 'Você não está nesta sala.';
  if (/abort|Failed to fetch|NetworkError|cloud/.test(m)) return 'Sem conexão com o servidor. Verifique a internet.';
  return 'Algo deu errado. Tente de novo.';
}

const call = (fn, body) => rpc(fn, body, { timeout: 8000 });

export const createRoom = (nick, avatar) => call('genesis_room_create', { p_token: roomToken(), p_nick: nick, p_avatar: avatar || null, p_mode: '1x1' });
export const joinRoom = (code, nick, avatar) => call('genesis_room_join', { p_code: cleanRoom(code), p_token: roomToken(), p_nick: nick, p_avatar: avatar || null });
export const roomState = (code) => call('genesis_room_state', { p_code: code, p_token: roomToken() });
export const sendAnswer = (code, q, ok) => call('genesis_room_answer', { p_code: code, p_token: roomToken(), p_q: q, p_ok: ok });
export const leaveRoom = (code) => rpc('genesis_room_leave', { p_code: code, p_token: roomToken() }, { keepalive: true, timeout: 4000 }).catch(() => {});
