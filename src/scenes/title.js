import { h } from '../ui/dom.js';
import { signature } from '../ui/signature.js';
import { Starfield } from './starfield.js';

export function createTitleScene(game) {
  const stars = new Starfield();
  let t = 0;
  let stage = null; // empty DOM box where the walking Peregrino is drawn

  return {
    enter(_params, ui) {
      const genesisLogo = game.assets.entry('logo.genesis');
      const logo = genesisLogo && !genesisLogo.placeholder && genesisLogo.image
        ? h('img', { class: 'pixel', src: game.assets.url('logo.genesis'), alt: 'Gênesis' })
        : h('div', { class: 'title__name', text: 'Gênesis' });

      const start = () => game.scenes.go(game.save.hasNick ? 'explore' : 'nickname');

      ui.appendChild(
        h('section', { class: 'title', onClick: start },
          h('div', { class: 'title__logo' },
            logo,
            h('div', { class: 'title__verse', text: 'Gênesis 1:1' }),
          ),
          (stage = h('div', { class: 'title__stage', 'aria-hidden': 'true' })),
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
      const entry = game.assets.entry('sheet.peregrino');
      const sheet = entry && entry.image;
      if (sheet) {
        const walk = (entry.anim && entry.anim.walk) || [0, 1, 2, 1];
        const frame = walk[Math.floor(t * 6) % walk.length];
        // Centre the walker in the empty stage box between the logo and the "tap" text.
        let x = Math.floor(w / 2 - 16);
        let y = Math.floor(hgt * 0.5 - 16);
        if (stage) {
          const r = stage.getBoundingClientRect();
          const c = display.toLogical(r.left + r.width / 2, r.top + r.height / 2);
          x = Math.floor(c.x - 16);
          y = Math.floor(c.y - 16);
        }
        ctx.drawImage(sheet, frame * 32, 0, 32, 32, x, y, 32, 32);
      }
    },
  };
}
