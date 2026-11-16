// Choose which unlocked character to play with.

import { h } from '../ui/dom.js';
import { iconButton } from '../ui/icon-button.js';
import { characterCard, playableCharacters } from '../ui/character-card.js';
import { Starfield } from './starfield.js';

export function createAvatarScene(game) {
  const stars = new Starfield(80);
  return {
    enter(params, ui) {
      const save = game.save;
      const back = () => game.scenes.go(params.backScene || 'world', params.back || {});
      const list = playableCharacters(game.assets);
      const sorted = [...list.filter((c) => save.isUnlocked(c.id)), ...list.filter((c) => !save.isUnlocked(c.id))];
      const grid = h('div', { class: 'album' }, ...sorted.map((c) => {
        const unlocked = save.isUnlocked(c.id);
        return characterCard(game.assets, c, unlocked, {
          fragments: (save.state.fragments || {})[c.id] || 0,
          selected: save.state.avatarId === c.id,
          onClick: () => { if (unlocked) { save.setAvatar(c.id); back(); } },
        });
      }));
      ui.appendChild(h('section', { class: 'screen' },
        h('header', { class: 'screen__head' },
          iconButton(game.assets, 'icon.voltar', 'Voltar', back, '←'),
          h('h1', { text: 'Escolha seu personagem' }),
        ),
        h('div', { class: 'screen__body' }, grid),
      ));
    },
    update(dt) { stars.update(dt); },
    render(ctx, d) { stars.render(ctx, d.width, d.height); },
  };
}
