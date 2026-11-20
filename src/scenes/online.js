// Arena online 1x1 and 2x2 (duplas): private room by code or invite link (?sala=CODE).
// The server (supabase/arena_online.sql) keeps the clock and the score; this
// screen polls the room once per second and draws the same questions for both.

import { h } from '../ui/dom.js';
import { gameScreen } from '../ui/screen.js';
import { loadExtras, vibrate } from '../ui/game-ui.js';
import { toast } from '../ui/toast.js';
import { sfx } from '../audio/audio.js';
import { Starfield } from './starfield.js';
import { seededShuffle } from './arena.js';
import { addCoins, addTrophies, track } from '../game/economy.js';
import { power } from '../game/meta.js';
import { roomsOn, createRoom, joinRoom, roomState, sendAnswer, leaveRoom, roomError, cleanRoom, ROOM_RULE } from '../cloud/rooms.js';

const GAME_URL = 'https://yotucroni95-droid.github.io/genesis/';
const LAST_KEY = 'genesis.lastRoom';
const POLL_MS = 1000;

function rememberRoom(code) { try { localStorage.setItem(LAST_KEY, JSON.stringify({ code, at: Date.now() })); } catch { /* storage blocked */ } }
function lastRoom() {
  try { const r = JSON.parse(localStorage.getItem(LAST_KEY) || 'null'); return r && Date.now() - r.at < 10 * 60 * 1000 ? r.code : ''; } catch { return ''; }
}
function forgetRoom() { try { localStorage.removeItem(LAST_KEY); } catch { /* storage blocked */ } }

