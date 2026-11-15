// Collection of Bible verse cards found in boxes.

import { h } from '../ui/dom.js';
import { gameScreen } from '../ui/screen.js';
import { loadExtras } from '../ui/game-ui.js';
import { RARITY_LABEL, RARITY_COLOR } from '../game/economy.js';
import { Starfield } from './starfield.js';

export function createCollectionScene(game) {
  const stars = new Starfield(100);
  return {
    async enter(_p, ui) {
      game.extras = game.extras || await loadExtras(game.assets);
      const have = game.save.state.verses || {};
      const cards = game.extras.verses;
      const got = cards.filter((c) => have[c.id]).length;
      const grid = h('div', { class: 'verses' }, ...cards.map((c) => (have[c.id]
        ? h('div', { class: 'verse-card', style: { '--r': RARITY_COLOR[c.rarity] } },
          have[c.id] > 1 ? h('span', { class: 'verse-card__count', text: `x${have[c.id]}` }) : null,
          h('small', { class: 'verse-card__rarity', text: RARITY_LABEL[c.rarity] }),
          h('p', { class: 'verse-card__text', text: c.text }),
          h('b', { class: 'verse-card__ref', text: c.ref }))
        : h('div', { class: 'verse-card is-locked', style: { '--r': RARITY_COLOR[c.rarity] } },
          h('small', { class: 'verse-card__rarity', text: RARITY_LABEL[c.rarity] }),
          h('div', { class: 'verse-card__q', text: '?' })))));
      ui.appendChild(gameScreen(game, `Coleção · ${got}/${cards.length}`, h('div', {},
        h('p', { class: 'screen__note', text: 'Cartas de versículo saem dos baús. Junte todas, das comuns às lendárias!' }),
        grid)));
    },
    update(dt) { stars.update(dt); },
    render(ctx, d) { stars.render(ctx, d.width, d.height); },
  };
}
