import { h } from '../ui/dom.js';
import { signature } from '../ui/signature.js';
import { Starfield } from './starfield.js';
import { cloudOn, accountCode } from '../cloud/account.js';
import { openAccountMenu } from '../cloud/account-ui.js';

/**
 * On phones that allow it (most Android), open full screen and lock the
 * screen lying down. Where it is not allowed (iPhone), the "turn your phone"
 * notice does the job instead.
 */
function goLandscapeFullscreen() {
  if (!matchMedia('(pointer: coarse)').matches) return; // computers: leave as is
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req || document.fullscreenElement) return;
  Promise.resolve(req.call(el, { navigationUI: 'hide' }))
    .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'))
    .catch(() => {});
}

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

      const start = () => {
        goLandscapeFullscreen();
        if (game.save.hasNick) game.scenes.go('lobby');
        else if (cloudOn() && !accountCode()) game.scenes.go('welcome'); // new phone: new player or existing account?
        else game.scenes.go('nickname', { next: 'lobby' });
      };

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
              cloudOn() ? h('button', { class: 'btn btn--ghost', onClick: (e) => { e.stopPropagation(); openAccountMenu(game); }, text: '☁️ Minha conta' }) : null,
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
        const f = entry.frame || 32;
        let size = f * 2; // twice as big when there is room (whole numbers keep pixels crisp)
        let x = Math.floor(w / 2 - size / 2);
        let y = Math.floor(hgt * 0.5 - size / 2);
        if (stage) {
          const r = stage.getBoundingClientRect();
          const top = display.toLogical(r.left, r.top);
          const bottom = display.toLogical(r.left, r.bottom);
          if (bottom.y - top.y < size + 8) size = f; // phone lying down: little height
          const c = display.toLogical(r.left + r.width / 2, r.top + r.height / 2);
          x = Math.floor(c.x - size / 2);
          y = Math.floor(c.y - size / 2);
        }
        ctx.drawImage(sheet, frame * f, 0, f, f, x, y, size, size);
      }
    },
  };
}
