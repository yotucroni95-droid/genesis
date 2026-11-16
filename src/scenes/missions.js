// Missions: the lamp (ofensiva), daily missions and weekly missions.

import { h } from '../ui/dom.js';
import { gameScreen } from '../ui/screen.js';
import { toast } from '../ui/toast.js';
import { startDay, claimMission } from '../game/economy.js';
import { lamp, lampStage, weekly, claimWeekly, weekEndsIn } from '../game/meta.js';
import { Starfield } from './starfield.js';
import { celebrate } from '../ui/celebrate.js';
import { rankBadge, ico, formatWait } from '../ui/game-ui.js';
import { sfx } from '../audio/audio.js';

const LAMP_ICON = ['icon.lamparina_apagada', 'icon.lamparina', 'icon.lamparina_azul', 'icon.lamparina_branca'];

function missionRow(m, rewardText, onClaim) {
  const done = m.progress >= m.target;
  return h('div', { class: `mission${m.claimed ? ' is-claimed' : done ? ' is-done' : ''}` },
    h('div', { class: 'mission__text' },
      h('b', { text: m.text }),
      h('div', { class: 'bar' }, h('div', { class: 'bar__fill', style: { width: `${Math.round((m.progress / m.target) * 100)}%` } })),
      h('small', { text: `${m.progress} / ${m.target}` }),
    ),
    m.claimed ? h('span', { class: 'tag tag--final', text: 'Resgatada ✓' })
      : h('button', { class: 'btn btn--small', disabled: !done, text: rewardText, onClick: onClaim }),
  );
}

let tab = 'dia';

export function createMissionsScene(game) {
  const stars = new Starfield(100);
  return {
    enter(_p, ui) {
      const save = game.save;
      startDay(save);
      const l = lamp(save);
      const stage = l.litToday ? lampStage(l.count) : 0;
      const nextGoal = l.count < 7 ? 7 : l.count < 30 ? 30 : l.count < 100 ? 100 : null;
      const lampCard = h('div', { class: `lamp-card${l.litToday ? '' : ' is-off'}` },
        ico(LAMP_ICON[stage], '🪔', 'lamp-card__icon'),
        h('div', {},
          h('b', { text: `${l.count} ${l.count === 1 ? 'dia' : 'dias'} de lamparina acesa` }),
          h('p', { text: l.litToday ? 'Acesa hoje! Volte amanhã para não deixar apagar.' : 'Ainda apagada hoje: conclua uma parada, jogue a Arena ou faça o versículo do dia.' }),
          h('p', { text: `🫙 Frascos de azeite: ${save.state.oil || 0} (cada um protege 1 dia sem jogar)${nextGoal ? ` · Próximo prêmio: ${nextGoal} dias` : ''} · Recorde: ${l.best || l.count} ${(l.best || l.count) === 1 ? 'dia' : 'dias'}` }),
        ),
      );

      const daily = () => {
        const d = save.state.daily;
        return h('div', {},
          h('div', { class: 'missions' }, ...d.missions.map((m, i) => missionRow(m, `🪙 ${m.reward} + 🏆 5`, () => {
            const r = claimMission(save, i);
            if (!r) return;
            sfx('coin');
            if (r.rankUp) celebrate({ title: 'Nova patente!', subtitle: `Você chegou a ${r.rankUp.name} e ganhou um baú!`, badge: rankBadge(r.rankUp.min, { big: true }) });
            toast(`+${r.coins} talentos, +${r.trophies} troféus e +25 de fé!${r.bonus ? ' Todas feitas: ganhou um baú!' : ''}`, { ms: 3500 });
            game.scenes.go('missions');
          }))),
          h('p', { class: 'screen__note', text: 'Complete as 3 missões para ganhar um baú bônus. Novas missões amanhã!' }),
        );
      };

      const week = () => {
        const w = weekly(save);
        return h('div', {},
          h('div', { class: 'missions' }, ...w.missions.map((m, i) => missionRow(m, `🥈 ${m.reward} + ✨ 60`, () => {
            const r = claimWeekly(save, i);
            if (!r) return;
            sfx('coin');
            toast(`+${r.denarios} denários e +${r.fe} de fé!${r.bonus ? ' Todas da semana feitas: ganhou um baú Épico!' : ''}`, { ms: 3500 });
            game.scenes.go('missions');
          }))),
          h('p', { class: 'screen__note', text: `Missões da semana dão denários, a moeda rara. Complete as 4 para ganhar um baú Épico. Novas em ${formatWait(weekEndsIn())}.` }),
        );
      };

      const body = h('div', {});
      const tabs = h('div', { class: 'tabs' },
        h('button', { class: tab === 'dia' ? 'is-on' : '', text: 'Do dia', onClick: () => { tab = 'dia'; game.scenes.go('missions'); } }),
        h('button', { class: tab === 'semana' ? 'is-on' : '', text: 'Da semana', onClick: () => { tab = 'semana'; game.scenes.go('missions'); } }),
      );
      body.replaceChildren(tab === 'dia' ? daily() : week());
      ui.appendChild(gameScreen(game, 'Missões', h('div', {}, lampCard, tabs, body)));
    },
    update(dt) { stars.update(dt); },
    render(ctx, d) { stars.render(ctx, d.width, d.height); },
  };
}
