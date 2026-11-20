// Fuga da Tentação: cooperative escape for 1–5 players. Everyone is an ally;
// the enemies belong to the game (Threat Director). Do the tasks together,
// open the portal and get out. Caught = answer a temptation question in time.
// Server (supabase/fuga.sql) decides tasks, captures, eliminations and results;
// Realtime only carries positions and the host's enemy snapshots.

import { h } from '../ui/dom.js';
import { gameScreen } from '../ui/screen.js';
import { iconButton } from '../ui/icon-button.js';
import { toast } from '../ui/toast.js';
import { sfx } from '../audio/audio.js';
import { Starfield } from './starfield.js';
import { Input } from '../input/input.js';
import { Camera } from '../world/camera.js';
import { Player } from '../world/player.js';
import { getChallenge } from '../challenges/index.js';
import { addCoins, addSeasonPoints } from '../game/economy.js';
import { FugaMap, T } from '../fuga/map.js';
import { Director, STAGES, stageOf, KINDS } from '../fuga/director.js';
import { loadPool, roundTasks } from '../fuga/tasks.js';
import { fugaOn, online, soloRoom, fugaError } from '../cloud/fuga.js';
import { Channel } from '../cloud/realtime.js';

const DIFFS = ['Fácil', 'Médio', 'Difícil'];
const LAST_KEY = 'genesis.fugaRoom';
const remember = (code) => { try { if (code) localStorage.setItem(LAST_KEY, JSON.stringify({ code, at: Date.now() })); else localStorage.removeItem(LAST_KEY); } catch { /* blocked */ } };
const lastRoom = () => { try { const r = JSON.parse(localStorage.getItem(LAST_KEY) || 'null'); return r && Date.now() - r.at < 15 * 60e3 ? r.code : ''; } catch { return ''; } };

