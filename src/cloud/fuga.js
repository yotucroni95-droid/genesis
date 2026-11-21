// Fuga da Tentação: server calls (supabase/fuga.sql) and an offline "solo"
// room with the same answers, so training works without internet.

import { rpc, cloudOn } from './account.js';
import { roomToken, cleanRoom } from './rooms.js';
import { taskCount } from '../fuga/tasks.js';

export const fugaOn = cloudOn;
const tok = () => roomToken();

export const online = {
  create: (nick, avatar, pub, diff) => rpc('genesis_fuga_create', { p_token: tok(), p_nick: nick, p_avatar: avatar || null, p_public: pub, p_difficulty: diff }),
  quick: (nick, avatar, diff) => rpc('genesis_fuga_quick', { p_token: tok(), p_nick: nick, p_avatar: avatar || null, p_difficulty: diff }),
  join: (code, nick, avatar) => rpc('genesis_fuga_join', { p_code: cleanRoom(code), p_token: tok(), p_nick: nick, p_avatar: avatar || null }),
  state: (code) => rpc('genesis_fuga_state', { p_code: code, p_token: tok() }, { timeout: 8000 }),
  start: (code) => rpc('genesis_fuga_start', { p_code: code, p_token: tok() }),
  task: (code, n) => rpc('genesis_fuga_task', { p_code: code, p_token: tok(), p_task: n }),
  caught: (code, seat) => rpc('genesis_fuga_caught', { p_code: code, p_token: tok(), p_seat: seat }),
  answer: (code, choice) => rpc('genesis_fuga_answer', { p_code: code, p_token: tok(), p_choice: choice }),
  escape: (code) => rpc('genesis_fuga_escape', { p_code: code, p_token: tok() }),
  list: () => rpc('genesis_fuga_list', {}, { timeout: 8000 }),
  setPublic: (code, pub) => rpc('genesis_fuga_set_public', { p_code: code, p_token: tok(), p_public: !!pub }),
  kick: (code, seat) => rpc('genesis_fuga_kick', { p_code: code, p_token: tok(), p_seat: seat }),
  avatar: (code, avatar) => rpc('genesis_fuga_avatar', { p_code: code, p_token: tok(), p_avatar: avatar }),
  leave: (code) => rpc('genesis_fuga_leave', { p_code: code, p_token: tok() }, { keepalive: true, timeout: 4000 }).catch(() => {}),
};

export function fugaError(err) {
  const m = String((err && err.message) || err);
  if (/nao existe/.test(m)) return 'Não achei essa sala. Confira o código.';
  if (/cheia/.test(m)) return 'Essa sala já está cheia (5 jogadores).';
  if (/ja comecou/.test(m)) return 'Essa partida já começou. Crie uma sala ou entre em outra.';
  if (/removido|nao esta nesta sala/.test(m)) return 'O anfitrião tirou você dessa sala.';
  if (/anfitriao/.test(m)) return 'Só quem abriu a sala pode fazer isso.';
  if (/404|PGRST202|Could not find/.test(m)) return 'O modo online da Fuga ainda não foi ligado no servidor. Jogue no treino!';
  return 'Sem conexão com o servidor. Verifique a internet.';
}

/** Offline room: same shape and rules as the SQL, kept in memory. */
export function soloRoom(nick, avatar, difficulty, questions) {
  const now = () => Date.now();
  const st = { code: 'TREINO', seed: 1 + Math.floor(Math.random() * 999999), public: false, difficulty, status: 'waiting', tasksTotal: 0, limit: 480, me: 0, done: [], challenge: null };
  const me = { seat: 0, nick, avatar, alive: true, escaped: false, tasks: 0, left: false, caught: false, protected: false };
  let startedAt = 0; let chal = null; let protUntil = 0; let lastTask = 0;
  const view = (extra = {}) => {
    if (st.status === 'playing') {
      if (chal && now() > chal.until + 2000) { me.alive = false; chal = null; }
      if (!me.alive) st.status = 'lost';
      else if (me.escaped) st.status = 'won';
      else if (now() > startedAt + st.limit * 1000) st.status = 'lost';
    }
    me.caught = Boolean(chal); me.protected = now() < protUntil;
    return { ...st, startsIn: startedAt ? startedAt - now() : null, done: st.done.slice(), players: [{ ...me }],
      challenge: chal ? { q: chal.q.q, verse: chal.q.verse, options: chal.opts, ms: Math.max(0, chal.until - now()) } : null, ...extra };
  };
  return {
    solo: true,
    state: async () => view(),
    start: async () => { if (st.status === 'waiting') { st.status = 'playing'; startedAt = now() + 1500; st.tasksTotal = taskCount(1, difficulty); } return view(); },
    task: async (_c, n) => {
      if (st.status === 'playing' && me.alive && !chal && n >= 0 && n < st.tasksTotal && now() - lastTask > 3000 && !st.done.includes(n)) { st.done.push(n); me.tasks++; lastTask = now(); }
      return view();
    },
    caught: async () => {
      if (st.status === 'playing' && me.alive && !chal && now() > protUntil) {
        const q = questions[Math.floor(Math.random() * questions.length)];
        const rot = Math.floor(Math.random() * 3); const n = q.options.length;
        chal = { q, rot, opts: q.options.map((_, k) => q.options[(k + rot) % n]), until: now() + ([12, 9, 6][difficulty] + 1) * 1000 };
      }
      return view();
    },
    answer: async (_c, choice) => {
      if (!chal) return view({ ok: me.alive });
      const ok = choice >= 0 && now() <= chal.until + 1500 && (choice + chal.rot) % chal.q.options.length === chal.q.answer;
      const q = chal.q; chal = null;
      if (ok) protUntil = now() + 6000; else me.alive = false;
      return view({ ok, verse: q.verse, right: q.options[q.answer] });
    },
    escape: async () => { if (st.status === 'playing' && st.done.length >= st.tasksTotal && me.alive && !chal) me.escaped = true; return view(); },
    leave: async () => {},
  };
}
