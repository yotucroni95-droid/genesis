import { h } from './dom.js';

/** Square button showing an icon from the manifest (falls back to a text glyph). */
export function iconButton(assets, iconId, label, onClick, fallback = '') {
  const entry = assets.entry(iconId);
  const content = entry && !entry.placeholder
    ? h('img', { class: 'pixel btn__icon', src: assets.url(iconId), alt: '' })
    : fallback;
  return h('button', { class: 'btn btn--ghost btn--icon', 'aria-label': label, title: label, onClick }, content);
}
