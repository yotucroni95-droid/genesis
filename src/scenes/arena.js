// Arena: "Desafio Relâmpago". Endless questions against the clock with
// 3 lives and a combo multiplier. Beat your record to earn trophies.

import { h } from '../ui/dom.js';
import { gameScreen } from '../ui/screen.js';
import { loadExtras, vibrate } from '../ui/game-ui.js';
import { shuffle } from '../challenges/shared.js';
import { addCoins, addTrophies, track } from '../game/economy.js';
import { Starfield } from './starfield.js';
import { sfx } from '../audio/audio.js';
import { celebrate } from '../ui/celebrate.js';
import { rankBadge } from '../ui/game-ui.js';
import { shareCard } from '../ui/share.js';

const SECONDS = 10;

export function createArenaScene(game) {
  const stars = new Starfield(140);
  let raf = 0;
  return {
    async enter(_p, ui) {
      game.extras = game.extras || await loadExtras(game.assets);
      const save = game.save;
      const area = h('div', { class: 'arena' });
      ui.appendChild(gameScreen(game, 'Arena ⚡', area));

      const intro = () => {
        area.replaceChildren(h('div', { class: 'quiz__result' },
          h('div', { class: 'arena__logo', text: '⚡' }),
          h('h2', { class: 'quiz__q', text: 'Desafio Relâmpago' }),
          h('p', { class: 'screen__note', text: `Responda o mais rápido que puder: ${SECONDS} segundos por pergunta e 3 vidas. Acerte em sequência para multiplicar os pontos!` }),
          h('p', { class: 'arena__best', text: save.state.arenaBest ? `Seu recorde: ${save.state.arenaBest} pontos` : 'Ainda sem recorde. Bora!' }),
          h('button', { class: 'btn btn--play', onClick: play }, h('b', { text: 'COMEÇAR' })),
        ));
      };

      const play = () => {
        const deck = shuffle(game.extras.arena);
        let i = 0;
        let lives = 3;
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
            h('span', { class: 'arena__lives', text: '❤️'.repeat(lives) + '🖤'.repeat(3 - lives) }),
            h('b', { class: 'arena__score', text: `${score} pts` }),
            h('span', { class: `arena__combo${mult > 1 ? ' is-hot' : ''}`, text: mult > 1 ? `COMBO x${mult} 🔥` : `Sequência ${combo}` }),
          );
        };

        const tick = () => {
          const left = Math.max(0, deadline - performance.now());
          timerBar.firstChild.style.width = `${(left / (SECONDS * 1000)) * 100}%`;
          timerBar.classList.toggle('is-low', left < 3000);
          if (left <= 0 && !locked) answer(-1, null);
          else raf = requestAnimationFrame(tick);
        };

        let current = null;
        let buttons = [];
        const next = () => {
          if (i >= deck.length) i = 0;
          current = deck[i++];
          const opts = shuffle(current.options.map((text, k) => ({ text, ok: k === current.answer })));
          buttons = opts.map((o, k) => h('button', { class: 'quiz__opt', onClick: () => answer(k, opts) }, o.text));
          box.replaceChildren(h('h2', { class: 'quiz__q', text: current.q }), h('div', { class: 'quiz__opts' }, ...buttons));
          locked = false;
          deadline = performance.now() + SECONDS * 1000;
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
          const coins = Math.floor(score / 10);
          const trophies = Math.min(15, Math.floor(score / 50)) + (record && score > 0 ? 5 : 0);
          if (record) save.update((s) => { s.arenaBest = score; });
          addCoins(save, coins);
          const rankUp = trophies ? addTrophies(save, trophies) : null;
          track(save, 'arenaPlay', 1);
          sfx(record ? 'fanfare' : 'coin');
          if (rankUp) setTimeout(() => celebrate({ title: 'Nova patente!', subtitle: `Você chegou a ${rankUp.name} e ganhou um baú!`, badge: rankBadge(rankUp.min, { big: true }) }), 800);
          track(save, 'arenaScore', score);
          track(save, 'correct', correct);
          area.replaceChildren(h('div', { class: 'quiz__result' },
            h('div', { class: 'quiz__score', text: `${score}` }),
            h('h2', { class: 'quiz__q', text: record ? 'NOVO RECORDE! 🏆' : 'Fim de jogo!' }),
            h('p', { class: 'screen__note', text: `${correct} acertos · recorde: ${Math.max(best, score)}` }),
            h('div', { class: 'rewards' },
              h('div', { class: 'reward' }, h('span', { class: 'chip__emoji', text: '🪙' }), h('span', { text: `+${coins} talentos` })),
              trophies ? h('div', { class: 'reward' }, h('span', { class: 'chip__emoji', text: '🏆' }), h('span', { text: `+${trophies} troféus` })) : null,
              rankUp ? h('div', { class: 'reward reward--big' }, h('span', { class: 'chip__emoji', text: '⬆️' }), h('span', { text: `Nova patente: ${rankUp.name}! Ganhou um baú.` })) : null,
            ),
            h('div', { style: { display: 'flex', gap: '10px' } },
              h('button', { class: 'btn', text: 'Jogar de novo', onClick: play }),
              h('button', { class: 'btn btn--share', text: '📲 Desafiar amigos', onClick: () => shareCard(game, { headline: `Fiz ${score} pontos na Arena do Gênesis! Duvido você bater!` }) }),
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
