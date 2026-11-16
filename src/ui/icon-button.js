import { h } from './dom.js';

/** Square button showing an icon from the manifest (falls back to a text glyph). */
export function iconButton(assets, iconId, label, onClick, fallback = '') {
  const entry = assets.entry(iconId);
  const content = entry && !entry.placeholder
    ? h('img', { class: 'pixel btn__icon', src: assets.url(iconId), alt: '' })
    : fallback;
  return fastButton(h('button', { class: 'btn btn--ghost btn--icon', 'aria-label': label, title: label }, content), onClick);
}

/**
 * Makes a button react as soon as the finger lifts (no lost or double taps).
 * Touch: acts on pointerup and ignores the click the browser sends after.
 * Mouse / keyboard: normal click.
 */
export function fastButton(btn, action) {
  let lastTouch = 0;
  btn.dataset.fast = '1'; // handles its own touch (see ui/tap.js)
  btn.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse') return;
    lastTouch = Date.now();
    e.preventDefault();
    e.stopPropagation();
    action(e);
  });
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (Date.now() - lastTouch < 700) return; // already handled by the touch
    action(e);
  });
  return btn;
}
