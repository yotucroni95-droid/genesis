// Collectible character card. Locked: black silhouette with "?".
// Unlocked: portrait, name, virtue and Bible passage.

import { h } from './dom.js';
import { fragmentsNeeded } from '../game/meta.js';

const RARITY = { comum: ['Comum', '#9fb3c8'], raro: ['Raro', '#4fa3ff'], 'épico': ['Épico', '#b56dff'], 'lendário': ['Lendário', '#ffc93c'], 'único': ['ÚNICO', '#fff1b8'] };

export function playableCharacters(assets) {
  return assets.json('characters.json').characters.filter((c) => c.playable);
}

export function characterCard(assets, c, unlocked, { onClick, selected = false, fragments = 0 } = {}) {
  const portrait = assets.url(`portrait.${c.id}`);
  const frame = assets.entry('ui.card_frame');
  const r = RARITY[c.rarity];
  const cls = `cc${unlocked ? '' : ' is-locked'}${selected ? ' is-selected' : ''}${r ? ` cc--rare cc--${c.rarity === 'único' ? 'unico' : c.rarity.normalize('NFD').replace(/[̀-ͯ]/g, '')}` : ''}`;
  let lockedLine = c.unlockedIn != null ? `Capítulo ${c.unlockedIn}` : '';
  if (r) lockedLine = c.rarity === 'único' ? 'Quase impossível' : `🧩 ${fragments}/${fragmentsNeeded(c)}`;
  return h('button', { class: cls, onClick, style: r ? { '--rar': r[1] } : {}, 'aria-label': unlocked ? c.name : 'Personagem bloqueado' },
    r ? h('span', { class: 'cc__rarity', text: r[0] }) : null,
    frame && !frame.placeholder ? h('img', { class: 'pixel cc__frame', src: assets.url('ui.card_frame'), alt: '' }) : null,
    h('div', { class: 'cc__art' },
      h('img', { class: 'pixel cc__face', src: portrait, alt: '' }),
      unlocked ? null : h('span', { class: 'cc__q', text: '?' }),
    ),
    h('div', { class: 'cc__name', text: unlocked ? c.name : '???' }),
    h('div', { class: 'cc__virtue', text: unlocked ? c.virtue || '' : lockedLine }),
    unlocked && c.passage ? h('div', { class: 'cc__verse', text: c.passage }) : null,
  );
}
