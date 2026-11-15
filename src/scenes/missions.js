// Daily missions and the login streak.

import { h } from '../ui/dom.js';
import { gameScreen } from '../ui/screen.js';
import { toast } from '../ui/toast.js';
import { startDay, claimMission } from '../game/economy.js';
import { Starfield } from './starfield.js';
import { celebrate } from '../ui/celebrate.js';
import { rankBadge } from '../ui/game-ui.js';
import { sfx } from '../audio/audio.js';

export function createMissionsScene(game) {
  const stars = new Starfield(100);
  return {
    enter(_p, ui) {
      const save = game.save;
      startDay(save);
      const d = save.state.daily;
      const streak = save.state.streak.count;
      const list = h('div', { class: 'missions' }, ...d.missions.map((m, i) => {
        const done = m.progress >= m.target;
        return h('div', { class: `mission${m.claimed ? ' is-claimed' : done ? ' is-done' : ''}` },
          h('div', { class: 'mission__text' },
            h('b', { text: m.text }),
            h('div', { class: 'bar' }, h('div', { class: 'bar__fill', style: { width: `${Math.round((m.progress / m.target) * 100)}%` } })),
            h('small', { text: `${m.progress} / ${m.target}` }),
          ),
          m.claimed ? h('span', { class: 'tag tag--final', text: 'Resgatada ✓' })
            : h('button', { class: 'btn btn--small', disabled: !done, text: `🪙 ${m.reward} + 🏆 5`, onClick: () => {
              const r = claimMission(save, i);
              if (r) {
                sfx('coin');
                if (r.rankUp) celebrate({ title: 'Nova patente!', subtitle: `Você chegou a ${r.rankUp.name} e ganhou um baú!`, badge: rankBadge(r.rankUp.min, { big: true }) });
                toast(`+${r.coins} talentos e +${r.trophies} troféus!${r.rankUp ? ` Nova patente: ${r.rankUp.name}!` : ''}${r.bonus ? ' Todas feitas: ganhou um baú!' : ''}`, { ms: 3500 });
                game.scenes.go('missions');
              }
            } }),
        );
      }));
      const days = h('div', { class: 'streak' }, ...[1, 2, 3, 4, 5, 6, 7].map((n) => {
        const dayInWeek = ((streak - 1) % 7) + 1;
        return h('div', { class: `streak__day${n <= dayInWeek ? ' is-on' : ''}` }, h('small', { text: `Dia ${n}` }), h('b', { text: n === 7 ? '🎁' : `🪙${20 * n}` }));
      }));
      ui.appendChild(gameScreen(game, 'Missões do dia', h('div', {},
        h('p', { class: 'screen__note', text: `🔥 Sequência: ${streak} ${streak === 1 ? 'dia' : 'dias'} seguidos. Volte todo dia para ganhar mais! No 7º dia, um baú Épico.` }),
        days,
        list,
        h('p', { class: 'screen__note', text: 'Complete as 3 missões para ganhar um baú bônus. Novas missões amanhã!' }),
      )));
    },
    update(dt) { stars.update(dt); },
    render(ctx, d) { stars.render(ctx, d.width, d.height); },
  };
}
