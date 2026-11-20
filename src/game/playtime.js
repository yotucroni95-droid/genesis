// Play time: counts seconds while the game is on screen and the player has
// touched it in the last 2 minutes (a phone left idle does not count).
// Saved as state.play = { total, days: { 'YYYY-MM-DD': seconds } } (last 35 days),
// so it goes to the cloud with the rest of the progress.

const TICK_S = 15;
const IDLE_MS = 2 * 60 * 1000;
const KEEP_DAYS = 35;

export function startPlaytime(save) {
  let lastInput = Date.now();
  let pending = 0;
  const touch = () => { lastInput = Date.now(); };
  for (const ev of ['pointerdown', 'keydown', 'touchstart', 'wheel']) window.addEventListener(ev, touch, { passive: true, capture: true });

  const flush = () => {
    if (!pending) return;
    const secs = pending;
    pending = 0;
    const day = new Date().toLocaleDateString('sv-SE');
    save.update((s) => {
      const p = s.play && typeof s.play === 'object' ? s.play : { total: 0, days: {} };
      const days = { ...(p.days || {}) };
      days[day] = (days[day] || 0) + secs;
      const keys = Object.keys(days).sort();
      while (keys.length > KEEP_DAYS) delete days[keys.shift()];
      s.play = { total: (p.total || 0) + secs, days };
    });
  };

  setInterval(() => {
    if (document.visibilityState !== 'visible' || Date.now() - lastInput > IDLE_MS) return;
    pending += TICK_S;
    if (pending >= 60) flush(); // one save per minute of play
  }, TICK_S * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);
}
