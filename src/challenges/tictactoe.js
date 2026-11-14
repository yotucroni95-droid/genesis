// Tic-tac-toe against a simple computer that can be beaten.
// config.difficulty (0 to 1): how often the computer plays its best move.
// A draw or a loss lets the player try again; winning once completes it.

import { h } from '../ui/dom.js';
import { resultPanel } from './shared.js';

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

function winner(b) {
  for (const [a, c, d] of LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return { mark: b[a], line: [a, c, d] };
  return b.every(Boolean) ? { mark: 'draw' } : null;
}

function minimax(b, turn) {
  const w = winner(b);
  if (w) return { score: w.mark === 'O' ? 1 : w.mark === 'X' ? -1 : 0 };
  let best = { score: turn === 'O' ? -2 : 2, move: -1 };
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    b[i] = turn;
    const r = minimax(b, turn === 'O' ? 'X' : 'O');
    b[i] = null;
    if ((turn === 'O' && r.score > best.score) || (turn === 'X' && r.score < best.score)) best = { score: r.score, move: i };
  }
  return best;
}

function computerMove(b, difficulty) {
  const free = b.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  if (Math.random() < difficulty) return minimax(b.slice(), 'O').move;
  // otherwise: grab a winning move half of the time, else play anywhere
  for (const i of free) {
    const t = b.slice(); t[i] = 'O';
    if (winner(t) && winner(t).mark === 'O' && Math.random() < 0.5) return i;
  }
  return free[Math.floor(Math.random() * free.length)];
}

export function start(config, env) {
  const difficulty = config.difficulty ?? 0.3;
  const wrap = h('div', { class: 'ttt' });
  env.root.appendChild(wrap);

  return new Promise((resolve) => {
    let wins = 0;
    let rounds = 0;

    function play() {
      const board = Array(9).fill(null);
      let locked = false;
      rounds += 1;
      const status = h('div', { class: 'ttt__status', text: 'Sua vez: você é a luz ✦' });
      const cells = board.map((_, i) => h('button', { class: 'ttt__cell', 'aria-label': `Casa ${i + 1}`, onClick: () => playerMove(i) }));
      const paint = () => cells.forEach((c, i) => {
        c.replaceChildren();
        c.classList.toggle('is-x', board[i] === 'X');
        c.classList.toggle('is-o', board[i] === 'O');
        if (board[i] === 'X') c.appendChild(h('span', { class: 'ttt__light', 'aria-label': 'luz', text: '✦' }));
        if (board[i] === 'O') c.appendChild(h('span', { class: 'ttt__shadow', 'aria-label': 'sombra' }));
      });

      function end(w) {
        locked = true;
        if (w.line) w.line.forEach((i) => cells[i].classList.add('is-line'));
        setTimeout(() => {
          if (w.mark === 'X') {
            wins += 1;
            wrap.replaceChildren(resultPanel({
              big: '✦', title: 'A luz venceu!',
              note: rounds === 1 ? 'Vitória de primeira!' : `Você venceu na partida ${rounds}.`,
              button: 'Continuar',
              onClick: () => resolve({ success: true, score: Math.max(40, 100 - (rounds - 1) * 15) }),
            }));
          } else {
            wrap.replaceChildren(resultPanel({
              title: w.mark === 'draw' ? 'Empate!' : 'A sombra ganhou desta vez.',
              note: 'Tente de novo: pense duas jogadas à frente!',
              button: 'Jogar de novo',
              onClick: play,
            }));
          }
        }, 900);
      }

      function playerMove(i) {
        if (locked || board[i]) return;
        board[i] = 'X';
        paint();
        let w = winner(board);
        if (w) { end(w); return; }
        locked = true;
        status.textContent = 'A sombra está pensando...';
        setTimeout(() => {
          board[computerMove(board, difficulty)] = 'O';
          paint();
          w = winner(board);
          if (w) { end(w); return; }
          locked = false;
          status.textContent = 'Sua vez: você é a luz ✦';
        }, 550);
      }

      wrap.replaceChildren(status, h('div', { class: 'ttt__board' }, ...cells));
      paint();
    }

    play();
  });
}
