// Collectible character card. Locked: black silhouette with "?".
// Unlocked: portrait, name, virtue and Bible passage.

import { h } from './dom.js';

export function playableCharacters(assets) {
  return assets.json('characters.json').characters.filter((c) => c.playable);
}

export function characterCard(assets, c, unlocked, { onClick, selected = false } = {}) {
  const portrait = assets.url(`portrait.${c.id}`);
  const frame = assets.entry('ui.card_frame');
  const cls = `cc${unlocked ? '' : ' is-locked'}${selected ? ' is-selected' : ''}`;
  return h('button', { class: cls, onClick, 'aria-label': unlocked ? c.name : 'Personagem bloqueado' },
    frame && !frame.placeholder ? h('img', { class: 'pixel cc__frame', src: assets.url('ui.card_frame'), alt: '' }) : null,
    h('div', { class: 'cc__art' },
      h('img', { class: 'pixel cc__face', src: portrait, alt: '' }),
      unlocked ? null : h('span', { class: 'cc__q', text: '?' }),
    ),
    h('div', { class: 'cc__name', text: unlocked ? c.name : '???' }),
    h('div', { class: 'cc__virtue', text: unlocked ? c.virtue || '' : c.unlockedIn != null ? `Capítulo ${c.unlockedIn}` : '' }),
    unlocked && c.passage ? h('div', { class: 'cc__verse', text: c.passage }) : null,
  );
}
