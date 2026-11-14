import { h } from '../ui/dom.js';
import { signature } from '../ui/signature.js';
import { Starfield } from './starfield.js';

export function createTitleScene(game) {
  const stars = new Starfield();
  let t = 0;

  return {
    enter(_params, ui) {
      const genesisLogo = game.assets.entry('logo.genesis');
      const logo = genesisLogo && !genesisLogo.placeholder && genesisLogo.image
        ? h('img', { class: 'pixel', src: game.assets.url('logo.genesis'), alt: 'Gênesis' })
        : h('div', { class: 'title__name', text: 'Gênesis' });

      const start = () => game.scenes.go('gallery');

      ui.appendChild(
        h('section', { class: 'title', onClick: start },
          h('div', { class: 'title__logo' },
            logo,
            h('div', { class: 'title__verse', text: 'Gênesis 1:1' }),
          ),
          h('div', { class: 'title__start' },
            h('div', { class: 'title__tap', text: 'Toque para começar' }),
          ),
          h('div', { class: 'title__footer' },
            h('div', { class: 'title__tools' },
              h('button', { class: 'btn btn--ghost', onClick: (e) => { e.stopPropagation(); game.scenes.go('credits'); }, text: 'Créditos' }),
            ),
            signature(game.assets),
          ),
        ),
      );
    },

    update(dt) {
      t += dt;
      stars.update(dt);
    },

    render(ctx, display) {
      const { width: w, height: hgt } = display;
      stars.render(ctx, w, hgt);
      // Peregrino walking in place on the horizon (shows the sprite sheet works).
      const sheet = game.assets.image('sheet.peregrino');
      if (sheet) {
        const frame = [0, 1, 2, 1][Math.floor(t * 6) % 4];
        const x = Math.floor(w / 2 - 16);
        // Lying down there is little height, so the walker goes higher.
        const y = Math.floor(hgt * (w > hgt ? 0.4 : 0.62));
        ctx.drawImage(sheet, frame * 32, 0, 32, 32, x, y, 32, 32);
      }
    },
  };
}
