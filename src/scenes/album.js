// Album of collectible character cards, with a detail view where the player
// can choose the card's character to play with.

import { h } from '../ui/dom.js';
import { iconButton } from '../ui/icon-button.js';
import { toast } from '../ui/toast.js';
import { characterCard, playableCharacters } from '../ui/character-card.js';
import { Starfield } from './starfield.js';

export function createAlbumScene(game) {
  const stars = new Starfield(80);
  return {
    enter(params, ui) {
      const save = game.save;
      const list = playableCharacters(game.assets);
      const have = list.filter((c) => save.isUnlocked(c.id)).length;
      const detail = h('div', { class: 'modal', hidden: true });

      const open = (c) => {
        const unlocked = save.isUnlocked(c.id);
        if (!unlocked) {
          toast(c.unlockedIn != null ? `Conclua o Capítulo ${c.unlockedIn} para liberar este personagem.` : 'Continue jogando para liberar!');
          return;
        }
        const isAvatar = save.state.avatarId === c.id;
        detail.replaceChildren(h('div', { class: 'modal__box album-detail' },
          characterCard(game.assets, c, true, { selected: isAvatar }),
          h('div', { class: 'album-detail__text' },
            h('h2', { text: c.name }),
            h('p', { class: 'album-detail__virtue', text: `Virtude: ${c.virtue}` }),
            h('p', { text: c.description || '' }),
            h('span', { class: 'verse verse--dark' }, h('img', { class: 'pixel', src: game.assets.url('icon.livro'), alt: '' }), `Leia: ${c.passage}`),
            h('div', { class: 'album-detail__buttons' },
              isAvatar ? h('span', { class: 'tag tag--final', text: 'Você está jogando com este personagem' })
                : h('button', { class: 'btn', text: 'Jogar com este', onClick: () => { save.setAvatar(c.id); toast(`Agora você joga com ${c.name}!`); detail.hidden = true; game.scenes.go('album', params); } }),
              h('button', { class: 'btn btn--ghost', text: 'Fechar', onClick: () => { detail.hidden = true; } }),
            ),
          ),
        ));
        detail.hidden = false;
      };

      const grid = h('div', { class: 'album' }, ...list.map((c) => characterCard(game.assets, c, save.isUnlocked(c.id), { onClick: () => open(c), selected: save.state.avatarId === c.id })));
      ui.appendChild(h('section', { class: 'screen' },
        h('header', { class: 'screen__head' },
          iconButton(game.assets, 'icon.voltar', 'Voltar', () => game.scenes.go(params.backScene || 'lobby', params.back || {}), '←'),
          h('h1', { text: 'Álbum' }),
          h('span', { class: 'head-count', text: `${have} de ${list.length} cartas` }),
        ),
        h('div', { class: 'screen__body' },
          h('p', { class: 'screen__note', text: 'Complete capítulos para revelar as cartas. Toque numa carta liberada para ver a história do personagem e jogar com ele.' }),
          grid,
        ),
        detail,
      ));
    },
    update(dt) { stars.update(dt); },
    render(ctx, d) { stars.render(ctx, d.width, d.height); },
  };
}
