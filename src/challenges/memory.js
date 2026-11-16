// Memory match: face-down cards with character portraits. Flip two at a
// time and find every pair. Moves are counted; fewer moves = higher score.

import { h } from '../ui/dom.js';
import { shuffle, characterPicture, characterName, resultPanel } from './shared.js';

function bestGrid(n, width, height) {
  // choose the column count that gives the biggest cards (3:4 shape)
  let best = { cols: n, size: 0 };
  for (let cols = 2; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const w = Math.min((width - (cols - 1) * 8) / cols, ((height - (rows - 1) * 8) / rows) * 0.75);
    if (w > best.size) best = { cols, size: w };
  }
  return best;
}

export function start(config, env) {
  const pairs = config.pairs || [];
  const back = env.assets.url('ui.card_back');
  const wrap = h('div', { class: 'memory' });
  env.root.appendChild(wrap);

  return new Promise((resolve) => {
    let moves = 0;
    let found = 0;
    let open = [];
    let busy = false;

    const counter = h('div', { class: 'memory__info' });
    const board = h('div', { class: 'memory__board' });
    const updateInfo = () => { counter.textContent = `Jogadas: ${moves} · Pares: ${found} de ${pairs.length}`; };

    const deck = shuffle(pairs.flatMap((ref, i) => [i, i]).map((pair) => ({ pair, ref: pairs[pair] })));
    const cards = deck.map((card) => {
      const el = h('button', { class: 'card', 'aria-label': 'Carta virada' },
        h('div', { class: 'card__inner' },
          h('div', { class: 'card__face card__back' }, back ? h('img', { class: 'pixel', src: back, alt: '' }) : null),
          h('div', { class: 'card__face card__front' },
            h('img', { class: 'pixel', src: characterPicture(env.assets, card.ref), alt: '' }),
            h('span', { text: characterName(env.assets, card.ref) }),
          ),
        ),
      );
      el.addEventListener('click', () => flip(el, card));
      return el;
    });

    function flip(el, card) {
      if (busy || el.classList.contains('is-up')) return;
      el.classList.add('is-up');
      el.setAttribute('aria-label', characterName(env.assets, card.ref));
      open.push({ el, card });
      if (open.length < 2) return;
      moves += 1;
      const [a, b] = open;
      open = [];
      if (a.card.pair === b.card.pair) {
        found += 1;
        a.el.classList.add('is-found');
        b.el.classList.add('is-found');
        updateInfo();
        if (found === pairs.length) setTimeout(finish, 600);
        return;
      }
      busy = true;
      updateInfo();
      setTimeout(() => {
        a.el.classList.remove('is-up');
        b.el.classList.remove('is-up');
        a.el.setAttribute('aria-label', 'Carta virada');
        b.el.setAttribute('aria-label', 'Carta virada');
        busy = false;
      }, 850);
    }

    function finish() {
      const perfect = config.goodMoves || pairs.length; // moves that still count as perfect
      const score = Math.max(10, Math.round((perfect / moves) * 100));
      wrap.replaceChildren(resultPanel({
        big: `${moves} jogadas`,
        title: 'Você achou todos os pares!',
        note: moves <= perfect + 2 ? 'Que memória!' : 'Muito bem! Jogando de novo dá para fazer em menos jogadas.',
        button: 'Continuar',
        onClick: () => resolve({ success: true, score }),
      }));
    }

    board.replaceChildren(...cards);
    wrap.replaceChildren(counter, board);
    updateInfo();
    // size the cards to fit the screen
    requestAnimationFrame(() => {
      const area = env.root.getBoundingClientRect();
      const height = Math.max(160, window.innerHeight - area.top - 50);
      const { cols, size } = bestGrid(cards.length, area.width, height);
      board.style.gridTemplateColumns = `repeat(${cols}, ${Math.floor(size)}px)`;
    });
  });
}
