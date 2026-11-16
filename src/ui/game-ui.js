// Shared pieces of the "game" interface: rank badge, coins/trophies chips,
// framed avatar, chest drawing and the content cache for verses/cosmetics.

import { h } from './dom.js';
import { rankFor, nextRank, rankArt, RARITY_COLOR } from '../game/economy.js';
import { lamp, lampStage } from '../game/meta.js';

// Icons: when the artist's PNG exists it is used, otherwise the emoji.
let A = null;
export function setUiAssets(assets) { A = assets; }
export function hasArt(id) {
  const e = A && A.entry(id);
  return Boolean(e && e.image && !e.placeholder);
}
export function ico(id, emoji, cls = '') {
  if (hasArt(id)) return h('img', { class: `pixel ico ${cls}`, src: A.url(id), alt: '' });
  return h('span', { class: `ico ico--emoji ${cls}`, text: emoji });
}
const RARITY_FILE = { comum: 'comum', raro: 'raro', 'épico': 'epico', 'lendário': 'lendario' };

export async function loadExtras(assets) {
  const [verses, cosmetics, arena] = await Promise.all([
    assets.loadJSON('verses.json'), assets.loadJSON('cosmetics.json'), assets.loadJSON('arena.json'),
  ]);
  return { verses: verses.cards, cosmetics, arena: arena.questions };
}

export function rankBadge(trophies, { big = false } = {}) {
  const r = rankFor(trophies);
  const numeral = (r.name.match(/ (I{1,3})$/) || [])[1] || '★';
  const art = `ui.patente_${rankArt(r)}`;
  return h('div', { class: `rank${big ? ' rank--big' : ''}`, style: { '--rank': r.color }, title: r.name },
    hasArt(art)
      ? h('div', { class: 'rank__art' }, h('img', { class: 'pixel', src: A.url(art), alt: '', style: r.tint ? { filter: r.tint } : {} }), numeral !== '★' ? h('span', { text: numeral }) : null)
      : h('div', { class: 'rank__shield' }, h('span', { text: numeral })),
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
    typeof icon === 'string' ? h('span', { class: 'chip__emoji', text: icon }) : icon,
    h('b', { text: String(value) }),
  );
}

const LAMP_ICON = ['icon.lamparina_apagada', 'icon.lamparina', 'icon.lamparina_azul', 'icon.lamparina_branca'];

/** The lamp (ofensiva): lit today or still waiting, with the number of days. */
export function lampChip(game, onClick) {
  const l = lamp(game.save);
  const stage = l.litToday ? lampStage(l.count) : 0;
  return chip(ico(LAMP_ICON[stage], '🪔', 'chip__ico'), l.count, {
    title: l.litToday ? 'Lamparina acesa hoje!' : 'Jogue hoje para acender sua lamparina',
    onClick, cls: `chip--lamp chip--lamp${stage}${l.litToday ? '' : ' is-waiting'}`,
  });
}

export function currencyBar(game, { onCoins, onLamp } = {}) {
  const s = game.save.state;
  return h('div', { class: 'currency' },
    onLamp ? lampChip(game, onLamp) : null,
    chip(ico('icon.trofeu', '🏆', 'chip__ico'), s.trophies || 0, { title: 'Troféus', cls: 'chip--trophy' }),
    chip(ico('icon.moeda', '🪙', 'chip__ico'), s.coins || 0, { title: 'Talentos (moedas)', onClick: onCoins, cls: 'chip--coins' }),
    chip(ico('icon.denario', '🥈', 'chip__ico'), s.denarios || 0, { title: 'Denários (moeda rara)', onClick: onCoins, cls: 'chip--den' }),
  );
}

/** A portrait inside a frame: the artist's frame art when present, else the CSS one. */
export function frameView(frameId, size, portraitUrl) {
  const art = `ui.moldura_${frameId}`;
  if (hasArt(art)) {
    return h('div', { class: 'frame frame--art', style: { width: `${size}px`, height: `${size}px` } },
      h('img', { class: 'pixel frame__face', src: portraitUrl, alt: '' }),
      h('img', { class: 'pixel frame__over', src: A.url(art), alt: '' }));
  }
  return h('div', { class: `frame frame--${frameId}`, style: { width: `${size}px`, height: `${size}px` } },
    h('img', { class: 'pixel', src: portraitUrl, alt: '' }));
}

/** Portrait inside the player's equipped frame. */
export function framedAvatar(game, size = 56, characterId) {
  const s = game.save.state;
  const id = characterId || s.avatarId;
  return frameView(s.equipped.frame, size, game.assets.url(`portrait.${id}`));
}

export function titleName(extras, id) {
  const t = extras.cosmetics.titles.find((x) => x.id === id);
  return t ? t.name : '';
}

/** A treasure chest drawn with CSS, coloured by rarity. */
export function chest(rarity, { size = 90, shake = false } = {}) {
  const art = `ui.bau_${RARITY_FILE[rarity]}`;
  if (hasArt(art)) {
    const el = h('div', { class: `chest chest--art${shake ? ' is-shaking' : ''}`, style: { '--chest': RARITY_COLOR[rarity], width: `${size}px`, height: `${size}px` } },
      h('img', { class: 'pixel chest__img', src: A.url(art), alt: '' }));
    el.openArt = hasArt(`${art}_aberto`) ? A.url(`${art}_aberto`) : null;
    return el;
  }
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
  if (hh >= 48) return `${Math.floor(hh / 24)} dias`;
  return hh ? `${hh}h ${m % 60}min` : `${m}min`;
}
