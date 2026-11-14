// Phase 1 test screen: shows every asset in the manifest and whether
// it is still a placeholder or already the final art.

import { h } from '../ui/dom.js';
import { Starfield } from './starfield.js';

export function createGalleryScene(game) {
  const stars = new Starfield(60);
  return {
    enter(_p, ui) {
      const groups = new Map();
      for (const e of game.assets.entries.values()) {
        if (!groups.has(e.group)) groups.set(e.group, []);
        groups.get(e.group).push(e);
      }
      const finals = [...game.assets.entries.values()].filter((e) => !e.placeholder).length;
      const total = game.assets.entries.size;

      const body = h('div', { class: 'screen__body' },
        h('p', { class: 'screen__note', text: `Estas são todas as imagens que o jogo espera. ${finals} de ${total} já são arte final; as outras são provisórias e serão trocadas quando você enviar os arquivos.` }),
      );
      for (const [name, items] of groups) {
        const grid = h('div', { class: 'gallery' });
        for (const e of items) {
          const url = game.assets.url(e.id);
          grid.appendChild(
            h('div', { class: 'gallery__item' },
              url ? h('img', { class: 'pixel', src: url, alt: '' }) : h('div', { style: { height: '72px', display: 'grid', placeItems: 'center', color: 'var(--ink-dim)', fontSize: '12px' }, text: '(opcional)' }),
              h('div', { class: 'gallery__name', text: e.label }),
              h('div', { class: 'gallery__file', text: e.src }),
              h('span', { class: e.placeholder ? 'tag' : 'tag tag--final', text: e.placeholder ? 'provisória' : 'arte final' }),
            ),
          );
        }
        body.appendChild(h('div', { class: 'gallery-group' }, h('h2', { text: name }), grid));
      }

      ui.appendChild(
        h('section', { class: 'screen' },
          h('header', { class: 'screen__head' },
            h('button', { class: 'btn btn--ghost btn--icon', 'aria-label': 'Voltar', onClick: () => game.scenes.go('title'), text: '←' }),
            h('h1', { text: 'Artes do jogo' }),
          ),
          body,
        ),
      );
    },
    update(dt) { stars.update(dt); },
    render(ctx, d) { stars.render(ctx, d.width, d.height); },
  };
}
