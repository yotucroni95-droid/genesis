// "Caça-palavras bíblico": tap the first and the last letter of each word.
// No time limit: finding every word is all it takes (3 stars, mission done).
// config: { words, count, size, hard }

import { h } from '../ui/dom.js';
import { shuffle } from './shared.js';
import { resultScreen } from './result.js';

const LETTERS = 'AAAEEEIIOOUUBCDFGLMNPRSTVJ';

function build(words, size, hard) {
  const dirs = hard ? [[1, 0], [0, 1], [1, 1], [-1, 0], [0, -1], [1, -1]] : [[1, 0], [0, 1], [1, 1]];
  for (let attempt = 0; attempt < 60; attempt++) {
    const grid = Array.from({ length: size }, () => Array(size).fill(''));
    const placed = [];
    let ok = true;
    for (const w of words) {
      let done = false;
      for (let t = 0; t < 200 && !done; t++) {
        const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
        const x0 = Math.floor(Math.random() * size);
        const y0 = Math.floor(Math.random() * size);
        const x1 = x0 + dx * (w.length - 1);
        const y1 = y0 + dy * (w.length - 1);
        if (x1 < 0 || y1 < 0 || x1 >= size || y1 >= size) continue;
        let fits = true;
        for (let k = 0; k < w.length; k++) { const c = grid[y0 + dy * k][x0 + dx * k]; if (c && c !== w[k]) { fits = false; break; } }
        if (!fits) continue;
        for (let k = 0; k < w.length; k++) grid[y0 + dy * k][x0 + dx * k] = w[k];
        placed.push({ w, x0, y0, x1, y1 });
        done = true;
      }
      if (!done) { ok = false; break; }
    }
    if (!ok) continue;
    for (const row of grid) for (let x = 0; x < size; x++) if (!row[x]) row[x] = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    return { grid, placed };
  }
  return null;
}

export function start(config, env) {
  const wrap = h('div', { class: 'quiz caca' });
  env.root.appendChild(wrap);
  return new Promise((resolve) => {
    const play = () => {
      const size = config.size || 8;
      const words = shuffle((config.words || []).filter((w) => w.length <= size)).slice(0, config.count || 5);
      const puzzle = build(words, size, config.hard) || build(words.slice(0, 3), size, false);
      const found = new Set();
      let first = null;
      const t0 = performance.now();
      const cells = [];
      const list = h('div', { class: 'caca__words' });
      const paintWords = () => list.replaceChildren(...puzzle.placed.map((p) => h('span', { class: found.has(p.w) ? 'is-found' : '', text: p.w })));
      const board = h('div', { class: 'caca__grid', style: { '--n': String(size) } });
      puzzle.grid.forEach((row, y) => row.forEach((ch, x) => {
        const c = h('button', { class: 'caca__cell', text: ch, onClick: () => pick(x, y) });
        cells.push(c);
        board.appendChild(c);
      }));
      const cell = (x, y) => cells[y * size + x];
      const pick = (x, y) => {
        if (!first) { first = { x, y }; cell(x, y).classList.add('is-sel'); return; }
        const a = first;
        first = null;
        cell(a.x, a.y).classList.remove('is-sel');
        const hit = puzzle.placed.find((p) => !found.has(p.w) && ((p.x0 === a.x && p.y0 === a.y && p.x1 === x && p.y1 === y) || (p.x1 === a.x && p.y1 === a.y && p.x0 === x && p.y0 === y)));
        if (!hit) { env.sfx && env.sfx('wrong'); return; }
        found.add(hit.w);
        env.sfx && env.sfx('correct');
        const dx = Math.sign(hit.x1 - hit.x0);
        const dy = Math.sign(hit.y1 - hit.y0);
        for (let k = 0; k < hit.w.length; k++) cell(hit.x0 + dx * k, hit.y0 + dy * k).classList.add('is-found');
        paintWords();
        if (found.size === puzzle.placed.length) setTimeout(finish, 500);
      };
      const finish = () => {
        const secs = Math.round((performance.now() - t0) / 1000);
        resultScreen(wrap, {
          passed: true,
          big: `${puzzle.placed.length}/${puzzle.placed.length}`,
          title: 'Você achou todas as palavras!',
          note: `Tempo: ${secs >= 60 ? `${Math.floor(secs / 60)} min ` : ''}${secs % 60} s. Sem pressa: aqui não tem relógio.`,
          onContinue: () => resolve({ success: true, score: 100, correct: puzzle.placed.length }),
        });
      };
      paintWords();
      wrap.replaceChildren(h('div', { class: 'caca__layout' }, board,
        h('div', { class: 'caca__side' },
          h('p', { class: 'screen__note', text: 'Toque na primeira e depois na última letra de cada palavra. Sem limite de tempo!' }),
          list)));
    };
    play();
  });
}
