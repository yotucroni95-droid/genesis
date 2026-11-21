// Arena: "Desafio Relâmpago". Endless questions against the clock with
// 3 lives and a combo multiplier. Beat your record to earn trophies.

import { h } from '../ui/dom.js';
import { gameScreen } from '../ui/screen.js';
import { loadExtras, vibrate } from '../ui/game-ui.js';
import { shuffle } from '../challenges/shared.js';
import { addCoins, addTrophies, arenaLoss, track } from '../game/economy.js';
import { Starfield } from './starfield.js';
import { sfx } from '../audio/audio.js';
import { celebrate } from '../ui/celebrate.js';
import { rankBadge, ico } from '../ui/game-ui.js';
import { shareCard } from '../ui/share.js';
import { power, seeded, charById } from '../game/meta.js';
import { rankFor, rankArt } from '../game/economy.js';

export function seededShuffle(list, seed) {
  const rnd = seeded(seed);
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const SEEN_KEY = 'genesis.arenaSeen';
const qKey = (q) => q.q.toLowerCase().replace(/\W+/g, '').slice(0, 40);
function readSeen() { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch { return []; } }
function markSeen(q, total) {
  const seen = readSeen().filter((k) => k !== qKey(q));
  seen.push(qKey(q));
  // forget the oldest once almost every question was seen, so the cycle restarts
  while (seen.length > Math.max(1, total - 20)) seen.shift();
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch { /* storage blocked */ }
}
/** Questions this phone has not seen lately come first (duels keep the shared order). */
function unseenFirst(deck) {
  const seen = new Map(readSeen().map((k, i) => [k, i]));
  const fresh = deck.filter((q) => !seen.has(qKey(q)));
  const old = deck.filter((q) => seen.has(qKey(q))).sort((a, b) => seen.get(qKey(a)) - seen.get(qKey(b)));
  return fresh.concat(old);
}

const SECONDS = 10;

export function createArenaScene(game) {
  const stars = new Starfield(140);
  let raf = 0;
  return {
    async enter(params, ui) {
      game.extras = game.extras || await loadExtras(game.assets);
      const save = game.save;
      const duel = params && params.duel; // { seed, score, nick } from a friend's link
      const area = h('div', { class: 'arena' });
      const screen = gameScreen(game, duel ? `Desafio de @${duel.nick} ⚡` : 'Arena ⚡', area);
      // each rank has its own arena background
      screen.classList.add('arena-bg', `arena-bg--${rankArt(rankFor(save.state.trophies || 0))}`);
      const bgArt = game.assets.entry(`arena.${rankArt(rankFor(save.state.trophies || 0))}`);
      if (bgArt && bgArt.image && !bgArt.placeholder) screen.style.backgroundImage = `linear-gradient(rgba(5,7,26,.55), rgba(5,7,26,.75)), url("${game.assets.url(bgArt.id)}")`;
      ui.appendChild(screen);
      const SECS = SECONDS + power(save, 'arenaTime');
      const LIVES = 3 + power(save, 'arenaLife');
      const me = charById(save.state.avatarId);
      const powerNote = me && me.power ? `Poder de ${me.name} ativo!` : '';

      const intro = () => {
        area.replaceChildren(h('div', { class: 'quiz__result' },
          h('div', { class: 'arena__logo' }, ico('icon.arena', '⚡', 'arena__logoimg')),
          h('h2', { class: 'quiz__q', text: duel ? `@${duel.nick} fez ${duel.score} pontos. Consegue bater?` : 'Desafio Relâmpago' }),
          h('p', { class: 'screen__note', text: `${duel ? 'Vocês respondem as MESMAS perguntas. ' : ''}Responda o mais rápido que puder: ${SECS} segundos por pergunta e ${LIVES} vidas. Acerte em sequência para multiplicar os pontos!` }),
          powerNote ? h('p', { class: 'arena__power', text: `⚡ ${powerNote}` }) : null,
          h('p', { class: 'arena__best', text: save.state.arenaBest ? `Seu recorde: ${save.state.arenaBest} pontos` : 'Ainda sem recorde. Bora!' }),
          h('div', { class: 'online__row' },
            h('button', { class: 'btn btn--play', onClick: play }, h('b', { text: 'COMEÇAR' })),
            duel ? null : h('button', { class: 'btn btn--online', text: '🌐 Online 1x1 e 2x2', onClick: () => game.scenes.go('online') }),
            h('button', { class: 'btn btn--ghost btn--small', text: '🏆 Ranking', onClick: () => game.scenes.go('ranking', { tab: 'arena', back: 'arena' }) }),
          ),
        ));
      };

      const play = () => {
        const seed = duel ? duel.seed : 1 + Math.floor(Math.random() * 999999);
        let deck = seededShuffle(game.extras.arena, seed);
        if (!duel) deck = unseenFirst(deck);
        let i = 0;
        let lives = LIVES;
        let hints = power(save, 'hint');
        let score = 0;
        let combo = 0;
        let correct = 0;
        let deadline = 0;
        let locked = false;

        const hud = h('div', { class: 'arena__hud' });
        const timerBar = h('div', { class: 'arena__timer' }, h('div', { class: 'arena__timefill' }));
        const box = h('div', { class: 'arena__box' });
        area.replaceChildren(hud, timerBar, box);

        const paintHud = () => {
          const mult = combo >= 6 ? 3 : combo >= 3 ? 2 : 1;
          hud.replaceChildren(
            h('span', { class: 'arena__lives' }, ...Array.from({ length: LIVES }, (_, k) => (k < lives ? ico('icon.coracao', '❤️') : ico('icon.coracao_vazio', '🖤')))),
            h('b', { class: 'arena__score', text: `${score} pts` }),
            h('span', { class: `arena__combo${mult > 1 ? ' is-hot' : ''}`, text: mult > 1 ? `COMBO x${mult} 🔥` : `Sequência ${combo}` }),
          );
        };

        const tick = () => {
          const left = Math.max(0, deadline - performance.now());
          timerBar.firstChild.style.width = `${(left / (SECS * 1000)) * 100}%`;
          timerBar.classList.toggle('is-low', left < 3000);
          if (left <= 0 && !locked) answer(-1, null);
          else raf = requestAnimationFrame(tick);
        };

        let current = null;
        let buttons = [];
        const next = () => {
          if (i >= deck.length) { i = 0; deck = seededShuffle(deck, seed + 1); }
          current = deck[i++];
          if (!duel) markSeen(current, deck.length);
          const opts = shuffle(current.options.map((text, k) => ({ text, ok: k === current.answer })));
          buttons = opts.map((o, k) => h('button', { class: 'quiz__opt', onClick: () => answer(k, opts) }, o.text));
          const hintBtn = hints > 0 ? h('button', { class: 'btn btn--ghost btn--small arena__hint', text: `💡 Dica (${hints})`, onClick: () => {
            if (locked || hints <= 0) return;
            hints -= 1;
            const wrong = opts.map((o, k) => (o.ok || buttons[k].disabled ? -1 : k)).filter((k) => k >= 0);
            if (wrong.length) { const k = wrong[Math.floor(Math.random() * wrong.length)]; buttons[k].disabled = true; buttons[k].classList.add('is-hidden-opt'); }
            hintBtn.remove();
          } }) : null;
          box.replaceChildren(h('h2', { class: 'quiz__q', text: current.q }), h('div', { class: 'quiz__opts' }, ...buttons), hintBtn);
          locked = false;
          deadline = performance.now() + SECS * 1000;
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(tick);
        };

        function answer(k, opts) {
          if (locked) return;
          locked = true;
          cancelAnimationFrame(raf);
          const right = opts && opts[k] && opts[k].ok;
          if (opts) {
            buttons.forEach((b) => { b.disabled = true; });
            buttons[opts.findIndex((o) => o.ok)].classList.add('is-right');
            if (!right && buttons[k]) buttons[k].classList.add('is-wrong');
          }
          sfx(right ? 'correct' : 'wrong');
          if (right) {
            combo += 1;
            correct += 1;
            const mult = combo >= 6 ? 3 : combo >= 3 ? 2 : 1;
            const timeBonus = Math.round(Math.max(0, deadline - performance.now()) / 1000);
            score += (10 + timeBonus) * mult;
          } else {
            combo = 0;
            lives -= 1;
            vibrate(120);
            box.appendChild(h('p', { class: 'arena__ref', text: `Resposta em ${current.ref}` }));
          }
          paintHud();
          setTimeout(() => (lives > 0 ? next() : finish()), right ? 650 : 1500);
        }

        function finish() {
          const best = save.state.arenaBest || 0;
          const record = score > best;
          const won = duel ? score > duel.score : false;
          // talentos fall after the first 5 games of the day, so the Arena cannot be farmed
          const day = new Date().toLocaleDateString('sv-SE');
          const played = save.state.arenaDay && save.state.arenaDay.date === day ? save.state.arenaDay.n : 0;
          save.update((s) => { s.arenaDay = { date: day, n: played + 1 }; });
          const tired = played < 5 ? 1 : played < 10 ? 0.4 : 0.1;
          const coins = Math.floor(((score / 30) * (1 + power(save, 'arenaCoins') / 100) + (won ? 15 : 0)) * tired);
          const trophies = Math.round((Math.min(12, Math.floor(score / 80)) + (record && score > 0 ? 5 : 0) + (won ? 5 : 0)) * (1 + power(save, 'trophies') / 100) * tired);
          if (record) save.update((s) => { s.arenaBest = score; });
          addCoins(save, coins);
          // at high ranks a weak game costs trophies: the top has to be defended
          const loss = !trophies && !duel ? arenaLoss(save.state.trophies || 0, score) : 0;
          if (loss) addTrophies(save, -loss);
          const rankUp = trophies ? addTrophies(save, trophies) : null;
          track(save, 'arenaPlay', 1);
          sfx(record ? 'fanfare' : 'coin');
          if (rankUp) setTimeout(() => celebrate({ title: 'Nova patente!', subtitle: `Você chegou a ${rankUp.name} e ganhou um baú!`, badge: rankBadge(rankUp.min, { big: true }) }), 800);
          track(save, 'arenaScore', score);
          track(save, 'correct', correct);
          area.replaceChildren(h('div', { class: 'quiz__result' },
            h('div', { class: 'quiz__score', text: `${score}` }),
            h('h2', { class: 'quiz__q', text: duel ? (won ? `VOCÊ VENCEU @${duel.nick}! 🏆` : score === duel.score ? 'EMPATE!' : `@${duel.nick} ganhou desta vez...`) : record ? 'NOVO RECORDE! 🏆' : 'Fim de jogo!' }),
            h('p', { class: 'screen__note', text: `${correct} acertos · recorde: ${Math.max(best, score)}` }),
            h('div', { class: 'rewards' },
              h('div', { class: 'reward' }, h('span', { class: 'chip__emoji', text: '🪙' }), h('span', { text: `+${coins} talentos` })),
              trophies ? h('div', { class: 'reward' }, h('span', { class: 'chip__emoji', text: '🏆' }), h('span', { text: `+${trophies} troféus` })) : null,
              loss ? h('div', { class: 'reward reward--loss' }, h('span', { class: 'chip__emoji', text: '🔻' }), h('span', { text: `-${loss} troféus (nas patentes altas, partida fraca perde troféus)` })) : null,
              rankUp ? h('div', { class: 'reward reward--big' }, h('span', { class: 'chip__emoji', text: '⬆️' }), h('span', { text: `Nova patente: ${rankUp.name}! Ganhou um baú.` })) : null,
            ),
            h('div', { style: { display: 'flex', gap: '10px' } },
              h('button', { class: 'btn', text: duel ? 'Revanche' : 'Jogar de novo', onClick: play }),
              h('button', { class: 'btn btn--share', text: 'Desafiar amigos', onClick: () => shareCard(game, {
                headline: `Fiz ${score} pontos na Arena do Gênesis! Duvido você bater!`,
                link: `?desafio=${seed}.${score}.${encodeURIComponent(save.state.nick)}`,
              }) }),
              h('button', { class: 'btn btn--ghost', text: '🏆 Ranking', onClick: () => game.scenes.go('ranking', { tab: 'arena', back: 'arena' }) }),
              h('button', { class: 'btn btn--ghost', text: 'Lobby', onClick: () => game.scenes.go('lobby') }),
            ),
          ));
        }

        paintHud();
        next();
      };
      intro();
    },
    exit() { cancelAnimationFrame(raf); },
    update(dt) { stars.update(dt * 3); },
    render(ctx, d) { stars.render(ctx, d.width, d.height); },
  };
}
