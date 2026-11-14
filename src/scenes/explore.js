// "Jornada": the list of chapters. A chapter opens when the previous one is done.

import { h } from '../ui/dom.js';
import { iconButton } from '../ui/icon-button.js';
import { toast } from '../ui/toast.js';
import { Starfield } from './starfield.js';
import { loadChapter, chapterProgress, chapterDone, isChapterOpen } from '../content/progression.js';

export function createExploreScene(game) {
  const stars = new Starfield(80);
  return {
    async enter(_p, ui) {
      const save = game.save;
      const index = game.assets.json('chapters/index.json').chapters;
      const loaded = await Promise.all(index.map((e) => loadChapter(game.assets, e)));
      const grid = h('div', { class: 'maps' });
      index.forEach((entry, i) => {
        const chapter = loaded[i];
        const open = chapter && isChapterOpen(save, i, loaded);
        const prog = chapter ? chapterProgress(save, chapter) : { done: 0, total: 0 };
        const done = chapter && chapterDone(save, chapter);
        const mapId = chapter ? chapter.map : null;
        let status = 'Em breve';
        if (chapter && !open) status = 'Complete o capítulo anterior';
        if (open) status = done ? 'Concluído ✓' : `${prog.done} de ${prog.total} paradas`;
        grid.appendChild(
          h('button', {
            class: `map-card${open ? '' : ' is-locked'}${done ? ' is-done' : ''}`,
            onClick: () => (open ? game.scenes.go('world', { chapterId: entry.id }) : toast(status)),
          },
            h('div', { class: 'map-card__img', style: mapId ? { backgroundImage: `url("${game.assets.url(`map.${mapId}`)}")` } : {} },
              open ? null : h('img', { class: 'pixel map-card__lock', src: game.assets.url('icon.cadeado'), alt: 'Bloqueado' }),
              done && chapter.medal ? h('img', { class: 'pixel map-card__medal', src: game.assets.url(`medal.${chapter.medal}`), alt: '' }) : null,
            ),
            h('div', { class: 'map-card__name' },
              h('small', { text: `Capítulo ${entry.number}` }),
              h('span', { text: entry.title }),
              h('em', { text: status }),
            ),
          ),
        );
      });
      ui.appendChild(
        h('section', { class: 'screen' },
          h('header', { class: 'screen__head' },
            iconButton(game.assets, 'icon.voltar', 'Voltar', () => game.scenes.go('title'), '←'),
            h('h1', { text: 'Jornada' }),
            h('button', { class: 'player-chip', title: 'Trocar apelido', onClick: () => game.scenes.go('nickname', { next: 'explore' }) },
              h('img', { class: 'pixel', src: game.assets.url(`portrait.${save.state.avatarId}`), alt: '' }),
              h('span', { text: `@${save.state.nick}` }),
              h('b', { class: 'player-chip__lvl', text: `Nv ${save.state.level}` }),
            ),
          ),
          h('div', { class: 'screen__body' },
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
