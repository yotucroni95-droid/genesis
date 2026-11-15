// Standard screen frame: back button, title, coins/trophies and a body.

import { h } from './dom.js';
import { iconButton } from './icon-button.js';
import { currencyBar } from './game-ui.js';
import { muteButton } from './mute-button.js';

export function gameScreen(game, title, body, { back = 'lobby', backParams = {} } = {}) {
  return h('section', { class: 'screen' },
    h('header', { class: 'screen__head' },
      iconButton(game.assets, 'icon.voltar', 'Voltar', () => game.scenes.go(back, backParams), '←'),
      h('h1', { text: title }),
      h('div', { style: { marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' } }, currencyBar(game, { onCoins: () => game.scenes.go('shop') }), muteButton()),
    ),
    h('div', { class: 'screen__body' }, body),
  );
}
