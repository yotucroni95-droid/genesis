// The main screen (lobby): the player's character big in the middle, rank,
// coins, and buttons to play, enter the Arena, open boxes and more.

import { h } from '../ui/dom.js';
import { ensureAccount } from '../cloud/account-ui.js';
import { checkWeekPrize } from '../cloud/account.js';
import { celebrate } from '../ui/celebrate.js';
import { toast } from '../ui/toast.js';
import { isSabbath, showSabbath } from '../game/sabbath.js';
import { Starfield } from './starfield.js';
import { loadExtras, rankBadge, rankProgress, currencyBar, framedAvatar, titleName, badge, chest, formatWait, ico } from '../ui/game-ui.js';
import { startDay, pendingMissions, freeBoxReadyIn, weekId, addBox, addCoins } from '../game/economy.js';
import { muteButton } from '../ui/mute-button.js';
import { shareCard } from '../ui/share.js';
import { dailyDone } from './daily.js';
import { pendingWeekly, pendingPass, pass, addDenarios } from '../game/meta.js';
import { friendsOn, friendsState, cachedFriends, clearInvite } from '../cloud/friends.js';
import { shouldOfferPush, markPushAsked, enablePush, refreshPush, PUSH_TEXT } from '../cloud/push.js';

let pushRefreshed = false;

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
      const enteredAt = Date.now();
      const save = game.save;
      game.extras = game.extras || await loadExtras(game.assets);
      const events = startDay(save);
      if (!greeted) {
        greeted = true;
        for (const e of events) {
          if (e.type === 'oilUsed') toast(`🫙 Você ficou ${e.missed} ${e.missed === 1 ? 'dia' : 'dias'} sem jogar, mas o azeite manteve sua lamparina acesa (${e.count} dias)!`, { ms: 5000 });
          if (e.type === 'lampOut') toast(`Sua lamparina de ${e.was} ${e.was === 1 ? 'dia' : 'dias'} apagou... Jogue hoje para acender de novo! 🪔`, { ms: 5000 });
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

      const friendsBadge = () => { const c = cachedFriends(); return c ? c.incoming.length + c.invites.length : 0; };
      const side = (icon, label, onClick, n = 0, extra = null) => h('button', { class: 'lobby__btn', onClick },
        typeof icon === 'string' ? h('span', { class: 'lobby__icon', text: icon }) : icon, h('span', { text: label }), badge(n), extra);

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
          h('button', { class: 'lobby__rank', onClick: go('ranking') }, rankBadge(s.trophies || 0), rankProgress(s.trophies || 0)),
          currencyBar(game, { onCoins: go('shop'), onLamp: go('missions') }),
          h('button', { class: 'btn btn--ghost btn--icon', title: 'Compartilhar no WhatsApp', 'aria-label': 'Compartilhar no WhatsApp', onClick: () => shareCard(game) }, ico('icon.whatsapp', '📲')),
          muteButton(),
          h('button', { class: 'btn btn--ghost btn--icon', title: 'Configurações', 'aria-label': 'Configurações', onClick: go('settings') }, ico('icon.config', '⚙️')),
        ),
        h('div', { class: 'lobby__left' },
          side(ico('icon.personagens', '🧑', 'lobby__icon'), 'Personagens', go('avatar', { backScene: 'lobby' })),
          side(ico('icon.colecao', '🃏', 'lobby__icon'), 'Coleção', go('collection')),
          side(ico('icon.livro', '📖', 'lobby__icon'), 'Versículo', go('daily'), dailyDone(save) ? 0 : 1),
          h('div', { class: 'lobby__pair' },
            side(ico('icon.medalha', '🏅', 'lobby__icon'), 'Medalhas', go('medals')),
            side(ico('icon.pets', '🐑', 'lobby__icon'), 'Pets', go('pets'))),
          side(ico('icon.trofeu_ouro', '🏆', 'lobby__icon'), 'Ranking', go('ranking')),
        ),
        stage,
        h('div', { class: 'lobby__right' },
          side(ico('icon.passe', '🎖️', 'lobby__icon'), 'Passe da Fé', go('pass'), pendingPass(save), h('small', { class: 'lobby__free lobby__pass', text: `Nível ${pass(save).level}` })),
          side(ico('icon.missoes', '📅', 'lobby__icon'), 'Missões', go('missions'), pendingMissions(save) + pendingWeekly(save)),
          side(ico('icon.baus', '🎁', 'lobby__icon'), 'Baús', go('boxes'), boxesCount, freeLabel),
          h('div', { class: 'lobby__pair' },
            side(ico('icon.loja', '🛒', 'lobby__icon'), 'Loja', go('shop')),
            side(ico('icon.amigos', '👥', 'lobby__icon'), 'Amigos', go('friends'), friendsBadge())),
        ),
        h('div', { class: 'lobby__name' },
          h('b', { text: (game.assets.json('characters.json').characters.find((c) => c.id === s.avatarId) || {}).name || '' }),
          h('button', { class: 'lobby__change', onClick: go('avatar', { backScene: 'lobby' }), text: 'Trocar personagem' }),
          isSabbath() ? h('button', { class: 'lobby__sabbath', text: '🕊️ Feliz sábado!', onClick: () => showSabbath() }) : null,
        ),
        h('div', { class: 'lobby__bottom' },
          h('button', { class: 'btn btn--arena', onClick: go('arena') }, ico('icon.arena', '⚡', 'arena__ico'), h('span', {}, h('b', { text: 'ARENA' }), h('small', { text: s.arenaBest ? `Recorde: ${s.arenaBest}` : 'Desafio relâmpago' }))),
          h('button', { class: 'btn btn--play', onClick: go('explore') }, h('b', { text: 'JOGAR' }), h('small', { text: 'Jornada' })),
          h('button', { class: 'btn btn--online lobby__fuga', onClick: go('fuga') }, h('b', { text: 'FUGA' }), h('small', { text: 'Cooperativo 1–5' })),
        ),
      ));
      if ((s.boxes || []).length) {
        const preview = chest(s.boxes[s.boxes.length - 1].rarity, { size: 34 });
        preview.classList.add('lobby__chestpeek');
        ui.querySelector('.lobby__right .lobby__btn:nth-child(3)').appendChild(preview);
      }
      ensureAccount(game); // gives every player a cloud account and shows the code once
      checkWeekPrize(save, weekId(new Date(Date.now() - 7 * 864e5))).then((p) => {
        if (!p) return;
        addBox(save, p.box, 'semana');
        addCoins(save, p.coins);
        addDenarios(save, p.denarios);
        celebrate({ title: `${['🥇', '🥈', '🥉'][p.pos - 1]} ${p.pos}º lugar na semana!`, subtitle: `Você ficou no top 3 do ranking semanal e ganhou um baú ${p.box}, ${p.coins} talentos e ${p.denarios} denários!` });
      }).catch(() => {});
      // friends: badge for requests/invites and a call when a friend invites to the Arena
      if (friendsOn()) {
        friendsState().then((st) => {
          if (!ui.isConnected) return;
          const btn = [...ui.querySelectorAll('.lobby__btn')].find((b) => b.textContent.includes('Amigos'));
          if (btn) { const old = btn.querySelector('.badge'); if (old) old.remove(); const n = st.incoming.length + st.invites.length; if (n) btn.appendChild(badge(n)); }
          const inv = st.invites[0];
          if (!inv || game.room || game.duel || ui.querySelector('.modal')) return;
          // each invite pops up only once on this phone (no loop if clearing fails)
          let seenInv = [];
          try { seenInv = JSON.parse(localStorage.getItem('genesis.invSeen') || '[]'); } catch { /* storage blocked */ }
          if (seenInv.includes(inv.room)) return;
          try { localStorage.setItem('genesis.invSeen', JSON.stringify(seenInv.concat(inv.room).slice(-20))); } catch { /* ignore */ }
          // compact and high on the screen: right after "Toque para começar" the browser's
          // full-screen notice covers the bottom of the screen for a few seconds
          const modal = h('div', { class: 'modal modal--top' }, h('div', { class: 'modal__box duel duel--invite' },
            h('button', { class: 'modal__x', 'aria-label': 'Fechar', text: '✕', onClick: () => { clearInvite(inv.room); modal.remove(); } }),
            h('h2', { text: `⚡ @${inv.nick} te chamou para jogar!` }),
            h('div', { style: { display: 'flex', gap: '10px', justifyContent: 'center' } },
              h('button', { class: 'btn btn--play', onClick: () => { modal.remove(); clearInvite(inv.room); game.scenes.go('fuga', { join: inv.room, orArena: true }); } }, h('b', { text: 'JOGAR' })),
              h('button', { class: 'btn btn--ghost', text: 'Agora não', onClick: () => { clearInvite(inv.room); modal.remove(); } }),
            ),
            h('p', { text: 'Partida online: as mesmas perguntas, ao mesmo tempo.' })));
          const show = () => { if (ui.isConnected && !ui.querySelector('.modal')) ui.appendChild(modal); };
          setTimeout(show, Math.max(0, 4500 - (Date.now() - enteredAt)));
        }).catch(() => {});
      }
      // reminders (lamp about to go out, missions, ranking): offered once the player has played
      if (!pushRefreshed) { pushRefreshed = true; refreshPush(); }
      if ((save.state.lamp && save.state.lamp.count >= 1) && !game.room && !game.duel) {
        setTimeout(() => shouldOfferPush().then((offer) => {
          if (!offer || !ui.isConnected || ui.querySelector('.modal')) return;
          markPushAsked();
          const close = () => modal.remove();
          const modal = h('div', { class: 'modal' }, h('div', { class: 'modal__box duel' },
            h('div', { class: 'duel__ico', text: '🔔' }),
            h('h2', { text: 'Quer um lembrete para não apagar a lamparina?' }),
            h('p', { text: 'No máximo 1 aviso por dia, no fim da tarde: lamparina, missões e ranking.' }),
            h('div', { style: { display: 'flex', gap: '10px', justifyContent: 'center' } },
              h('button', { class: 'btn btn--play', onClick: async (e) => {
                e.currentTarget.disabled = true;
                const st = await enablePush().catch(() => 'off');
                close();
                toast(st === 'on' ? '🔔 Lembretes ligados!' : PUSH_TEXT[st] || 'Não foi possível ligar agora.', { ms: st === 'on' ? 2500 : 7000 });
              } }, h('b', { text: 'ATIVAR' })),
              h('button', { class: 'btn btn--ghost', text: 'Agora não', onClick: close }),
            )));
          ui.appendChild(modal);
        }).catch(() => {}), 9000);
      }
      if (game.room) {
        const join = game.room;
        game.room = null;
        setTimeout(() => game.scenes.go('online', { join }), 0);
        return;
      }
      if (game.duel) {
        const duel = game.duel;
        game.duel = null;
        const modal = h('div', { class: 'modal' }, h('div', { class: 'modal__box duel' },
          ico('icon.desafio', '🥊', 'duel__ico'),
          h('h2', { text: `@${duel.nick} te desafiou!` }),
          h('p', { text: `Fez ${duel.score} pontos na Arena. Você responde as mesmas perguntas. Consegue bater?` }),
          h('div', { style: { display: 'flex', gap: '10px', justifyContent: 'center' } },
            h('button', { class: 'btn btn--play', onClick: () => game.scenes.go('arena', { duel }) }, h('b', { text: 'ACEITAR' })),
            h('button', { class: 'btn btn--ghost', text: 'Agora não', onClick: () => modal.remove() }),
          ),
        ));
        ui.appendChild(modal);
      } else if (!save.seenTip('lobby')) {
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
      // fill the stage (steps of 1/4, not only whole numbers: on phones lying
      // down the stage is ~1.6 sprites tall and the character looked tiny)
      const scale = Math.max(1, Math.min(4, Math.floor(((avail - 6) / f) * 4) / 4));
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