export function createFugaScene(game) {
  const stars = new Starfield(90);
  const camera = new Camera();
  let S = null; // everything of the current visit

  const fresh = () => ({
    alive: true, phase: 'menu', api: null, code: '', room: null, map: null, baked: null, director: null, tasks: [], pool: null,
    me: null, remotes: new Map(), channel: null, input: null, ui: null, hud: {}, overlay: null, capture: null, poll: 0, sendT: 0, dirT: 0,
    startAt: 0, explored: null, seen: new Set(), noises: [], caughtAt: new Map(), plate: null, plateT: 0, spect: 0, ended: false, busy: false,
    lastSent: '', diff: 1, firstFrame: true, playersAtStart: 1, escaping: false, ending: false,
  });

  // ---------- network helpers ----------
  const call = async (fn, ...args) => {
    try { const st = await S.api[fn](S.code, ...args); if (st) onState(st); return st; } catch (err) { if (S.phase !== 'play') toast(fugaError(err)); else S.hud.net && (S.hud.net.hidden = false); return null; }
  };
  const mySeat = () => (S.room ? S.room.me : 0);
  const meInfo = () => (S.room && S.room.players.find((p) => p.seat === mySeat())) || {};
  const others = () => (S.room ? S.room.players.filter((p) => p.seat !== mySeat()) : []);

  function onState(st) {
    const prev = S.room;
    S.room = st;
    if (S.hud.net) S.hud.net.hidden = true;
    if (S.phase === 'wait') { if (st.status === 'playing') beginRound(); else paintWait(); return; }
    if (S.phase !== 'play') return;
    for (const n of st.done) { const t = S.tasks[n]; if (t && !t.done) { t.done = true; if (prev) { sfx('correct'); S.noises.push({ x: t.x, y: t.y }); } } }
    const all = st.done.length >= st.tasksTotal;
    if (all && !S.map.exitOpen) { S.map.exitOpen = true; S.director && S.director.fields.clear(); toast('✨ Todas as tarefas feitas! O Portal da Promessa se abriu: corram para a saída (leste)!', { ms: 5000 }); sfx('fanfare'); }
    const me = meInfo();
    if (st.challenge && !S.capture) openCapture(st.challenge);
    if (!st.challenge && S.capture && !S.capture.answering) closeCapture();
    if (prev && (prev.players.find((p) => p.seat === me.seat) || {}).alive && !me.alive) { toast('Você foi eliminado nesta rodada. Agora assista e torça pela equipe!', { ms: 4500 }); closeTask(); }
    if (st.status === 'won' || st.status === 'lost') endRound();
    paintHud();
  }

  // ---------- menu / waiting room ----------
  function screen(title, body) {
    S.ui.replaceChildren(gameScreen(game, title, body, { back: 'lobby' }));
  }

  function menu() {
    S.phase = 'menu';
    const save = game.save.state;
    const diffRow = h('div', { class: 'fuga__diffs', role: 'radiogroup', 'aria-label': 'Dificuldade' },
      ...DIFFS.map((d, i) => h('button', { class: `btn btn--small${i === S.diff ? '' : ' btn--ghost'}`, role: 'radio', 'aria-checked': String(i === S.diff), text: d, onClick: () => { S.diff = i; menu(); } })));
    const codeIn = h('input', { class: 'field__input', placeholder: 'Código da sala', maxlength: '6', autocomplete: 'off', 'aria-label': 'Código da sala' });
    const go = async (fn) => { if (S.busy) return; S.busy = true; try { await fn(); } finally { S.busy = false; } };
    const nick = save.nick || 'jogador';
    const back = lastRoom();
    screen('Fuga da Tentação 🏃', h('div', { class: 'fuga__menu' },
      h('p', { class: 'screen__note', text: 'Cooperativo de 1 a 5 jogadores. Todos são aliados: façam as tarefas bíblicas, abram o Portal da Promessa e fujam juntos. Se a serpente pegar você, responda a pergunta a tempo para escapar!' }),
      h('div', { class: 'fuga__row' }, h('b', { text: 'Dificuldade:' }), diffRow, h('small', { class: 'screen__note', text: `Tempo na captura: ${[12, 9, 6][S.diff]} s` })),
      back && fugaOn() ? h('button', { class: 'btn btn--play', text: `↩ Voltar à partida ${back}`, onClick: () => go(() => enterRoom(() => online.join(back, nick, save.avatarId))) }) : null,
      h('div', { class: 'fuga__btns' },
        h('button', { class: 'btn btn--play', onClick: () => go(soloStart) }, h('b', { text: '🌱 TREINO' }), h('small', { text: 'Sozinho, sem internet' })),
        fugaOn() ? h('button', { class: 'btn btn--online', onClick: () => go(() => enterRoom(() => online.quick(nick, save.avatarId, S.diff))) }, h('b', { text: '🌐 SALA PÚBLICA' }), h('small', { text: 'Junte-se a quem está esperando' })) : null,
        fugaOn() ? h('button', { class: 'btn', onClick: () => go(() => enterRoom(() => online.create(nick, save.avatarId, false, S.diff))) }, h('b', { text: '🔒 SALA PRIVADA' }), h('small', { text: 'Convide com o código' })) : null),
      fugaOn() ? h('div', { class: 'online__row' }, codeIn, h('button', { class: 'btn', text: 'Entrar', onClick: () => go(() => enterRoom(() => online.join(codeIn.value, nick, save.avatarId))) })) : null,
    ));
  }

  async function enterRoom(make, onFail) {
    let st;
    try { st = await make(); } catch (err) { if (onFail) { onFail(err); return; } toast(fugaError(err)); return; }
    S.api = online;
    S.code = st.code;
    S.diff = st.difficulty;
    remember(st.code);
    openChannel();
    S.phase = 'wait';
    onState(st);
  }

  async function soloStart() {
    const qs = (await game.assets.loadJSON('fuga.json')).tempt;
    S.api = soloRoom(game.save.state.nick || 'você', game.save.state.avatarId, S.diff, qs);
    S.code = 'TREINO';
    S.phase = 'wait';
    onState(await S.api.state());
    await call('start');
  }

  function paintWait() {
    const r = S.room;
    const host = r.players.filter((p) => !p.left)[0];
    const iAmHost = host && host.seat === r.me;
    const portrait = (id) => game.assets.url(game.assets.entry(`portrait.${id}`) ? `portrait.${id}` : 'portrait.peregrino');
    screen('Fuga · Sala', h('div', { class: 'fuga__menu' },
      h('div', { class: 'friends__me' }, h('span', { text: r.public ? 'Sala pública' : 'Código da sala:' }), h('b', { class: 'friends__tag', text: r.code }),
        h('button', { class: 'btn btn--small btn--ghost', text: 'Copiar', onClick: () => navigator.clipboard && navigator.clipboard.writeText(r.code).then(() => toast('Código copiado!')).catch(() => {}) })),
      h('small', { class: 'screen__note', text: `${DIFFS[r.difficulty]} · ${r.players.filter((p) => !p.left).length}/5 jogadores` }),
      h('ul', { class: 'frows' }, ...r.players.filter((p) => !p.left).map((p) => h('li', { class: 'frow is-online' },
        h('img', { class: 'pixel frow__face', src: portrait(p.avatar), alt: '' }),
        h('span', { class: 'frow__name', text: `@${p.nick}${p.seat === r.me ? ' (você)' : ''}` }),
        h('small', { class: 'frow__status', text: p.seat === host.seat ? 'anfitrião' : 'pronto' })))),
      iAmHost ? h('button', { class: 'btn btn--play', text: '▶ Começar', onClick: () => call('start') })
        : h('p', { class: 'screen__note', text: 'Esperando o anfitrião começar…' }),
      h('button', { class: 'btn btn--ghost', text: 'Sair da sala', onClick: () => { S.api.leave(S.code); remember(''); closeChannel(); menu(); } }),
    ));
  }

  // ---------- realtime ----------
  function openChannel() {
    if (S.channel || !S.code || S.api.solo) return;
    const ch = new Channel(`fuga-${S.code}`, { key: String(Math.random()).slice(2, 10) });
    ch.on('pos', (m) => onPos(m));
    ch.on('dir', (m) => { if (S.director && !isHost() && m.s === hostSeat()) S.director.apply(m.d); S.lastDir = { s: m.s, at: performance.now() }; });
    ch.on('noise', (m) => S.noises.push(m));
    ch.on('poke', () => { S.poll = 0; });
    ch.onStatus = (s) => { if (S.hud.net) S.hud.net.hidden = s === 'on'; };
    S.channel = ch;
  }
  function closeChannel() { if (S.channel) S.channel.close(); S.channel = null; }
  const poke = () => S.channel && S.channel.broadcast('poke', {});

  function onPos(m) {
    if (!S.map || m.s === mySeat()) return;
    let r = S.remotes.get(m.s);
    if (!r) {
      const info = (S.room.players.find((p) => p.seat === m.s)) || {};
      const id = game.assets.entry(`sheet.${info.avatar}`) ? info.avatar : 'peregrino';
      r = { seat: m.s, p: new Player(game.assets, id, m.x, m.y), nick: info.nick || '' };
      game.assets.ensure(`sheet.${id}`).then(() => r.p.setCharacter(id)).catch(() => {});
      S.remotes.set(m.s, r);
    }
    Object.assign(r, { tx: m.x, ty: m.y, hidden: m.h, plate: m.pl, at: performance.now() });
    r.p.dir = m.d; r.p.moving = Boolean(m.m);
  }

  // host = lowest seat that is connected (me, or someone heard from in the last 3 s)
  function hostSeat() {
    const now = performance.now();
    const seats = [mySeat(), ...[...S.remotes.values()].filter((r) => now - r.at < 3000).map((r) => r.seat)];
    const live = (S.room ? S.room.players : []).filter((p) => !p.left && seats.includes(p.seat)).map((p) => p.seat);
    return live.length ? Math.min(...live) : mySeat();
  }
  const isHost = () => S.api.solo || hostSeat() === mySeat();

  // ---------- round ----------
  async function beginRound() {
    S.phase = 'loading';
    S.ui.replaceChildren(h('div', { class: 'fuga__loading' }, h('p', { class: 'screen__note', text: 'Preparando o Jardim da Resistência…' })));
    S.pool = S.pool || await loadPool(game.assets);
    if (!S.alive) return;
    const r = S.room;
    S.map = new FugaMap();
    S.baked = S.map.bake();
    S.playersAtStart = r.players.filter((p) => !p.left).length;
    S.tasks = roundTasks(S.map, r.seed, r.tasksTotal, S.pool, S.playersAtStart);
    S.director = new Director(S.map, r.seed, { difficulty: r.difficulty, kind: 'serpente' });
    S.explored = new Uint8Array(S.map.cols * S.map.rows);
    S.startAt = performance.now() + (r.startsIn || 0);
    const spots = S.map.spots(S.map.spawnRoom, 3);
    const at = spots[(r.me * 7 + 3) % spots.length];
    const id = game.save.state.avatarId || 'peregrino';
    await game.assets.ensure(`sheet.${id}`).catch(() => {});
    S.me = new Player(game.assets, id, (at.x + 0.5) * 16, (at.y + 1) * 16 - 2);
    S.me.speed = 70;
    buildHud();
    S.phase = 'play';
    S.firstFrame = true;
    toast(`Façam ${r.tasksTotal} tarefas e fujam pelo portal! Moitas escondem você da serpente.`, { ms: 4500 });
    onState(r);
  }

  function buildHud() {
    const ui = S.ui;
    ui.replaceChildren();
    S.hud.stage = h('div', { class: 'chip fuga__stage' });
    S.hud.tasks = h('div', { class: 'chip' });
    S.hud.time = h('div', { class: 'chip' });
    S.hud.team = h('div', { class: 'chip' });
    S.hud.net = h('div', { class: 'chip fuga__net', hidden: true, text: '📶 reconectando…' });
    ui.appendChild(h('div', { class: 'hud fuga__hud' },
      iconButton(game.assets, 'icon.voltar', 'Sair da partida', () => { if (confirm('Sair da partida? Você não poderá ajudar a equipe.')) leave(); }, '←'),
      S.hud.stage, S.hud.tasks, S.hud.time, S.hud.team, S.hud.net));
    S.hud.action = h('button', { class: 'btn enter__btn fuga__action', hidden: true, onClick: act });
    S.hud.spect = h('div', { class: 'fuga__spect', hidden: true },
      h('button', { class: 'btn btn--small', 'aria-label': 'Jogador anterior', text: '◀', onClick: () => { S.spect--; } }),
      h('span', {}), h('button', { class: 'btn btn--small', 'aria-label': 'Próximo jogador', text: '▶', onClick: () => { S.spect++; } }));
    ui.appendChild(S.hud.action);
    ui.appendChild(S.hud.spect);
    S.input = new Input(ui, game.assets);
    S.onKey = (e) => { if ((e.code === 'KeyE' || e.code === 'Space') && !S.overlay && !S.capture) { e.preventDefault(); act(); } };
    window.addEventListener('keydown', S.onKey);
  }

  function paintHud() {
    if (S.phase !== 'play' || !S.room) return;
    const r = S.room;
    const st = stage();
    S.hud.stage.textContent = `${st}. ${STAGES[st - 1]}`;
    S.hud.stage.className = `chip fuga__stage fuga__stage--${st}`;
    S.hud.tasks.textContent = `📜 ${r.done.length}/${r.tasksTotal}`;
    const alive = r.players.filter((p) => p.alive && !p.left).length;
    S.hud.team.textContent = `👥 ${alive}/${S.playersAtStart}`;
  }

  const elapsed = () => Math.max(0, (performance.now() - S.startAt) / 1000);
  function stage() {
    const r = S.room;
    return stageOf({ t: elapsed(), limit: r.limit, done: r.done.length, total: r.tasksTotal,
      alive: r.players.filter((p) => p.alive && !p.left).length, players: Math.max(1, S.playersAtStart) });
  }

  // ---------- tasks ----------
  function nearTask() {
    if (!S.me) return null;
    let best = null, bd = 22;
    for (const t of S.tasks) {
      if (t.done) continue;
      const d = Math.hypot(t.x - S.me.x, t.y - (S.me.y - 6));
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  function act() {
    const me = meInfo();
    if (!me.alive || me.escaped || S.overlay || S.capture) return;
    const t = nearTask();
    if (!t) return;
    if (t.kind === 'colher') { toast('Recolha os 3 fragmentos brilhantes desta área ✨'); return; }
    if (t.kind === 'ativar') { toast('Fique sobre uma pedra de luz enquanto um aliado segura a outra!'); return; }
    openTask(t);
  }

  function openTask(t) {
    sfx('enter');
    const area = h('div', { class: 'challenge__area' });
    S.overlay = h('div', { class: 'fuga__overlay' },
      h('header', { class: 'screen__head' },
        h('button', { class: 'btn btn--small btn--ghost', text: '✕ Sair', onClick: closeTask }),
        h('h1', { text: t.name }), h('small', { class: 'screen__note', text: 'Cuidado: a serpente continua andando!' })),
      area);
    S.ui.appendChild(S.overlay);
    const mine = S.overlay;
    getChallenge(t.type).start(t.config || {}, { root: area, assets: game.assets, sfx, avatar: game.save.state.avatarId }).then((res) => {
      if (S.overlay !== mine) return; // closed (caught or left)
      closeTask();
      if (res && res.success) finishTask(t); else toast('Quase! Tente a tarefa de novo.');
    });
  }
  function closeTask() { if (S.overlay) { S.overlay.remove(); S.overlay = null; } }

  async function finishTask(t) {
    if (t.done || t.sending) return;
    t.sending = true;
    const noise = { x: t.x, y: t.y };
    S.noises.push(noise);
    if (S.channel) S.channel.broadcast('noise', noise);
    const st = await call('task', t.n);
    t.sending = false;
    if (st && st.done.includes(t.n)) { toast(`✓ ${t.name}`); poke(); } else if (st) toast('Espere um instante entre uma tarefa e outra.');
  }

  function updateTasks(dt) {
    const me = meInfo();
    if (!me.alive || me.escaped) { S.plate = null; return; }
    const alive = S.room.players.filter((p) => p.alive && !p.escaped && !p.left).length;
    S.plate = null;
    for (const t of S.tasks) {
      if (t.done) continue;
      if (t.kind === 'colher' && Math.hypot(t.x - S.me.x, t.y - S.me.y) < 120) {
        for (const b of t.bits) if (!b.got && Math.hypot(b.x - S.me.x, b.y - S.me.y + 4) < 12) { b.got = true; sfx('scroll'); }
        if (t.bits.every((b) => b.got)) finishTask(t);
      }
      if (t.kind === 'ativar') {
        t.plates.forEach((p, k) => { if (Math.hypot(p.x - S.me.x, p.y - S.me.y + 4) < 11) S.plate = [t.n, k]; });
        if (S.plate && S.plate[0] === t.n) {
          const partner = [...S.remotes.values()].some((r) => r.plate && r.plate[0] === t.n && r.plate[1] !== S.plate[1] && performance.now() - r.at < 1500);
          S.plateT = partner || alive <= 1 ? S.plateT + dt : 0; // alone in the round: one plate is enough
          if (S.plateT > 1.2) { S.plateT = 0; finishTask(t); }
        }
      }
    }
    if (!S.plate) S.plateT = 0;
  }

  // ---------- capture ----------
  function openCapture(ch) {
    closeTask();
    const bar = h('div', { class: 'bar__fill' });
    const btns = ch.options.map((o, i) => h('button', { class: 'quiz__opt', text: o, onClick: () => answer(i) }));
    S.capture = { el: h('div', { class: 'fuga__overlay fuga__capture', role: 'alertdialog', 'aria-label': 'Capturado pela tentação' },
      h('h2', { class: 'quiz__q', text: '🐍 A tentação alcançou você!' }),
      h('p', { class: 'fuga__question', text: ch.q }),
      h('div', { class: 'bar' }, bar),
      h('div', { class: 'quiz__opts' }, ...btns)), until: performance.now() + ch.ms, total: ch.ms, bar, btns };
    S.ui.appendChild(S.capture.el);
    sfx('wrong');
  }
  async function answer(i) {
    const c = S.capture;
    if (!c || c.answering) return;
    c.answering = true;
    c.btns.forEach((b) => { b.disabled = true; });
    let st = null;
    try { st = await S.api.answer(S.code, i); } catch (err) { toast(fugaError(err)); }
    if (st) {
      if (st.ok) { sfx('resist'); toast('🛡️ Você resistiu! Proteção por 6 segundos. Corra!'); } else { toast(`Resposta certa: ${st.right || ''} (${st.verse || ''})`, { ms: 4500 }); }
      c.answering = false;
      closeCapture();
      onState(st);
      poke();
    } else c.answering = false;
  }
  function closeCapture() { if (S.capture) { S.capture.el.remove(); S.capture = null; } }

  // ---------- end ----------
  function endRound() {
    if (S.ended) return;
    S.ended = true;
    closeTask(); closeCapture();
    const r = S.room;
    const me = meInfo();
    const won = r.status === 'won';
    // rewards once per round; fewer after many rounds in a day (no farming)
    const save = game.save;
    const key = `${r.code}.${r.seed}`;
    const done = save.state.fugaRooms || [];
    let coins = 0, pts = 0;
    if (!done.includes(key) && (me.tasks > 0 || won)) {
      const day = new Date().toLocaleDateString('sv-SE');
      const played = save.state.fugaDay && save.state.fugaDay.date === day ? save.state.fugaDay.n : 0;
      const tired = played < 5 ? 1 : played < 10 ? 0.4 : 0.1;
      const solo = Boolean(S.api.solo);
      coins = Math.floor(((won ? 20 : 0) + me.tasks * (won ? 4 : 2)) * tired * (solo ? 0.5 : 1));
      pts = won ? Math.round((solo ? 4 : 8) * tired) : 0;
      save.update((s) => { s.fugaRooms = done.concat(key).slice(-30); s.fugaDay = { date: day, n: played + 1 }; });
      if (coins) addCoins(save, coins);
      if (pts) addSeasonPoints(save, pts);
    }
    remember('');
    setTimeout(() => {
      if (!S.alive) return;
      S.phase = 'end';
      teardownPlay();
      screen(won ? 'Vitória! 🎉' : 'Fim da rodada', h('div', { class: 'fuga__menu quiz__result' },
        h('h2', { class: 'quiz__q', text: won ? 'A equipe resistiu à tentação e escapou!' : 'Desta vez a tentação venceu…' }),
        h('p', { class: 'screen__note', text: won ? '"Resistam ao diabo, e ele fugirá de vocês." (Tiago 4:7)' : '"Deus é fiel: ele dará também a saída." (1 Coríntios 10:13) Tentem de novo!' }),
        h('ul', { class: 'frows' }, ...r.players.map((p) => h('li', { class: 'frow' },
          h('span', { class: 'frow__name', text: `@${p.nick}` }),
          h('small', { class: 'frow__status', text: `${p.escaped ? '🏃 escapou' : p.alive ? '⏳' : '✝ eliminado'} · ${p.tasks} tarefas` })))),
        coins || pts ? h('div', { class: 'rewards' },
          coins ? h('div', { class: 'reward' }, h('span', { class: 'chip__emoji', text: '🪙' }), h('span', { text: `+${coins} talentos` })) : null,
          pts ? h('div', { class: 'reward' }, h('span', { class: 'chip__emoji', text: '⭐' }), h('span', { text: `+${pts} pontos da temporada` })) : null) : null,
        h('button', { class: 'btn btn--play', text: 'Jogar de novo', onClick: () => { const d = S.diff; teardown(); S = fresh(); S.ui = uiRoot; S.diff = d; menu(); } }),
      ));
    }, 1600);
  }

  function leave() {
    if (S.api && S.code) S.api.leave(S.code);
    remember('');
    game.scenes.go('lobby');
  }

  function teardownPlay() {
    if (S.input) S.input.destroy();
    S.input = null;
    window.removeEventListener('keydown', S.onKey);
    S.map = null;
  }
  function teardown() { teardownPlay(); closeChannel(); }

  // ---------- frame ----------
  function update(dt) {
    if (S.phase === 'wait') { S.poll -= dt; if (S.poll <= 0) { S.poll = 1.5; call('state'); } return; }
    if (S.phase !== 'play' || !S.map) return;
    const r = S.room;
    const me = meInfo();
    S.poll -= dt;
    if (S.poll <= 0) { S.poll = S.api.solo ? 0.25 : 1.2; call('state'); }
    const started = performance.now() >= S.startAt;
    const free = started && me.alive && !me.escaped && !me.caught && !S.overlay && !S.capture;
    S.me.update(dt, free ? S.input.vector() : { x: 0, y: 0 }, S.map);
    const hidden = S.map.isBushAt(S.me.x, S.me.y - 4);
    // explore around me (minimap)
    const cx = Math.floor(S.me.x / 16), cy = Math.floor(S.me.y / 16);
    for (let y = cy - 6; y <= cy + 6; y++) for (let x = cx - 7; x <= cx + 7; x++) if (x >= 0 && y >= 0 && x < S.map.cols && y < S.map.rows) S.explored[S.map.idx(x, y)] = 1;
    if (free) updateTasks(dt);
    if (free && S.map.exitOpen && S.map.inExit(S.me.x, S.me.y) && !S.escaping) {
      S.escaping = true;
      call('escape').then((st) => { S.escaping = false; if (st && meInfo().escaped) { toast('🏃 Você escapou! Torça pelos outros.'); sfx('fanfare'); poke(); } });
    }
    // remotes glide toward the last position heard
    for (const rm of S.remotes.values()) {
      const k = Math.min(1, dt * 10);
      rm.p.x += (rm.tx - rm.p.x) * k; rm.p.y += (rm.ty - rm.p.y) * k;
      if (rm.p.moving) rm.p.animTime += dt; else rm.p.animTime = 0;
    }
    // send my position: 5/s while moving, every 2 s when still (saves Realtime quota)
    S.sendT -= dt;
    const pkt = { s: mySeat(), x: Math.round(S.me.x), y: Math.round(S.me.y), d: S.me.dir, m: S.me.moving ? 1 : 0, h: hidden ? 1 : 0, pl: S.plate };
    const sig = JSON.stringify(pkt);
    if (S.channel && S.sendT <= 0 && (sig !== S.lastSent || S.sendT < -2)) { S.channel.broadcast('pos', pkt); S.lastSent = sig; S.sendT = 0.2; }
    // enemies
    if (started) {
      if (isHost()) {
        const players = r.players.filter((p) => !p.left).map((p) => {
          if (p.seat === mySeat()) return { seat: p.seat, x: S.me.x, y: S.me.y, alive: p.alive, escaped: p.escaped, protected: p.protected, busy: p.caught, hidden };
          const rm = S.remotes.get(p.seat);
          return rm ? { seat: p.seat, x: rm.p.x, y: rm.p.y, alive: p.alive && performance.now() - rm.at < 5000, escaped: p.escaped, protected: p.protected, busy: p.caught, hidden: rm.hidden } : { seat: p.seat, alive: false };
        });
        const events = S.director.update(dt, { players, stage: stage(), noises: S.noises });
        S.noises.length = 0;
        for (const ev of events) {
          const last = S.caughtAt.get(ev.seat) || 0;
          if (performance.now() - last > 3000) { S.caughtAt.set(ev.seat, performance.now()); call('caught', ev.seat).then(() => poke()); }
        }
        S.dirT -= dt;
        if (S.channel && S.dirT <= 0) { S.dirT = 0.2; S.channel.broadcast('dir', { s: mySeat(), d: S.director.snapshot() }); }
      } else { S.director.interpolate(dt); S.noises.length = 0; }
      for (const e of S.director.enemies) { e.trail = e.trail || []; const l = e.trail[0]; if (!l || Math.hypot(l.x - e.x, l.y - e.y) > 3) { e.trail.unshift({ x: e.x, y: e.y }); e.trail.length = Math.min(e.trail.length, 7); } }
    }
    // HUD bits
    const left = Math.max(0, r.limit - elapsed());
    const txt = started ? `⏳ ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : `Começa em ${Math.ceil((S.startAt - performance.now()) / 1000)}`;
    if (S.hud.time.textContent !== txt) { S.hud.time.textContent = txt; paintHud(); }
    const t = free ? nearTask() : null;
    const label = t ? (t.kind === 'challenge' ? `Fazer: ${t.name}` : t.kind === 'colher' ? `${t.name}: ${t.bits.filter((b) => b.got).length}/3` : `${t.name}: segurem as 2 pedras`) : '';
    S.hud.action.hidden = !t;
    if (t && S.hud.action.textContent !== label) S.hud.action.textContent = label;
    if (S.capture) { const k = Math.max(0, (S.capture.until - performance.now()) / S.capture.total); S.capture.bar.style.width = `${k * 100}%`; if (k <= 0 && !S.capture.answering) answer(-1); }
    const watching = !me.alive || me.escaped;
    S.hud.spect.hidden = !watching;
    const joyOff = Boolean(S.overlay || S.capture || watching); // the touch zone must not cover task/answer buttons
    if (S.input.joystick.el.hidden !== joyOff) S.input.joystick.el.hidden = joyOff;
  }

  function spectTarget() {
    const live = S.room.players.filter((p) => p.alive && !p.escaped && !p.left && p.seat !== mySeat() && S.remotes.has(p.seat));
    if (!live.length) return null;
    const p = live[((S.spect % live.length) + live.length) % live.length];
    const lab = S.hud.spect.querySelector('span');
    const txt = `Assistindo @${p.nick}`;
    if (lab.textContent !== txt) lab.textContent = txt;
    return S.remotes.get(p.seat).p;
  }

  function render(ctx, d) {
    if (S.phase !== 'play' || !S.map) { stars.render(ctx, d.width, d.height); return; }
    const me = meInfo();
    const focus = (!me.alive || me.escaped) ? spectTarget() || S.me : S.me;
    camera.follow(focus.x, focus.y - 12, S.map, d.width, d.height, 1 / 60, S.firstFrame);
    S.firstFrame = false;
    ctx.fillStyle = '#0b1a10';
    ctx.fillRect(0, 0, d.width, d.height);
    ctx.save();
    ctx.translate(-camera.ix, -camera.iy);
    const vx = camera.ix, vy = camera.iy;
    ctx.drawImage(S.baked, vx, vy, d.width, d.height, vx, vy, d.width, d.height);
    const time = performance.now() / 1000;
    // portal gate
    const ex = S.map.exit;
    ctx.fillStyle = S.map.exitOpen ? `rgba(255,230,140,${0.5 + 0.3 * Math.sin(time * 4)})` : '#7a6420';
    ctx.fillRect(ex.x * 16, (ex.y - 1) * 16, 16, 48);
    // temporary blockade (warning flashes first)
    const dir = S.director;
    if (dir.block) {
      const cells = S.map.blockers[dir.block.i].cells;
      ctx.fillStyle = dir.block.warn > 0 ? `rgba(200,40,60,${0.25 + 0.25 * Math.sin(time * 12)})` : 'rgba(60,20,40,.85)';
      for (const c of cells) ctx.fillRect((c % S.map.cols) * 16, Math.floor(c / S.map.cols) * 16, 16, 16);
    }
    // tasks (PROVISIONAL drawings until the art arrives)
    for (const t of S.tasks) {
      const glow = t.done ? 'rgba(124,240,166,.5)' : `rgba(255,214,90,${0.55 + 0.35 * Math.sin(time * 3 + t.n)})`;
      if (t.kind === 'ativar') t.plates.forEach((p) => { ctx.fillStyle = glow; ctx.fillRect(p.x - 6, p.y - 4, 12, 8); ctx.strokeStyle = '#3b2a12'; ctx.strokeRect(p.x - 6.5, p.y - 4.5, 13, 9); });
      else { ctx.fillStyle = '#5b4a33'; ctx.fillRect(t.x - 5, t.y - 4, 10, 8); ctx.fillStyle = glow; ctx.fillRect(t.x - 3, t.y - 10, 6, 6); }
      if (t.kind === 'colher' && !t.done) for (const b of t.bits) if (!b.got) { ctx.fillStyle = `rgba(255,255,200,${0.6 + 0.4 * Math.sin(time * 6 + b.x)})`; ctx.fillRect(b.x - 2, b.y - 6, 4, 4); }
    }
    // signalled appearances
    for (const w of dir.warnings) { ctx.strokeStyle = `rgba(255,60,60,${0.5 + 0.5 * Math.sin(time * 14)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(w.x, w.y, 12, 6, 0, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
    // characters and enemies by depth
    const list = [];
    const showMe = me.alive && !me.escaped;
    if (showMe) list.push({ y: S.me.y, draw: (c) => drawPlayer(c, S.me, me, S.map.isBushAt(S.me.x, S.me.y - 4), '') });
    for (const rm of S.remotes.values()) {
      const info = S.room.players.find((p) => p.seat === rm.seat) || {};
      if (!info.alive || info.escaped || info.left) continue;
      list.push({ y: rm.p.y, draw: (c) => drawPlayer(c, rm.p, info, rm.hidden, info.nick) });
    }
    for (const e of dir.enemies) list.push({ y: e.y, draw: (c) => drawEnemy(c, e, time) });
    list.sort((a, b) => a.y - b.y).forEach((x) => x.draw(ctx));
    ctx.restore();
    // temptation fog: only a small circle around you stays clear
    if (dir.fog > 0) {
      const g = ctx.createRadialGradient(d.width / 2, d.height / 2, 30, d.width / 2, d.height / 2, d.width * 0.6);
      g.addColorStop(0, 'rgba(20,0,20,0)'); g.addColorStop(1, 'rgba(20,0,20,.88)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, d.width, d.height);
    }
    drawMinimap(ctx, d);
  }

  function drawPlayer(c, p, info, hidden, nick) {
    c.save();
    if (hidden) c.globalAlpha = 0.45;
    p.draw(c);
    c.restore();
    if (info.protected) { c.strokeStyle = 'rgba(255,215,90,.9)'; c.beginPath(); c.ellipse(p.x, p.y - 12, 12, 16, 0, 0, 7); c.stroke(); }
    if (info.caught) { c.fillStyle = '#ff5a6a'; c.fillRect(p.x - 1, p.y - 38, 2, 6); c.fillRect(p.x - 1, p.y - 30, 2, 2); }
    if (nick) { c.font = '6px sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(0,0,0,.6)'; c.fillText(nick, p.x + 0.5, p.y - 33.5); c.fillStyle = '#fff'; c.fillText(nick, p.x, p.y - 34); }
  }

  // PROVISIONAL serpent: segments until the sprite sheet arrives
  function drawEnemy(c, e, time) {
    const tr = e.trail || [{ x: e.x, y: e.y }];
    for (let i = tr.length - 1; i >= 0; i--) {
      const s = tr[i];
      c.fillStyle = i % 2 ? '#2f6b2a' : '#3f8a35';
      c.beginPath(); c.arc(s.x, s.y - 4 + Math.sin(time * 8 + i) * 1, 5 - i * 0.4, 0, 7); c.fill();
    }
    c.fillStyle = e.state === 'chase' ? '#c62f3a' : '#4f9a3f';
    c.beginPath(); c.arc(e.x, e.y - 6, 6, 0, 7); c.fill();
    c.fillStyle = '#ffde59'; c.fillRect(e.x - 3, e.y - 8, 2, 2); c.fillRect(e.x + 1, e.y - 8, 2, 2);
    if (e.state === 'chase') { c.fillStyle = '#ff5a6a'; c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.fillText('!', e.x, e.y - 16); }
  }

  function drawMinimap(ctx, d) {
    const m = S.map, sz = Math.round(Math.min(72, d.height * 0.3)), k = sz / m.cols;
    const x0 = d.width - sz - 6, y0 = 40;
    ctx.fillStyle = 'rgba(5,7,26,.75)';
    ctx.fillRect(x0 - 2, y0 - 2, sz + 4, sz + 4);
    for (let y = 0; y < m.rows; y += 2) for (let x = 0; x < m.cols; x += 2) {
      if (!S.explored[m.idx(x, y)]) continue;
      const t = m.get(x, y);
      ctx.fillStyle = t === T.WALL ? '#1b2a1e' : t === T.WATER ? '#2e6fb0' : t === T.TREE ? '#2b5a2c' : '#6fae62';
      ctx.fillRect(x0 + x * k, y0 + y * k, k * 2, k * 2);
    }
    for (const t of S.tasks) if (S.explored[m.idx(Math.floor(t.x / 16), Math.floor(t.y / 16))]) { ctx.fillStyle = t.done ? '#7cf0a6' : '#ffd65a'; ctx.fillRect(x0 + (t.x / 16) * k - 1, y0 + (t.y / 16) * k - 1, 2, 2); }
    if (m.exitOpen) { ctx.fillStyle = '#fff1a8'; ctx.fillRect(x0 + m.exit.x * k - 1, y0 + m.exit.y * k - 2, 3, 4); }
    for (const rm of S.remotes.values()) { ctx.fillStyle = '#62b6ff'; ctx.fillRect(x0 + (rm.p.x / 16) * k - 1, y0 + (rm.p.y / 16) * k - 1, 2, 2); }
    for (const e of S.director.enemies) if (Math.hypot(e.x - S.me.x, e.y - S.me.y) < 110) { ctx.fillStyle = '#ff4d5e'; ctx.fillRect(x0 + (e.x / 16) * k - 1, y0 + (e.y / 16) * k - 1, 2, 2); }
    ctx.fillStyle = '#fff'; ctx.fillRect(x0 + (S.me.x / 16) * k - 1, y0 + (S.me.y / 16) * k - 1, 2, 2);
  }

  let uiRoot = null;
  return {
    async enter(params, ui) {
      S = fresh();
      S.ui = ui; uiRoot = ui;
      menu();
      // an invite code may be a Fuga room or an Arena room (same format): try the Fuga first
      const arena = params && params.orArena ? (err) => { if (/sala nao existe|404|PGRST|Could not find/.test(String(err && err.message))) game.scenes.go('online', { join: params.join }); else toast(fugaError(err)); } : null;
      if (params && params.join && fugaOn()) enterRoom(() => online.join(params.join, game.save.state.nick || 'jogador', game.save.state.avatarId), arena);
      else if (params && params.join && arena) arena(new Error('404'));
    },
    exit() { if (S) { if (S.phase === 'wait' && S.api && !S.api.solo) S.api.leave(S.code); S.alive = false; teardown(); } },
    update(dt) { stars.update(dt); update(dt); },
    render(ctx, d) { render(ctx, d); },
    debug: () => S, // for tests in the browser console
  };
}

export { KINDS };
