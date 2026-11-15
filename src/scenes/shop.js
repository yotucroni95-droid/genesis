// Shop: buy boxes with talentos (game coins only).

import { h } from '../ui/dom.js';
import { gameScreen } from '../ui/screen.js';
import { chest } from '../ui/game-ui.js';
import { toast } from '../ui/toast.js';
import { SHOP, buyBox, RARITY_LABEL, RARITY_COLOR } from '../game/economy.js';
import { Starfield } from './starfield.js';

const WHAT = {
  comum: '20–40 talentos + 1 carta',
  raro: '50–90 talentos + 2 cartas (1 rara)',
  'épico': '100–160 talentos + 3 cartas (1 épica) + chance de título ou moldura',
  'lendário': '200–300 talentos + 4 cartas (1 lendária) + título ou moldura garantido',
};

export function createShopScene(game) {
  const stars = new Starfield(100);
  return {
    enter(_p, ui) {
      const grid = h('div', { class: 'shop' }, ...SHOP.map((item) => h('div', { class: 'shopcard', style: { '--r': RARITY_COLOR[item.rarity] } },
        chest(item.rarity, { size: 76 }),
        h('b', { text: `Baú ${RARITY_LABEL[item.rarity]}` }),
        h('small', { text: WHAT[item.rarity] }),
        h('button', { class: 'btn', text: `🪙 ${item.price}`, onClick: () => {
          if (buyBox(game.save, item.rarity)) { toast(`Baú ${RARITY_LABEL[item.rarity]} comprado! Abra em Baús.`); game.scenes.go('shop'); }
          else toast('Talentos insuficientes. Complete paradas, missões e a Arena para ganhar mais!');
        } }),
      )));
      ui.appendChild(gameScreen(game, 'Loja', h('div', {},
        h('p', { class: 'screen__note', text: 'Tudo na loja é comprado com talentos, a moeda do jogo. Aqui não existe dinheiro de verdade.' }),
        grid,
        h('div', { style: { display: 'flex', justifyContent: 'center', marginTop: '14px' } }, h('button', { class: 'btn btn--ghost', text: 'Ir para meus baús', onClick: () => game.scenes.go('boxes') })),
      )));
    },
    update(dt) { stars.update(dt); },
    render(ctx, d) { stars.render(ctx, d.width, d.height); },
  };
}
