// The main screen (lobby): the player's character big in the middle, rank,
// coins, and buttons to play, enter the Arena, open boxes and more.

import { h } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { Starfield } from './starfield.js';
import { loadExtras, rankBadge, rankProgress, currencyBar, framedAvatar, titleName, badge, chest, formatWait } from '../ui/game-ui.js';
import { startDay, pendingMissions, freeBoxReadyIn } from '../game/economy.js';
import { muteButton } from '../ui/mute-button.js';
import { shareCard } from '../ui/share.js';
import { dailyDone } from './daily.js';

let greeted = false;

export function createLobbyScene(game) {
  const stars = new Starfield(120);
  let t = 0;
  let dir = 0;
  let stage = null;
  let timer = 0;
  const sparkles = [];

  return {
    async enter(_p, ui) {
      const save = game.save;
      game.extras = game.extras || await loadExtras(game.assets);
      const events = startDay(save);
      if (!greeted) {
        greeted = true;
        for (const e of events) {
          if (e.type === 'streak') toast(`🔥 ${e.count} ${e.count === 1 ? 'dia' : 'dias'} seguidos! +${e.coins} talentos`, { ms: 3500 });
          if (e.type === 'box') setTimeout(() => toast('🎁 7 dias seguidos: você ganhou um baú Épico!', { ms: 3500 }), 1200);
        }
      }
      const s = save.state;
      const go = (scene, p) => () => game.scenes.go(scene, p);
      const boxesCount = (s.boxes || []).length + (freeBoxReadyIn(save) === 0 ? 1 : 0);
      const freeLabel = h('small', { class: 'lobby__free' });
      const updateFree = () => {
        const ms = freeBoxReadyIn(save);
        freeLabel.textContent = ms === 0 ? 'Baú grátis pronto!' : `Grátis em ${formatWait(ms)}`;
      };
      updateFree();
      timer = setInterval(updateFree, 30000);

      const side = (icon, label, onClick, n = 0, extra = null) => h('button', { class: 'lobby__btn', onClick },
        h('span', { class: 'lobby__icon', text: icon }), h('span', { text: label }), badge(n), extra);

      stage = h('button', { class: 'lobby__stage', 'aria-label': 'Girar o personagem', onClick: () => { dir = (dir + 1) % 4; } });

      ui.appendChild(h('section', { class: 'lobby' },
        h('header', { class: 'lobby__top' },
          h('button', { class: 'lobby__me', onClick: go('profile') },
            framedAvatar(game, 52),
            h('div', {},
              h('b', { text: `@${s.nick}` }),
              h('small', { text: titleName(game.extras, s.equipped.title) }),
            ),
          ),
          h('button', { class: 'lobby__rank', onClick: go('profile') }, rankBadge(s.trophies || 0), rankProgress(s.trophies || 0)),
          currencyBar(game, { onCoins: go('shop') }),
          h('button', { class: 'btn btn--ghost btn--icon', title: 'Compartilhar no WhatsApp', 'aria-label': 'Compartilhar no WhatsApp', onClick: () => shareCard(game), text: '📲' }),
          muteButton(),
        ),
        h('div', { class: 'lobby__left' },
          side('🧑', 'Personagens', go('avatar', { backScene: 'lobby' })),
          side('🃏', 'Coleção', go('collection')),
          side('📖', 'Versículo', go('daily'), dailyDone(save) ? 0 : 1),
          side('🏅', 'Medalhas', go('medals')),
        ),
        stage,
        h('div', { class: 'lobby__right' },
          side('📅', 'Missões', go('missions'), pendingMissions(save)),
          side('🎁', 'Baús', go('boxes'), boxesCount, freeLabel),
          side('🛒', 'Loja', go('shop')),
        ),
        h('div', { class: 'lobby__name' },
          h('b', { text: (game.assets.json('characters.json').characters.find((c) => c.id === s.avatarId) || {}).name || '' }),
          h('button', { class: 'lobby__change', onClick: go('avatar', { backScene: 'lobby' }), text: 'Trocar personagem' }),
        ),
        h('div', { class: 'lobby__bottom' },
          h('button', { class: 'btn btn--arena', onClick: go('arena') }, h('span', { text: '⚡' }), h('span', {}, h('b', { text: 'ARENA' }), h('small', { text: s.arenaBest ? `Recorde: ${s.arenaBest}` : 'Desafio relâmpago' }))),
          h('button', { class: 'btn btn--play', onClick: go('explore') }, h('b', { text: 'JOGAR' }), h('small', { text: 'Jornada' })),
        ),
      ));
      if ((s.boxes || []).length) {
        const preview = chest(s.boxes[s.boxes.length - 1].rarity, { size: 34 });
        preview.classList.add('lobby__chestpeek');
        ui.querySelector('.lobby__right .lobby__btn:nth-child(2)').appendChild(preview);
      }
      if (!save.seenTip('lobby')) {
        save.markTip('lobby');
        setTimeout(() => toast('Toque em JOGAR para começar a jornada. Ganhe estrelas, talentos e baús!', { ms: 5000 }), 600);
      }
    },

    exit() { clearInterval(timer); },

    update(dt) {
      t += dt;
      stars.update(dt);
      if (Math.random() < dt * 14) sparkles.push({ x: (Math.random() - 0.5) * 70, y: 0, vy: 14 + Math.random() * 20, life: 1.6 });
      for (const p of sparkles) { p.y -= p.vy * dt; p.life -= dt; }
      while (sparkles.length && sparkles[0].life <= 0) sparkles.shift();
    },

    render(ctx, display) {
      const { width: w, height: hgt } = display;
      stars.render(ctx, w, hgt);
      if (!stage) return;
      const r = stage.getBoundingClientRect();
      const c = display.toLogical(r.left + r.width / 2, r.bottom);
      const top = display.toLogical(r.left, r.top);
      const entry = game.assets.entry(`sheet.${game.save.state.avatarId}`);
      if (!entry || !entry.image) return;
      const f = entry.frame || 32;
      const avail = c.y - top.y;
      const scale = Math.max(1, Math.min(4, Math.floor((avail - 10) / f)));
      const size = f * scale;
      const baseY = Math.round(c.y - 6);
      // glowing platform
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(c.x, baseY, 2, c.x, baseY, size * 0.7);
      g.addColorStop(0, 'rgba(255,214,110,.55)');
      g.addColorStop(1, 'rgba(255,214,110,0)');
      ctx.fillStyle = g;
      ctx.fillRect(c.x - size, baseY - size * 0.35, size * 2, size * 0.7);
      for (const p of sparkles) {
        ctx.globalAlpha = Math.max(0, p.life / 1.6);
        ctx.fillStyle = '#fff2b0';
        ctx.fillRect(Math.round(c.x + p.x), Math.round(baseY + p.y), 1, 1);
      }
      ctx.restore();
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.beginPath();
      ctx.ellipse(c.x, baseY, size * 0.3, size * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      const walk = (entry.anim && entry.anim.walk) || [0, 1, 2, 1];
      const frame = walk[Math.floor(t * 5) % walk.length];
      const bob = Math.round(Math.sin(t * 2) * scale);
      ctx.drawImage(entry.image, frame * f, dir * f, f, f, Math.round(c.x - size / 2), baseY - size + bob, size, size);
    },
  };
}
