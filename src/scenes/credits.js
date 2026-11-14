import { h } from '../ui/dom.js';
import { signature } from '../ui/signature.js';
import { Starfield } from './starfield.js';
import { CONFIG } from '../config.js';

export function createCreditsScene(game) {
  const stars = new Starfield(90);
  return {
    enter(_p, ui) {
      ui.appendChild(
        h('section', { class: 'screen' },
          h('header', { class: 'screen__head' },
            h('button', { class: 'btn btn--ghost btn--icon', 'aria-label': 'Voltar', onClick: () => game.scenes.go('title'), text: '←' }),
            h('h1', { text: 'Créditos' }),
          ),
          h('div', { class: 'screen__body', style: { textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '30px' } },
            h('div', { class: 'title__name', style: { fontSize: '48px' }, text: 'Gênesis' }),
            h('p', { class: 'screen__note', text: 'Um jogo para o grupo de jovens.' }),
            h('p', { class: 'screen__note', text: `Versão ${CONFIG.version}` }),
            h('div', { style: { marginTop: '40px' } }, signature(game.assets)),
          ),
        ),
      );
    },
    update(dt) { stars.update(dt); },
    render(ctx, d) { stars.render(ctx, d.width, d.height); },
  };
}
