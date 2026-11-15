// Shared pieces of the "game" interface: rank badge, coins/trophies chips,
// framed avatar, chest drawing and the content cache for verses/cosmetics.

import { h } from './dom.js';
import { rankFor, nextRank, RARITY_COLOR } from '../game/economy.js';

export async function loadExtras(assets) {
  const [verses, cosmetics, arena] = await Promise.all([
    assets.loadJSON('verses.json'), assets.loadJSON('cosmetics.json'), assets.loadJSON('arena.json'),
  ]);
  return { verses: verses.cards, cosmetics, arena: arena.questions };
}

export function rankBadge(trophies, { big = false } = {}) {
  const r = rankFor(trophies);
  const numeral = (r.name.match(/ (I{1,3})$/) || [])[1] || '★';
  return h('div', { class: `rank${big ? ' rank--big' : ''}`, style: { '--rank': r.color }, title: r.name },
    h('div', { class: 'rank__shield' }, h('span', { text: numeral })),
    h('div', { class: 'rank__name', text: r.name }),
  );
}

export function rankProgress(trophies) {
  const r = rankFor(trophies);
  const n = nextRank(trophies);
  const pct = n ? Math.round(((trophies - r.min) / (n.min - r.min)) * 100) : 100;
  return h('div', { class: 'rankbar' },
    h('div', { class: 'bar' }, h('div', { class: 'bar__fill', style: { width: `${pct}%` } })),
    h('small', { text: n ? `${trophies} / ${n.min} 🏆 para ${n.name}` : `${trophies} 🏆 · patente máxima!` }),
  );
}

export function chip(icon, value, opts = {}) {
  return h(opts.onClick ? 'button' : 'div', { class: `chip${opts.cls ? ` ${opts.cls}` : ''}`, onClick: opts.onClick, title: opts.title },
    icon.startsWith('data:') || icon.includes('/') ? h('img', { class: 'pixel', src: icon, alt: '' }) : h('span', { class: 'chip__emoji', text: icon }),
    h('b', { text: String(value) }),
  );
}

export function currencyBar(game, { onCoins } = {}) {
  const s = game.save.state;
  return h('div', { class: 'currency' },
    chip('🏆', s.trophies || 0, { title: 'Troféus' }),
    chip('🪙', s.coins || 0, { title: 'Talentos (moedas)', onClick: onCoins, cls: 'chip--coins' }),
  );
}

/** Portrait inside the player's equipped frame. */
export function framedAvatar(game, size = 56, characterId) {
  const s = game.save.state;
  const id = characterId || s.avatarId;
  return h('div', { class: `frame frame--${s.equipped.frame}`, style: { width: `${size}px`, height: `${size}px` } },
    h('img', { class: 'pixel', src: game.assets.url(`portrait.${id}`), alt: '' }),
  );
}

export function titleName(extras, id) {
  const t = extras.cosmetics.titles.find((x) => x.id === id);
  return t ? t.name : '';
}

/** A treasure chest drawn with CSS, coloured by rarity. */
export function chest(rarity, { size = 90, shake = false } = {}) {
  return h('div', { class: `chest${shake ? ' is-shaking' : ''}`, style: { '--chest': RARITY_COLOR[rarity], width: `${size}px`, height: `${Math.round(size * 0.8)}px` } },
    h('div', { class: 'chest__lid' }),
    h('div', { class: 'chest__body' }, h('div', { class: 'chest__lock' })),
  );
}

export function badge(n) {
  return n > 0 ? h('span', { class: 'badge', text: n > 9 ? '9+' : String(n) }) : null;
}

export function vibrate(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch { /* not supported */ }
}

export function formatWait(ms) {
  const m = Math.ceil(ms / 60000);
  const hh = Math.floor(m / 60);
  return hh ? `${hh}h ${m % 60}min` : `${m}min`;
}
