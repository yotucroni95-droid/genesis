// Small canvas "arcade" used by the action challenges (cesto, travessia, maná):
// a fixed logical size scaled to the screen, a frame loop that stops by itself
// when the player leaves, pointer/keyboard input and a few drawing helpers.

import { h } from '../ui/dom.js';

export const AW = 480;
export const AH = 270;

export function arcade(wrap) {
  const canvas = h('canvas', { class: 'arcade__canvas', width: AW * 2, height: AH * 2 });
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  ctx.imageSmoothingEnabled = false;
  const input = { x: null, y: null, down: false, taps: 0, keys: new Set() };
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    input.x = ((e.clientX - r.left) / r.width) * AW;
    input.y = ((e.clientY - r.top) / r.height) * AH;
  };
  canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); pos(e); input.down = true; input.taps += 1; });
  canvas.addEventListener('pointermove', (e) => { if (input.down || e.pointerType === 'mouse') pos(e); });
  window.addEventListener('pointerup', () => { input.down = false; });
  const onKey = (e) => {
    if (!canvas.isConnected) { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); return; }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'w', 'a', 's', 'd'].includes(e.key)) {
      e.preventDefault();
      if (e.type === 'keydown') { if (!input.keys.has(e.key)) input.taps += e.key === ' ' || e.key === 'ArrowUp' ? 1 : 0; input.keys.add(e.key); } else input.keys.delete(e.key);
    }
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);

  let raf = 0;
  let stopped = false;
  return {
    canvas, ctx, input,
    /** Calls fn(dt) every frame until it returns false or the canvas leaves the page. */
    loop(fn) {
      stopped = false;
      let last = performance.now();
      const tick = (now) => {
        if (stopped || !canvas.isConnected) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (fn(dt) === false) return;
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    },
    stop() { stopped = true; cancelAnimationFrame(raf); },
  };
}

/** Big emoji/pixel glyph centred at x, y. */
export function glyph(ctx, s, x, y, size = 22) {
  ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

/** Hearts, score and a text line on top of the game. */
export function hud(ctx, { lives = null, left = '', right = '' }) {
  ctx.fillStyle = 'rgba(10,8,30,.55)';
  ctx.fillRect(0, 0, AW, 22);
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.fillText(lives == null ? left : `${'❤️'.repeat(Math.max(0, lives))}  ${left}`, 8, 11);
  ctx.textAlign = 'right';
  ctx.fillText(right, AW - 8, 11);
}

/** Player's walking sprite (sheet row: 0 down, 1 left, 2 right, 3 up). */
export function drawSprite(ctx, assets, id, row, frame, x, y, size = 40) {
  const entry = assets.entry(`sheet.${id}`) || assets.entry('sheet.peregrino');
  if (!entry || !entry.image) { glyph(ctx, '🧍', x, y - size / 2, size * 0.8); return; }
  const f = entry.frame || 32;
  const cols = entry.cols || 4;
  ctx.drawImage(entry.image, (frame % cols) * f, row * f, f, f, Math.round(x - size / 2), Math.round(y - size), size, size);
}

/** A "Tap to start" card drawn over a paused game. */
export function startCard(ctx, title, lines) {
  ctx.fillStyle = 'rgba(10,8,30,.72)';
  ctx.fillRect(0, 0, AW, AH);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffd36e';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(title, AW / 2, AH / 2 - 44);
  ctx.fillStyle = '#fff';
  ctx.font = '13px system-ui, sans-serif';
  lines.forEach((l, i) => ctx.fillText(l, AW / 2, AH / 2 - 12 + i * 20));
  ctx.fillStyle = '#7dffc4';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText('Toque para começar', AW / 2, AH / 2 + 30 + lines.length * 8);
}

export const rand = (a, b) => a + Math.random() * (b - a);
export const hit = (a, b, r) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 < r * r;
