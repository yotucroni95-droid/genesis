// Player profile: rank, stats, and choosing title and frame.

import { h } from '../ui/dom.js';
import { loadChapter } from '../content/progression.js';
import { gameScreen } from '../ui/screen.js';
import { toast } from '../ui/toast.js';
import { loadExtras, rankBadge, rankProgress, framedAvatar, frameView, ico } from '../ui/game-ui.js';
import { totalStars, RARITY_COLOR, RANKS } from '../game/economy.js';
import { Starfield } from './starfield.js';
import { shareCard } from '../ui/share.js';
import { attachSecretUnlock } from '../game/admin.js';

export function createProfileScene(game) {
  const stars = new Starfield(100);
  return {
    async enter(_p, ui) {
      game.extras = game.extras || await loadExtras(game.assets);
      const save = game.save;
      const s = save.state;
      const entries = game.assets.json('chapters/index.json').chapters;
      const chs = await Promise.all(entries.map((e) => loadChapter(game.assets, e)));
      const totalStops = chs.reduce((n, c, i) => n + (c && !entries[i].waitingMap ? c.stops.length : 0), 0);
      const slot = { titles: 'title', frames: 'frame', trails: 'trail' };
      const stat = (label, value) => h('div', { class: 'stat' }, h('b', { text: String(value) }), h('small', { text: label }));
      const picker = (kind, list) => h('div', { class: 'picker' }, ...list.map((c) => {
        const owned = (s[kind] || {})[c.id];
        const on = (s.equipped[slot[kind]] || 'nenhum') === c.id;
        return h('button', {
          class: `pick${on ? ' is-on' : ''}${owned ? '' : ' is-locked'}`,
          style: { '--r': RARITY_COLOR[c.rarity] },
          onClick: () => {
            if (!owned) { toast(c.hidden ? 'Prêmio especial: lamparina, Passe da Fé ou Modo Herói.' : 'Encontre em baús ou na Loja!'); return; }
            save.update((st) => { st.equipped = { ...st.equipped, [slot[kind]]: c.id }; });
            game.scenes.go('profile');
          },
        },
        kind === 'frames' ? frameView(c.id, 48, game.assets.url(`portrait.${s.avatarId}`))
          : kind === 'trails' ? h('span', { class: 'offer__trail', style: { '--c': c.color || '#555' } }, c.color ? '✦✦✦' : '—')
            : ico('icon.titulo', '🏷️'),
        h('span', { text: owned ? c.name : '???' }));
      }));
      ui.appendChild(gameScreen(game, 'Perfil', h('div', { class: 'profile-page' },
        h('div', { class: 'profile-card' },
          framedAvatar(game, 96),
          h('div', {},
            h('h2', { text: `@${s.nick}` }),
            h('p', { class: 'profile-card__title', text: (game.extras.cosmetics.titles.find((x) => x.id === s.equipped.title) || {}).name || '' }),
            h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
              h('button', { class: 'btn btn--small btn--share', text: '📲 Compartilhar no WhatsApp', onClick: () => shareCard(game) }),
              h('button', { class: 'btn btn--ghost btn--small', text: 'Trocar apelido', onClick: () => game.scenes.go('nickname', { next: 'profile' }) }),
            ),
          ),
          h('div', { class: 'profile-card__rank' }, rankBadge(s.trophies || 0, { big: true }), rankProgress(s.trophies || 0)),
        ),
        h('div', { class: 'stats' },
          stat('Nível', s.level), stat('Troféus', s.trophies || 0), stat('Estrelas', `${totalStars(save)}/${totalStops * 3}`),
          stat('Talentos', s.coins || 0), stat('Recorde Arena', s.arenaBest || 0), stat('Lamparina', `${(s.lamp || s.streak).count || 0} dias`), stat('Denários', s.denarios || 0),
          stat('Cartas', `${Object.keys(s.verses || {}).length}/${game.extras.verses.length}`), stat('Personagens', Object.keys(s.unlocked).length),
        ),
        h('h3', { text: 'Títulos' }), picker('titles', game.extras.cosmetics.titles),
        h('h3', { text: 'Molduras' }), picker('frames', game.extras.cosmetics.frames),
        h('h3', { text: 'Rastro ao andar no mapa' }), picker('trails', game.extras.cosmetics.trails || []),
        h('h3', { text: 'Patentes' }),
        h('div', { class: 'ranks' }, ...RANKS.map((r) => h('div', { class: `ranks__item${(s.trophies || 0) >= r.min ? ' is-on' : ''}` }, rankBadge(r.min), h('small', { text: `${r.min} 🏆` })))),
        h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' } },
          h('button', { class: 'btn btn--ghost', text: 'Álbum de personagens', onClick: () => game.scenes.go('album', { backScene: 'profile' }) }),
          h('button', { class: 'btn btn--ghost', text: 'Medalhas', onClick: () => game.scenes.go('medals') }),
          h('button', { class: 'btn btn--ghost', text: 'Coleção de versículos', onClick: () => game.scenes.go('collection') }),
        ),
      )));
      attachSecretUnlock(game, ui.querySelector('.screen__head h1')); // hidden owner tool (game/admin.js)
    },
    update(dt) { stars.update(dt); },
    render(ctx, d) { stars.render(ctx, d.width, d.height); },
  };
}
