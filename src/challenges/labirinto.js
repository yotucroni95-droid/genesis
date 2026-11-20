// "Labirinto da Fé": a new maze every time. Collect the words of a verse
// (hidden in dead ends), then reach the exit before time runs out.
// Arrows on screen, keyboard or swipe. PROVISIONAL look (emoji/CSS) until the art arrives.
// config: { size, seconds, verses: [{ text, ref }], hard }

import { h } from '../ui/dom.js';
import { resultScreen, timerBar } from './result.js';

const VERSES = [
  { text: 'Lâmpada para os meus pés é a tua palavra', ref: 'Salmo 119:105' },
  { text: 'Eu sou o caminho, a verdade e a vida', ref: 'João 14:6' },
  { text: 'Confie no Senhor de todo o coração', ref: 'Provérbios 3:5' },
  { text: 'O Senhor é o meu pastor, nada me faltará', ref: 'Salmo 23:1' },
];

function maze(n) {
  // recursive backtracker on an n×n grid of rooms; walls kept per cell [top, right, bottom, left]
  const cells = Array.from({ length: n * n }, () => [1, 1, 1, 1]);
  const seen = new Uint8Array(n * n);
  const stack = [0]; seen[0] = 1;
  const dirs = [[0, -1, 0, 2], [1, 0, 1, 3], [0, 1, 2, 0], [-1, 0, 3, 1]];
  while (stack.length) {
    const c = stack[stack.length - 1], x = c % n, y = (c / n) | 0;
    const opts = dirs.filter(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < n && ny < n && !seen[ny * n + nx]; });
    if (!opts.length) { stack.pop(); continue; }
    const [dx, dy, w, o] = opts[Math.floor(Math.random() * opts.length)];
    const nb = (y + dy) * n + x + dx;
    cells[c][w] = 0; cells[nb][o] = 0; seen[nb] = 1; stack.push(nb);
  }
  return cells;
}

export function start(config, env) {
  const wrap = h('div', { class: 'quiz labi' });
  env.root.appendChild(wrap);
  const n = Math.max(5, Math.min(11, (config.size || 7) + (config.hard ? 2 : 0)));
  const seconds = (config.seconds || 75) - (config.hard ? 15 : 0);
  return new Promise((resolve) => {
    const play = () => {
      const cells = maze(n);
      const pool = (config.verses && config.verses.length ? config.verses : VERSES);
      const verse = pool[Math.floor(Math.random() * pool.length)];
      const words = verse.text.split(' ');
      const parts = [words.slice(0, Math.ceil(words.length / 3)), words.slice(Math.ceil(words.length / 3), Math.ceil((2 * words.length) / 3)), words.slice(Math.ceil((2 * words.length) / 3))].map((w) => w.join(' '));
      // fragments go to dead ends far from the start (never the exit)
      const exit = n * n - 1;
      const ends = cells.map((w, i) => ({ i, d: (i % n) + ((i / n) | 0) })).filter((c) => c.i !== 0 && c.i !== exit && cells[c.i].reduce((a, b) => a + b, 0) === 3).sort((a, b) => b.d - a.d);
      const spots = (ends.length >= 3 ? ends : cells.map((_, i) => ({ i })).filter((c) => c.i !== 0 && c.i !== exit)).slice(0, 8).sort(() => Math.random() - 0.5).slice(0, 3).map((c) => c.i);
      let pos = 0, got = [], moves = 0, over = false;
      const t0 = performance.now();
      const bar = timerBar();
      const info = h('p', { class: 'quiz__count' });
      const found = h('p', { class: 'labi__verse' });
      const grid = h('div', { class: 'labi__grid', style: { gridTemplateColumns: `repeat(${n}, 1fr)` }, role: 'grid', 'aria-label': 'Labirinto' });
      const els = cells.map((w, i) => h('div', { class: `labi__cell${w[0] ? ' t' : ''}${w[1] ? ' r' : ''}${w[2] ? ' b' : ''}${w[3] ? ' l' : ''}` }));
      grid.append(...els);
      const paint = () => {
        els.forEach((e, i) => { e.textContent = i === pos ? '🧑' : spots.includes(i) && !got.includes(i) ? '📜' : i === exit ? (got.length === 3 ? '🚪' : '🔒') : ''; });
        info.textContent = `Fragmentos ${got.length}/3 · ${got.length === 3 ? 'vá para a saída 🚪' : 'ache os pergaminhos 📜'}`;
        found.textContent = got.length ? `"${parts.slice(0, got.length).join(' ')}${got.length < 3 ? '…' : '"'}` : '';
      };
      const move = (k) => {
        if (over) return;
        const x = pos % n, y = (pos / n) | 0;
        const [dx, dy] = [[0, -1], [1, 0], [0, 1], [-1, 0]][k];
        if (cells[pos][k]) { env.sfx && env.sfx('wrong'); return; }
        pos = (y + dy) * n + x + dx; moves++;
        env.sfx && env.sfx('click');
        if (spots.includes(pos) && !got.includes(pos)) { got.push(pos); env.sfx && env.sfx('correct'); }
        paint();
        if (pos === exit && got.length === 3) finish(true);
      };
      const pad = h('div', { class: 'labi__pad' },
        ...[['▲', 0, 'Cima'], ['◀', 3, 'Esquerda'], ['▶', 1, 'Direita'], ['▼', 2, 'Baixo']].map(([t, k, l]) => h('button', { class: `btn btn--small labi__k labi__k${k}`, text: t, 'aria-label': l, onClick: () => move(k) })));
      const keys = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, KeyW: 0, KeyD: 1, KeyS: 2, KeyA: 3 };
      const onKey = (e) => { if (e.code in keys) { e.preventDefault(); move(keys[e.code]); } };
      window.addEventListener('keydown', onKey);
      let sx = 0, sy = 0;
      grid.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
      grid.addEventListener('pointerup', (e) => { const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.max(Math.abs(dx), Math.abs(dy)) > 24) move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0)); });
      wrap.replaceChildren(info, bar.el, h('div', { class: 'labi__play' }, grid, pad), found);
      paint();
      const tick = () => {
        if (over || !wrap.isConnected) { window.removeEventListener('keydown', onKey); return; }
        const left = 1 - (performance.now() - t0) / (seconds * 1000);
        bar.set(left);
        if (left <= 0) { finish(false); return; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      function finish(won) {
        over = true;
        window.removeEventListener('keydown', onKey);
        const secs = Math.round((performance.now() - t0) / 1000);
        resultScreen(wrap, {
          passed: won,
          big: won ? `${secs}s` : '⏳',
          title: won ? 'Você achou o caminho!' : 'O tempo acabou',
          note: won ? `"${verse.text}" (${verse.ref})` : 'Junte os 3 pergaminhos e corra para a saída. Tente de novo!',
          onContinue: () => resolve({ success: true, score: Math.max(60, Math.min(100, 100 - Math.max(0, secs - seconds / 2))), correct: 3 }),
          onRetry: play,
        });
      }
    };
    play();
  });
}
