// All medals: earned ones shine, the others are grey with a hint.

import { h } from '../ui/dom.js';
import { iconButton } from '../ui/icon-button.js';
import { Starfield } from './starfield.js';

export function createMedalsScene(game) {
  const stars = new Starfield(80);
  return {
    enter(_p, ui) {
      const save = game.save;
      const medals = game.assets.manifest.assets.filter((a) => a.kind === 'medal');
      const chapters = game.assets.json('chapters/index.json').chapters;
      const hint = (id) => {
        if (id === 'primeiros_passos') return 'Conclua a sua primeira parada.';
        const n = Number((id.match(/capitulo_(\d+)/) || [])[1]);
        const ch = chapters.find((c) => c.number === n);
        return ch ? `Conclua o Capítulo ${n}: ${ch.title}.` : 'Continue jogando.';
      };
      const earnedCount = medals.filter((m) => save.state.achievements[m.id.replace('medal.', '')]).length;
      const list = h('div', { class: 'medals' }, ...medals.map((m) => {
        const id = m.id.replace('medal.', '');
        const when = save.state.achievements[id];
        return h('div', { class: `medal${when ? ' is-earned' : ''}` },
          h('img', { class: 'pixel', src: game.assets.url(m.id), alt: '' }),
          h('div', {},
            h('strong', { text: m.label }),
            h('p', { text: when ? `Conquistada em ${new Date(when).toLocaleDateString('pt-BR')}` : hint(id) }),
          ),
        );
      }));
      ui.appendChild(h('section', { class: 'screen' },
        h('header', { class: 'screen__head' },
          iconButton(game.assets, 'icon.voltar', 'Voltar', () => game.scenes.go('explore'), '←'),
          h('h1', { text: 'Medalhas' }),
          h('span', { class: 'head-count', text: `${earnedCount} de ${medals.length}` }),
        ),
        h('div', { class: 'screen__body' }, list),
      ));
    },
    update(dt) { stars.update(dt); },
    render(ctx, d) { stars.render(ctx, d.width, d.height); },
  };
}
