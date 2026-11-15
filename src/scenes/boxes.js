// Box inventory and the animated opening.

import { h } from '../ui/dom.js';
import { gameScreen } from '../ui/screen.js';
import { chest, formatWait, vibrate, loadExtras, frameView, ico } from '../ui/game-ui.js';
import { openBox, claimFreeBox, freeBoxReadyIn, RARITY_LABEL, RARITY_COLOR } from '../game/economy.js';
import { Starfield } from './starfield.js';
import { sfx } from '../audio/audio.js';

function rewardView(game, it) {
  if (it.type === 'coins') return h('div', { class: 'loot loot--coins' }, ico('icon.moeda', '🪙', 'loot__ico'), h('b', { text: `+${it.amount}` }), h('small', { text: 'talentos' }));
  if (it.type === 'verse') {
    return h('div', { class: 'loot verse-card', style: { '--r': RARITY_COLOR[it.card.rarity] } },
      it.isNew ? h('span', { class: 'loot__new', text: 'NOVA!' }) : null,
      h('small', { class: 'verse-card__rarity', text: RARITY_LABEL[it.card.rarity] }),
      h('p', { class: 'verse-card__text', text: it.card.text }),
      h('b', { class: 'verse-card__ref', text: it.card.ref }),
    );
  }
  const label = it.type === 'title' ? 'Novo título' : 'Nova moldura';
  return h('div', { class: 'loot', style: { '--r': RARITY_COLOR[it.item.rarity] } },
    it.type === 'frame' ? frameView(it.item.id, 84, game.assets.url(`portrait.${game.save.state.avatarId}`)) : ico('icon.titulo', '🏷️', 'loot__ico'),
    h('small', { text: label }), h('b', { text: it.item.name }),
  );
}

export function createBoxesScene(game) {
  const stars = new Starfield(100);
  return {
    async enter(_p, ui) {
      game.extras = game.extras || await loadExtras(game.assets);
      const save = game.save;
      const list = h('div', { class: 'boxes' });
      const overlay = h('div', { class: 'opening', hidden: true });

      const open = (box) => {
        overlay.hidden = false;
        const c = chest(box.rarity, { size: 150, shake: true });
        overlay.replaceChildren(h('div', { class: 'opening__stage' }, c, h('p', { class: 'opening__hint', text: `Baú ${RARITY_LABEL[box.rarity]}` })));
        vibrate([40, 60, 40, 60, 80]);
        sfx('shake'); setTimeout(() => sfx('shake'), 400); setTimeout(() => sfx('shake'), 800);
        setTimeout(() => {
          c.classList.add('is-open');
          if (c.openArt) c.querySelector('img').src = c.openArt;
          overlay.classList.add('is-flash');
          vibrate(120);
          sfx('open');
          const result = openBox(save, box.uid, game.extras);
          let i = 0;
          const showNext = () => {
            overlay.classList.remove('is-flash');
            if (i >= result.items.length) {
              overlay.replaceChildren(h('div', { class: 'opening__stage' },
                h('h2', { text: 'Tudo isso é seu!' }),
                h('div', { class: 'opening__all' }, ...result.items.map((it) => rewardView(game, it))),
                h('button', { class: 'btn', text: 'Continuar', onClick: () => { overlay.hidden = true; render(); } }),
              ));
              return;
            }
            const it = result.items[i++];
            sfx(it.type === 'coins' ? 'coin' : 'star');
            overlay.replaceChildren(h('div', { class: 'opening__stage', onClick: showNext },
              h('div', { class: 'opening__one' }, rewardView(game, it)),
              h('p', { class: 'opening__hint', text: `Toque para continuar (${i}/${result.items.length})` }),
            ));
          };
          setTimeout(showNext, 450);
        }, 1300);
      };

      const render = () => {
        const s = save.state;
        const freeMs = freeBoxReadyIn(save);
        const items = [];
        items.push(h('div', { class: `boxcard boxcard--free${freeMs ? ' is-waiting' : ''}` },
          chest('comum', { size: 70 }),
          h('b', { text: 'Baú grátis' }),
          h('small', { text: freeMs ? `Volta em ${formatWait(freeMs)}` : 'Pronto para pegar!' }),
          h('button', { class: 'btn', disabled: freeMs > 0, text: 'Pegar', onClick: () => { claimFreeBox(save); render(); } }),
        ));
        for (const b of s.boxes) {
          items.push(h('button', { class: 'boxcard', style: { '--r': RARITY_COLOR[b.rarity] }, onClick: () => open(b) },
            chest(b.rarity, { size: 70 }),
            h('b', { text: RARITY_LABEL[b.rarity] }),
            h('small', { text: b.from ? `de ${b.from}` : '' }),
            h('span', { class: 'btn btn--small', text: 'Abrir' }),
          ));
        }
        list.replaceChildren(...items);
      };
      render();
      ui.appendChild(gameScreen(game, 'Baús', h('div', {},
        h('p', { class: 'screen__note', text: 'Ganhe baús completando capítulos, missões, subindo de patente ou comprando na Loja. Quanto mais troféus, maior a chance de vir um baú mais raro!' }),
        list)));
      ui.appendChild(overlay);
    },
    update(dt) { stars.update(dt); },
    render(ctx, d) { stars.render(ctx, d.width, d.height); },
  };
}