export function createOnlineScene(game) {
  const stars = new Starfield(140);
  let alive = false;
  let pollTimer = 0;
  let tickTimer = 0;
  let room = null; // last state from the server
  let offset = 0; // server clock - local clock (ms)
  let leave = () => {};

  const stop = () => { clearTimeout(pollTimer); clearInterval(tickTimer); pollTimer = 0; tickTimer = 0; };

  return {
    async enter(params, ui) {
      alive = true;
      room = null;
      game.extras = game.extras || await loadExtras(game.assets);
      const save = game.save;
      const nick = save.state.nick || 'jogador';
      const area = h('div', { class: 'arena online' });
      ui.appendChild(gameScreen(game, 'Arena online 🌐', area, { back: 'arena' }));

      const serverNow = () => Date.now() + offset;
      const setState = (s, sentAt) => {
        const rtt = Date.now() - sentAt;
        const est = Date.parse(s.now) - (Date.now() - rtt / 2);
        offset = room ? offset * 0.7 + est * 0.3 : est; // smooth the clock a little
        room = s;
      };

      // ---------- menu ----------
      const menu = (msg = '') => {
        stop();
        room = null;
        view = '';
        if (!roomsOn()) {
          area.replaceChildren(h('div', { class: 'quiz__result' }, h('h2', { class: 'quiz__q', text: 'Arena online indisponível' }), h('p', { class: 'screen__note', text: 'O servidor do jogo não está configurado.' })));
          return;
        }
        const input = h('input', { class: 'field__input online__code', maxlength: '7', placeholder: 'ABC123', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', 'aria-label': 'Código da sala' });
        input.addEventListener('input', () => { input.value = cleanRoom(input.value); });
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') enterRoom(input.value); });
        const back = lastRoom();
        area.replaceChildren(h('div', { class: 'quiz__result online__menu' },
          h('h2', { class: 'quiz__q', text: 'Desafie amigos ao vivo!' }),
          h('p', { class: 'screen__note', text: 'Todos respondem as mesmas 10 perguntas ao mesmo tempo. Quem acertar mais rápido ganha mais pontos. No 2x2, os pontos da dupla somam.' }),
          msg ? h('p', { class: 'online__msg', text: msg }) : null,
          h('div', { class: 'online__row' },
            h('button', { class: 'btn btn--play', onClick: () => newRoom('1x1') }, h('b', { text: 'SALA 1x1' })),
            h('button', { class: 'btn btn--play', onClick: () => newRoom('2x2') }, h('b', { text: 'SALA 2x2' })),
          ),
          h('div', { class: 'online__row' },
            h('span', { class: 'online__or', text: 'ou entre com o código' }),
            input,
            h('button', { class: 'btn', text: 'Entrar', onClick: () => enterRoom(input.value) }),
          ),
          back ? h('button', { class: 'btn btn--ghost btn--small', text: `Voltar para a sala ${back}`, onClick: () => enterRoom(back) }) : null,
        ));
      };

      const busy = (text) => area.replaceChildren(h('div', { class: 'quiz__result' }, h('p', { class: 'screen__note', text })));

      let lastMode = '1x1';
      async function newRoom(mode = lastMode) {
        lastMode = mode;
        busy('Criando a sala…');
        const t = Date.now();
        try { setState(await createRoom(nick, save.state.avatarId, mode), t); } catch (err) { if (alive) menu(roomError(err)); return; }
        rememberRoom(room.code);
        sfx('click');
        follow();
      }
      async function enterRoom(raw) {
        const code = cleanRoom(raw);
        if (!ROOM_RULE.test(code)) { menu('O código da sala tem 6 letras e números.'); return; }
        busy('Entrando na sala…');
        const t = Date.now();
        try { setState(await joinRoom(code, nick, save.state.avatarId), t); } catch (err) { if (alive) menu(roomError(err)); return; }
        rememberRoom(room.code);
        sfx('click');
        follow();
      }

      // ---------- polling ----------
      let fails = 0;
      const poll = async () => {
        if (!alive || !room) return;
        const t = Date.now();
        try {
          setState(await roomState(room.code), t);
          fails = 0;
        } catch (err) {
          fails += 1;
          if (/nao existe|nao esta/.test(String(err.message))) { forgetRoom(); menu(roomError(err)); return; }
          if (fails === 3) toast('Conexão instável… tentando de novo');
        }
        if (!alive || !room) return;
        draw();
        if (room.status !== 'finished') pollTimer = setTimeout(poll, document.hidden ? POLL_MS * 3 : POLL_MS);
      };
      const follow = () => {
        stop();
        draw();
        pollTimer = setTimeout(poll, POLL_MS);
        tickTimer = setInterval(() => { if (room && room.status === 'playing') draw(); }, 150);
      };

      // ---------- screens ----------
      let view = ''; // which screen is on: waiting | count | q<N> | wait-end | end
      const meP = () => room.players.find((p) => p.seat === room.me);
      const foeP = () => room.players.find((p) => p.seat !== room.me);
      const duo = () => room.max > 2;
      const myTeam = () => (meP() || { team: 0 }).team;
      const foes = () => room.players.filter((p) => p.team !== myTeam());
      const sum = (list) => list.reduce((n, p) => n + p.score, 0);
      const names = (list) => list.map((p) => `@${p.nick}`).join(' e ') || 'adversários';

      const draw = () => {
        if (!room) return;
        if (room.status === 'waiting') return waiting();
        if (room.status === 'finished') return finished();
        const el = serverNow() - Date.parse(room.starts_at);
        if (el < 0) return countdown(Math.ceil(-el / 1000));
        const q = Math.floor(el / room.q_ms);
        if (q >= room.questions) return waitEnd();
        return question(q, el - q * room.q_ms);
      };

      const waiting = () => {
        const key = `waiting${room.players.map((p) => p.seat).join('')}`;
        if (view === key) return;
        view = key;
        const missing = room.max - room.players.length;
        const link = `${GAME_URL}?sala=${room.code}`;
        const invite = async () => {
          const text = `Vem jogar comigo na Arena do Gênesis! Sala ${room.code}`;
          try {
            if (navigator.share) { await navigator.share({ title: 'Gênesis', text, url: link }); return; }
            await navigator.clipboard.writeText(`${text}: ${link}`);
            toast('Convite copiado! Cole no WhatsApp.');
          } catch { /* the player closed the share menu */ }
        };
        area.replaceChildren(h('div', { class: 'quiz__result' },
          h('p', { class: 'screen__note', text: 'Código da sala:' }),
          h('div', { class: 'online__big', text: room.code }),
          h('p', { class: 'screen__note', text: duo() ? 'Mande o código para 3 amigos. A partida começa quando os 4 entrarem.' : 'Mande o código ou o convite para um amigo. A partida começa quando ele entrar.' }),
          duo() ? h('div', { class: 'online__teams' }, ...[0, 1].map((t) => h('div', { class: `online__team${t === myTeam() ? ' is-me' : ''}` },
            h('small', { text: t === myTeam() ? 'Sua dupla' : 'Adversários' }),
            ...room.players.filter((p) => p.team === t).map((p) => h('b', { text: p.seat === room.me ? 'Você' : `@${p.nick}` }))))) : null,
          h('p', { class: 'online__wait', text: missing > 1 ? `Esperando mais ${missing} jogadores…` : duo() ? 'Falta 1 jogador…' : 'Esperando o amigo…' }),
          h('div', { class: 'online__row' },
            h('button', { class: 'btn btn--share', text: '📲 Convidar', onClick: invite }),
            h('button', { class: 'btn btn--ghost', text: 'Cancelar', onClick: () => { leaveRoom(room.code); forgetRoom(); menu(); } }),
          ),
        ));
      };

      const versus = () => {
        if (duo()) {
          const team = (list, mine) => h('div', { class: `online__side${mine ? ' is-me' : ''}${list.length && list.every((p) => p.left) ? ' is-gone' : ''}` },
            h('small', { text: list.map((p) => (p.seat === room.me ? 'Você' : `@${p.nick}`) + (p.left ? ' (saiu)' : '')).join(' + ') || '…' }),
            h('b', { text: `${sum(list)}` }));
          return h('div', { class: 'online__vs' }, team(room.players.filter((p) => p.team === myTeam()), true), h('span', { class: 'online__x', text: 'VS' }), team(foes(), false));
        }
        const me = meP(); const foe = foeP();
        const side = (p, mine) => h('div', { class: `online__side${mine ? ' is-me' : ''}${p && p.left ? ' is-gone' : ''}` },
          h('small', { text: p ? `${mine ? 'Você' : '@' + p.nick}${p.left ? ' (saiu)' : ''}` : '…' }),
          h('b', { text: p ? `${p.score}` : '0' }));
        return h('div', { class: 'online__vs' }, side(me, true), h('span', { class: 'online__x', text: 'VS' }), side(foe, false));
      };

      const countdown = (n) => {
        const key = `count${n}`;
        if (view === key) return;
        view = key;
        sfx('click');
        area.replaceChildren(versus(), h('div', { class: 'quiz__result' }, h('p', { class: 'screen__note', text: duo() ? 'Todos entraram! Prepare-se…' : `@${(foeP() || {}).nick || 'amigo'} entrou! Prepare-se…` }), h('div', { class: 'online__big', text: `${n}` })));
      };

      // question view: built once per question, then only the timer/reveal changes
      let qv = null;
      const deckFor = () => seededShuffle(game.extras.arena, room.seed);
      let deck = null;
      let deckSeed = 0;
      const question = (q, inQ) => {
        if (deckSeed !== room.seed) { deck = deckFor(); deckSeed = room.seed; }
        const reveal = inQ >= room.answer_ms;
        if (view !== `q${q}`) {
          view = `q${q}`;
          const cur = deck[q % deck.length];
          const opts = seededShuffle(cur.options.map((text, k) => ({ text, ok: k === cur.answer })), room.seed + q * 7 + 1);
          qv = { q, cur, opts, picked: -1, shown: false, hud: h('div'), bar: h('div', { class: 'arena__timer' }, h('div', { class: 'arena__timefill' })), foe: h('p', { class: 'online__foe' }) };
          qv.buttons = opts.map((o, k) => h('button', { class: 'quiz__opt', onClick: () => pick(k) }, o.text));
          area.replaceChildren(qv.hud, qv.bar, h('div', { class: 'arena__box' },
            h('div', { class: 'quiz__count', text: `Pergunta ${q + 1} de ${room.questions}` }),
            h('h2', { class: 'quiz__q', text: cur.q }), h('div', { class: 'quiz__opts' }, ...qv.buttons), qv.foe));
        }
        qv.hud.replaceChildren(versus());
        const left = Math.max(0, room.answer_ms - inQ);
        qv.bar.firstChild.style.width = `${(left / room.answer_ms) * 100}%`;
        qv.bar.classList.toggle('is-low', left < 3000);
        const foe = foeP();
        const foeAns = foe && foe.answers ? foe.answers[String(q)] : undefined;
        if (reveal && !qv.shown) {
          qv.shown = true;
          qv.buttons.forEach((b) => { b.disabled = true; });
          qv.buttons[qv.opts.findIndex((o) => o.ok)].classList.add('is-right');
          if (qv.picked < 0) { sfx('wrong'); qv.foe.textContent = `Tempo esgotado! Resposta em ${qv.cur.ref}`; }
        }
        if (duo()) {
          const others = room.players.filter((p) => p.seat !== room.me);
          const mark = (p) => { const a = p.answers ? p.answers[String(q)] : undefined; return `${p.team === myTeam() ? '🤝' : ''}@${p.nick} ${p.left ? 'saiu' : a === true ? '✔' : a === false ? '✖' : reveal ? '—' : '…'}`; };
          qv.foe.textContent = `${reveal && qv.picked < 0 ? 'Você não respondeu. ' : ''}${others.map(mark).join(' · ')}`;
        } else if (reveal) {
          const foeText = foe && foe.left ? `@${foe.nick} saiu da partida.` : foeAns === true ? `@${foe.nick} acertou ✔` : foeAns === false ? `@${foe.nick} errou ✖` : `@${(foe || {}).nick || 'amigo'} não respondeu`;
          qv.foe.textContent = `${qv.picked < 0 ? 'Você não respondeu. ' : ''}${foeText}`;
        } else if (qv.picked >= 0) {
          qv.foe.textContent = foeAns === undefined ? `Esperando @${(foe || {}).nick || 'amigo'}…` : `@${foe.nick} já respondeu!`;
        }
      };

      function pick(k) {
        if (!qv || qv.picked >= 0 || qv.shown) return;
        qv.picked = k;
        const ok = qv.opts[k].ok;
        qv.buttons.forEach((b) => { b.disabled = true; });
        qv.buttons[k].classList.add(ok ? 'is-right' : 'is-wrong');
        sfx(ok ? 'correct' : 'wrong');
        if (!ok) vibrate(120);
        const code = room.code; const q = qv.q; const t = Date.now();
        // the server takes only the first answer for each question; a retry is harmless
        const send = (tries) => sendAnswer(code, q, ok).then((s) => { if (alive && room && room.code === code) setState(s, t); })
          .catch(() => { if (tries > 0 && alive) setTimeout(() => send(tries - 1), 700); });
        send(2);
      }

      const waitEnd = () => {
        if (view === 'wait-end') return;
        view = 'wait-end';
        area.replaceChildren(versus(), h('div', { class: 'quiz__result' }, h('p', { class: 'screen__note', text: 'Contando os pontos…' })));
      };

      const finished = () => {
        if (view === 'end') return;
        view = 'end';
        stop();
        forgetRoom();
        const me = meP(); const foe = foeP();
        if (!foe || !me) { menu('A sala foi fechada.'); return; }
        const answered = Object.keys(me.answers || {}).length;
        const ours = room.players.filter((p) => p.team === myTeam());
        const theirs = foes();
        const goneUs = ours.every((p) => p.left); const goneThem = theirs.every((p) => p.left);
        const wo = goneThem && !goneUs; // the other side abandoned
        const usPts = sum(ours); const themPts = sum(theirs);
        const result = goneUs && !goneThem ? 'lose' : wo || usPts > themPts ? 'win' : usPts === themPts ? 'draw' : 'lose';
        // rewards only once per room, and only if the match was really played
        const key = `${room.code}.${room.seed}`;
        const done = save.state.onlineRooms || [];
        let coins = 0; let trophies = 0;
        if (!done.includes(key) && answered > 0) {
          const day = new Date().toLocaleDateString('sv-SE');
          const played = save.state.arenaDay && save.state.arenaDay.date === day ? save.state.arenaDay.n : 0;
          const tired = played < 5 ? 1 : played < 10 ? 0.4 : 0.1;
          coins = Math.floor((me.score / 30 * (1 + power(save, 'arenaCoins') / 100) + (result === 'win' ? 20 : result === 'draw' ? 8 : 0)) * tired);
          trophies = Math.round((result === 'win' ? 8 : result === 'draw' ? 3 : 0) * (1 + power(save, 'trophies') / 100) * tired);
          save.update((s) => { s.onlineRooms = done.concat(key).slice(-30); s.arenaDay = { date: day, n: played + 1 }; });
          if (coins) addCoins(save, coins);
          if (trophies) addTrophies(save, trophies);
          track(save, 'arenaPlay', 1);
          track(save, 'correct', me.correct);
          if (result === 'win') track(save, 'onlineWin', 1);
        }
        sfx(result === 'win' ? 'fanfare' : 'coin');
        const them = duo() ? names(theirs) : `@${foe.nick}`;
        const title = result === 'win' ? (wo ? `${them} ${duo() ? 'saíram' : 'saiu'}. ${duo() ? 'SUA DUPLA VENCEU' : 'VOCÊ VENCEU'}! 🏆` : duo() ? 'SUA DUPLA VENCEU! 🏆' : `VOCÊ VENCEU ${them}! 🏆`) : result === 'draw' ? 'EMPATE!' : `${them} ${duo() ? 'ganharam' : 'ganhou'} desta vez…`;
        area.replaceChildren(h('div', { class: 'quiz__result online__end' },
          h('h2', { class: 'quiz__q', text: title }),
          h('p', { class: 'screen__note', text: duo()
            ? `Sua dupla: ${usPts} pts · ${names(theirs)}: ${themPts} pts — você fez ${me.score} pts (${me.correct} acertos)`
            : `Você: ${me.score} pts (${me.correct} acertos) · @${foe.nick}: ${foe.score} pts (${foe.correct} acertos)` }),
          coins || trophies ? h('div', { class: 'rewards online__rewards' },
            coins ? h('div', { class: 'reward' }, h('span', { class: 'chip__emoji', text: '🪙' }), h('span', { text: `+${coins} talentos` })) : null,
            trophies ? h('div', { class: 'reward' }, h('span', { class: 'chip__emoji', text: '🏆' }), h('span', { text: `+${trophies} troféus` })) : null) : null,
          h('div', { class: 'online__row' },
            h('button', { class: 'btn btn--play', onClick: () => newRoom() }, h('b', { text: 'NOVA SALA' })),
            h('button', { class: 'btn btn--ghost', text: 'Arena', onClick: () => game.scenes.go('arena') }),
          ),
        ));
      };

      if (params && params.join) enterRoom(params.join); else menu();
      leave = () => { if (room && room.status !== 'finished') leaveRoom(room.code); };
    },
    exit() {
      alive = false;
      stop();
      leave();
      leave = () => {};
    },
    update(dt) { stars.update(dt * 3); },
    render(ctx, d) { stars.render(ctx, d.width, d.height); },
  };
}
