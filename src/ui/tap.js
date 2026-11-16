// Reliable taps on phones (iOS and Android).
// Browsers drop a tap when the finger moves a few pixels, when the page is
// busy, or when two taps come quickly (double-tap zoom). Here every button
// acts as soon as the finger lifts on it, and the late "click" the browser
// sends afterwards is ignored, so one tap is always exactly one action.

const SELECTOR = 'button, .btn, [role="button"]';
const MOVE_LIMIT = 16; // pixels the finger may slide and still count as a tap

export function installReliableTaps() {
  let down = null;
  let handled = null; // the button already activated by the touch
  let handledAt = 0;

  const scroller = (el) => el.closest('.screen__body, .opening__all, .album, .maps');

  document.addEventListener('pointerdown', (e) => {
    handled = null; // a new touch: whatever click comes next is a real one
    if (e.pointerType === 'mouse' || !e.isPrimary) { down = null; return; }
    const btn = e.target.closest && e.target.closest(SELECTOR);
    if (!btn || btn.disabled || btn.dataset.fast) { down = null; return; }
    const sc = scroller(btn);
    down = { btn, x: e.clientX, y: e.clientY, sc, top: sc ? sc.scrollTop : 0, left: sc ? sc.scrollLeft : 0 };
  }, true);

  document.addEventListener('pointercancel', () => { down = null; }, true);

  document.addEventListener('pointerup', (e) => {
    if (!down || e.pointerType === 'mouse' || !e.isPrimary) return;
    const { btn, x, y, sc, top, left } = down;
    down = null;
    if (!btn.isConnected || btn.disabled) return;
    if (Math.hypot(e.clientX - x, e.clientY - y) > MOVE_LIMIT) return; // it was a swipe
    if (sc && (Math.abs(sc.scrollTop - top) > 4 || Math.abs(sc.scrollLeft - left) > 4)) return; // it was a scroll
    const r = btn.getBoundingClientRect();
    const pad = 12; // a finger is wide: lifting just outside the edge still counts
    if (e.clientX < r.left - pad || e.clientX > r.right + pad || e.clientY < r.top - pad || e.clientY > r.bottom + pad) return;
    handled = btn;
    handledAt = Date.now();
    btn.click(); // runs the button's normal action right now
  }, true);

  // the browser's own click arrives ~0-300 ms later, at the same spot. The screen
  // may have changed by then and another button may sit there now, so that
  // click is ignored wherever it lands (until the next touch starts)
  document.addEventListener('click', (e) => {
    if (!e.isTrusted || !handled) return;
    if (Date.now() - handledAt > 800) { handled = null; return; }
    e.preventDefault();
    e.stopImmediatePropagation();
    handled = null;
  }, true);
}
