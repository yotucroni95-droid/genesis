// "Passe da Fé": a 30-level path that lasts a 4-week season. Playing earns
// fé points; each level has a prize. When the season ends, it starts again.

import { h } from '../ui/dom.js';
import { gameScreen } from '../ui/screen.js';
import { toast } from '../ui/toast.js';
import { ico, chest, formatWait, hasArt } from '../ui/game-ui.js';
import { pass, passReward, claimPass, PASS_LEVELS, FE_PER_LEVEL, seasonNumber, seasonEndsIn } from '../game/meta.js';
import { Starfield } from './starfield.js';
import { sfx } from '../audio/audio.js';

function rewardIcon(r) {
  if (r.kind === 'box') return chest(r.rarity, { size: 40 });
  if (r.kind === 'final') return hasArt('ui.bau_celeste') ? ico('ui.bau_celeste', '🎁', 'pass__final') : chest('lendário', { size: 44 });
  return {
    coins: () => ico('icon.moeda', '🪙'), denarios: () => ico('icon.denario', '🥈'), oil: () => ico('icon.azeite', '🫙'),
    frag: () => ico('icon.fragmento', '🧩'), frame: () => ico('icon.moldura', '🖼️'),
  }[r.kind]();
}

export function createPassScene(game) {
  const stars = new Starfield(100);
  return {
    enter(_p, ui) {
      const save = game.save;
      const p = pass(save);
      const inLevel = p.level >= PASS_LEVELS ? FE_PER_LEVEL : p.fe % FE_PER_LEVEL;
      const track = h('div', { class: 'pass' }, ...Array.from({ length: PASS_LEVELS }, (_, k) => {
        const level = k + 1;
        const r = passReward(level);
        const reached = level <= p.level;
        const claimed = Boolean(p.claimed[level]);
        return h('div', { class: `pass__lvl${reached ? ' is-on' : ''}${claimed ? ' is-claimed' : ''}${level % 10 === 0 ? ' is-big' : ''}` },
          h('b', { class: 'pass__num', text: String(level) }),
          h('div', { class: 'pass__icon' }, rewardIcon(r)),
          h('small', { text: r.label }),
          claimed ? h('span', { class: 'tag tag--final', text: '✓' })
            : h('button', { class: 'btn btn--small', disabled: !reached, text: reached ? 'Pegar' : '🔒', onClick: () => {
              const got = claimPass(save, level);
              if (!got) return;
              sfx('coin');
              let msg = `Você ganhou: ${r.label}!`;
              if (got.character) msg = `+${got.amount} fragmentos de ${got.character.name}${got.unlocked ? ' — personagem liberado!' : got.converted ? ` (já tinha: virou ${got.converted} denários)` : ''}`;
              if (r.kind === 'box' || r.kind === 'final') msg += ' Abra em Baús.';
              toast(msg, { ms: 3500 });
              game.scenes.go('pass');
            } }),
        );
      }));
      ui.appendChild(gameScreen(game, 'Passe da Fé', h('div', {},
        h('div', { class: 'pass__head' },
          ico(p.level >= 20 ? 'icon.passe_premium' : 'icon.passe', '🎖️', 'pass__badge'),
          h('div', { class: 'pass__info' },
            h('b', { text: `Temporada ${seasonNumber()} · Nível ${p.level} de ${PASS_LEVELS}` }),
            h('div', { class: 'bar' }, h('div', { class: 'bar__fill', style: { width: `${Math.round((inLevel / FE_PER_LEVEL) * 100)}%` } })),
            h('small', { text: p.level >= PASS_LEVELS ? 'Passe completo! Parabéns!' : `${inLevel} / ${FE_PER_LEVEL} pontos de fé para o próximo nível · termina em ${formatWait(seasonEndsIn())}` }),
          ),
        ),
        h('p', { class: 'screen__note', text: 'Ganhe pontos de fé jogando: paradas (+20), 3 estrelas (+10), Arena (+15), versículo do dia (+15), missões do dia (+25) e da semana (+60). Quando a temporada acaba, o passe recomeça com prêmios novos!' }),
        track,
      )));
      const first = ui.querySelector('.pass__lvl:not(.is-claimed) .btn:not([disabled])') || ui.querySelector('.pass__lvl:not(.is-on)');
      if (first) setTimeout(() => { const el = first.closest('.pass__lvl'); track.scrollLeft = Math.max(0, el.offsetLeft - track.offsetLeft - 40); }, 50);
    },
    update(dt) { stars.update(dt); },
    render(ctx, d) { stars.render(ctx, d.width, d.height); },
  };
}
