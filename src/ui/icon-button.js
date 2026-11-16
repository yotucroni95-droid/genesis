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
// After a touch acts, the browser still sends its own "click" ~300 ms later, at
// the same spot. If the screen changed meanwhile, that click would hit the
// button that now sits there (every back button is in the same corner), and
// one tap would go back two screens. So any click right after a touch action
// is swallowed, wherever it lands.
let swallowUntil = 0;
document.addEventListener('pointerdown', () => { swallowUntil = 0; }, true); // a new touch: its click is real
document.addEventListener('click', (e) => {
  if (e.isTrusted && Date.now() < swallowUntil) { e.preventDefault(); e.stopImmediatePropagation(); }
}, true);

export function fastButton(btn, action) {
  let down = null;
  let lastTouch = 0;
  btn.dataset.fast = '1'; // handles its own touch (see ui/tap.js)
  btn.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || !e.isPrimary) return;
    down = { x: e.clientX, y: e.clientY };
  });
  btn.addEventListener('pointercancel', () => { down = null; });
  btn.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse' || !e.isPrimary) return;
    const d = down;
    down = null;
    e.preventDefault();
    e.stopPropagation();
    // only a tap that started on this button (not a finger sliding onto it)
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 16 || btn.disabled) return;
    swallowUntil = Date.now() + 700;
    lastTouch = Date.now();
    action(e);
  });
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (Date.now() - lastTouch < 700) return; // already handled by the touch
    action(e); // mouse and keyboard
  });
  return btn;
}
