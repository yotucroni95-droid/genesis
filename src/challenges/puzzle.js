// Picture puzzle: a Bible illustration cut into 3x3 pieces. Tap two pieces
// to swap them, or drag one onto another, until the picture is complete.

import { h } from '../ui/dom.js';
import { shuffle, resultPanel } from './shared.js';

const N = 3;

function scrambled(count) {
  let order;
  do { order = shuffle([...Array(count).keys()]); } while (order.every((v, i) => v === i) || order.filter((v, i) => v === i).length > 2);
  return order;
}

export function start(config, env) {
  const id = config.image || 'puzzle.criacao';
  const entry = env.assets.entry(id) || { w: 3, h: 2 };
  const url = env.assets.url(id);
  const ratio = entry.w / entry.h;
  const wrap = h('div', { class: 'puzzle' });
  env.root.appendChild(wrap);

  return new Promise((resolve) => {
    let order = scrambled(N * N); // order[slot] = piece number
    let moves = 0;
    let selected = -1;
    const info = h('div', { class: 'memory__info' });
    const board = h('div', { class: 'puzzle__board' });
    const peek = h('img', { class: 'pixel puzzle__peek', src: url, alt: 'Imagem completa', hidden: true });
    const peekBtn = h('button', { class: 'btn btn--ghost', text: 'Ver a imagem', onClick: () => { peek.hidden = !peek.hidden; peekBtn.textContent = peek.hidden ? 'Ver a imagem' : 'Esconder'; } });

    const slots = order.map((_, slot) => h('div', { class: 'piece', 'data-slot': String(slot) }));
    const paint = () => slots.forEach((el, slot) => {
      const p = order[slot];
      el.style.backgroundImage = `url("${url}")`;
      el.style.backgroundPosition = `${(p % N) * 50}% ${Math.floor(p / N) * 50}%`;
      el.classList.toggle('is-right', p === slot);
      el.classList.toggle('is-selected', slot === selected);
    });
    const updateInfo = () => { info.textContent = `Trocas: ${moves} · Peças no lugar: ${order.filter((v, i) => v === i).length} de ${N * N}`; };

    function swap(a, b) {
      if (a === b) return;
      [order[a], order[b]] = [order[b], order[a]];
      moves += 1;
      selected = -1;
      paint();
      updateInfo();
      if (order.every((v, i) => v === i)) {
        board.classList.add('is-done');
        setTimeout(() => wrap.replaceChildren(
          h('img', { class: 'pixel puzzle__final', src: url, alt: '' }),
          resultPanel({
            big: `${moves} trocas`, title: 'Imagem completa!',
            note: 'Cada pedaço da história se encaixa no plano de Deus.',
            button: 'Continuar',
            onClick: () => resolve({ success: true, score: Math.max(20, Math.round(100 - Math.max(0, moves - 8) * 6)) }),
          }),
        ), 700);
      }
    }

    // tap-to-swap and drag-to-swap with pointer events
    let drag = null;
    board.addEventListener('pointerdown', (e) => {
      const el = e.target.closest('.piece');
      if (!el) return;
      e.preventDefault();
      drag = { slot: Number(el.dataset.slot), x: e.clientX, y: e.clientY, moved: false, el };
      try { el.setPointerCapture(e.pointerId); } catch { /* some browsers refuse; dragging still works */ }
    });
    board.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.hypot(dx, dy) > 8) drag.moved = true;
      if (drag.moved) { drag.el.style.transform = `translate(${dx}px, ${dy}px) scale(1.05)`; drag.el.style.zIndex = '2'; }
    });
    const endDrag = (e) => {
      if (!drag) return;
      const { slot, moved, el } = drag;
      el.style.transform = '';
      el.style.zIndex = '';
      drag = null;
      if (moved) {
        el.style.visibility = 'hidden';
        const under = document.elementFromPoint(e.clientX, e.clientY);
        el.style.visibility = '';
        const target = under && under.closest('.piece');
        if (target) swap(slot, Number(target.dataset.slot));
        return;
      }
      if (selected < 0) { selected = slot; paint(); } else if (selected === slot) { selected = -1; paint(); } else swap(selected, slot);
    };
    board.addEventListener('pointerup', endDrag);
    board.addEventListener('pointercancel', () => { if (drag) { drag.el.style.transform = ''; drag = null; } });

    board.replaceChildren(...slots);
    wrap.replaceChildren(
      h('div', { class: 'puzzle__side' }, info, h('p', { class: 'screen__note', text: 'Toque em duas peças para trocá-las de lugar, ou arraste uma até a outra.' }), peekBtn, peek),
      board,
    );
    paint();
    updateInfo();
    requestAnimationFrame(() => {
      const area = env.root.getBoundingClientRect();
      const maxH = Math.max(150, window.innerHeight - area.top - 40);
      const maxW = area.width * 0.62;
      const w = Math.min(maxW, maxH * ratio);
      board.style.width = `${Math.floor(w)}px`;
      board.style.height = `${Math.floor(w / ratio)}px`;
    });
  });
}
