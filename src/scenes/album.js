// Album of collectible character cards, with a detail view where the player
// can choose the card's character to play with.

import { h } from '../ui/dom.js';
import { iconButton } from '../ui/icon-button.js';
import { toast } from '../ui/toast.js';
import { characterCard, playableCharacters } from '../ui/character-card.js';
import { Starfield } from './starfield.js';
import { powerLines, fragmentsNeeded } from '../game/meta.js';

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
          if (c.rarity === 'único') toast('Jesus é único: só aparece muito raramente num baú Lendário, ou de presente para quem juntar todos os outros personagens.', { ms: 6000 });
          else if (c.event) toast('Só no evento Acampamento: vença a trilha de desafios com 3 estrelas em cada um. Não sai em baú nem na Loja.', { ms: 5000 });
          else if (c.rarity) toast(`Junte ${fragmentsNeeded(c)} fragmentos de ${c.name} em baús, no Passe da Fé e na Loja. Você tem ${(save.state.fragments || {})[c.id] || 0}.`, { ms: 4500 });
          else toast(c.unlockedIn != null ? `Conclua o Capítulo ${c.unlockedIn} para liberar este personagem.` : 'Continue jogando para liberar!');
          return;
        }
        const powers = powerLines(c);
        const isAvatar = save.state.avatarId === c.id;
        detail.replaceChildren(h('div', { class: 'modal__box album-detail' },
          characterCard(game.assets, c, true, { selected: isAvatar }),
          h('div', { class: 'album-detail__text' },
            h('h2', { text: c.name }),
            h('p', { class: 'album-detail__virtue', text: `Virtude: ${c.virtue}` }),
            h('p', { text: c.description || '' }),
            powers.length ? h('p', { class: 'album-detail__power', text: `⚡ Poder quando você joga com ${c.name}: ${powers.join(' · ')}` }) : null,
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

      const card = (c) => characterCard(game.assets, c, save.isUnlocked(c.id), { onClick: () => open(c), selected: save.state.avatarId === c.id, fragments: (save.state.fragments || {})[c.id] || 0 });
      const genesis = list.filter((c) => !c.rarity && !c.event);
      const camp = list.filter((c) => c.event);
      const groups = [['Personagens de Gênesis', genesis]];
      if (camp.length) groups.push([`⛺ Acampamento · ${camp.filter((c) => save.isUnlocked(c.id)).length}/${camp.length}`, camp]);
      for (const [r, label] of [['único', 'Único'], ['lendário', 'Lendários'], ['épico', 'Épicos'], ['raro', 'Raros'], ['comum', 'Comuns']]) {
        const g = list.filter((c) => c.rarity === r);
        if (g.length) groups.push([`${label} · ${g.filter((c) => save.isUnlocked(c.id)).length}/${g.length}`, g]);
      }
      const grid = h('div', {}, ...groups.map(([title, g]) => h('div', {}, h('h3', { text: title }), h('div', { class: 'album' }, ...g.map(card)))));
      ui.appendChild(h('section', { class: 'screen' },
        h('header', { class: 'screen__head' },
          iconButton(game.assets, 'icon.voltar', 'Voltar', () => game.scenes.go(params.backScene || 'lobby', params.back || {}), '←'),
          h('h1', { text: 'Álbum' }),
          h('span', { class: 'head-count', text: `${have} de ${list.length} cartas` }),
        ),
        h('div', { class: 'screen__body' },
          h('p', { class: 'screen__note', text: 'Os de Gênesis vêm dos capítulos. Os outros personagens da Bíblia saem por fragmentos (10 liberam o personagem) em baús, no Passe da Fé e na Loja. Cada um tem um poder!' }),
          grid,
        ),
        detail,
      ));
    },
    update(dt) { stars.update(dt); },
    render(ctx, d) { stars.render(ctx, d.width, d.height); },
  };
}
