// Phase 3 test screen: pick any map and walk around it.

import { h } from '../ui/dom.js';
import { iconButton } from '../ui/icon-button.js';
import { Starfield } from './starfield.js';

export function createExploreScene(game) {
  const stars = new Starfield(80);
  return {
    enter(_p, ui) {
      const maps = game.assets.json('maps/index.json').maps;
      const grid = h('div', { class: 'maps' });
      for (const m of maps) {
        grid.appendChild(
          h('button', { class: 'map-card', onClick: () => game.scenes.go('world', { mapId: m.id }) },
            h('div', { class: 'map-card__img', style: { backgroundImage: `url("${game.assets.url(`map.${m.id}`)}")` } }),
            h('div', { class: 'map-card__name', text: m.name }),
          ),
        );
      }
      ui.appendChild(
        h('section', { class: 'screen' },
          h('header', { class: 'screen__head' },
            iconButton(game.assets, 'icon.voltar', 'Voltar', () => game.scenes.go('title'), '←'),
            h('h1', { text: 'Explorar' }),
            h('button', { class: 'player-chip', title: 'Trocar apelido', onClick: () => game.scenes.go('nickname', { next: 'explore' }) },
              h('img', { class: 'pixel', src: game.assets.url(`portrait.${game.save.state.avatarId}`), alt: '' }),
              h('span', { text: `@${game.save.state.nick}` }),
            ),
          ),
          h('div', { class: 'screen__body' },
            h('p', { class: 'screen__note', text: 'Versão de teste: escolha um lugar e ande com o joystick (ou com as setas no computador). O botão com o rosto troca o personagem.' }),
            grid,
            h('div', { style: { marginTop: '18px', display: 'flex', justifyContent: 'center' } },
              h('button', { class: 'btn btn--ghost', onClick: () => game.scenes.go('gallery'), text: 'Artes do jogo' }),
            ),
          ),
        ),
      );
    },
    update(dt) { stars.update(dt); },
    render(ctx, d) { stars.render(ctx, d.width, d.height); },
  };
}
