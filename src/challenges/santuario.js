// "Monte o santuário" (Êxodo 40:17-33): put each piece of the tabernacle in
// its place. Tap a piece, then tap where it goes.
// config: { maxErrors, hard (no hints on the places) }

import { h } from '../ui/dom.js';
import { shuffle } from './shared.js';
import { resultScreen } from './result.js';

const PIECES = [
  { id: 'arca', icon: '📦', name: 'Arca da aliança', slot: 'santissimo', ref: 'Êxodo 40:20-21' },
  { id: 'mesa', icon: '🍞', name: 'Mesa dos pães', slot: 'norte', ref: 'Êxodo 40:22-23' },
  { id: 'candelabro', icon: '🕎', name: 'Candelabro', slot: 'sul', ref: 'Êxodo 40:24-25' },
  { id: 'incenso', icon: '💨', name: 'Altar do incenso', slot: 'veu', ref: 'Êxodo 40:26-27' },
  { id: 'bacia', icon: '💧', name: 'Bacia de bronze', slot: 'bacia', ref: 'Êxodo 40:30' },
  { id: 'altar', icon: '🔥', name: 'Altar de bronze', slot: 'entrada', ref: 'Êxodo 40:29' },
];
// places, drawn from west (the Most Holy Place) to east (the entrance)
const SLOTS = [
  { id: 'santissimo', area: 'Lugar Santíssimo', hint: 'Atrás do véu' },
  { id: 'norte', area: 'Lugar Santo', hint: 'Lado norte' },
  { id: 'veu', area: 'Lugar Santo', hint: 'Diante do véu' },
  { id: 'sul', area: 'Lugar Santo', hint: 'Lado sul' },
  { id: 'bacia', area: 'Pátio', hint: 'Entre a tenda e o altar' },
  { id: 'entrada', area: 'Pátio', hint: 'Junto à entrada do pátio' },
];

export function start(config, env) {
  const wrap = h('div', { class: 'quiz sant' });
  env.root.appendChild(wrap);
  const maxErrors = config.maxErrors ?? 3;
  return new Promise((resolve) => {
    const play = () => {
      let errors = 0;
      let chosen = null;
      let placed = 0;
      const note = h('p', { class: 'screen__note', text: 'Toque numa peça e depois no lugar dela.' });
      const count = h('div', { class: 'quiz__count' });
      const paint = () => { count.textContent = `Peças no lugar: ${placed} de ${PIECES.length} · erros: ${errors} de ${maxErrors}`; };
      const pieceBtns = shuffle(PIECES).map((p) => {
        const b = h('button', { class: 'sant__piece', onClick: () => {
          if (b.disabled) return;
          pieceBtns.forEach((x) => x.classList.remove('is-on'));
          b.classList.add('is-on');
          chosen = { p, b };
          env.sfx && env.sfx('click');
        } }, h('span', { class: 'sant__icon', text: p.icon }), h('small', { text: p.name }));
        return b;
      });
      const slotEl = (s) => {
        const el = h('button', { class: `sant__slot sant__slot--${s.id}`, onClick: () => {
          if (!chosen || el.classList.contains('is-done')) return;
          if (chosen.p.slot === s.id) {
            el.classList.add('is-done');
            el.replaceChildren(h('span', { class: 'sant__icon', text: chosen.p.icon }), h('small', { text: chosen.p.name }));
            chosen.b.disabled = true; chosen.b.classList.remove('is-on'); chosen.b.classList.add('is-used');
            note.textContent = `✔ ${chosen.p.name} (${chosen.p.ref})`;
            placed += 1; chosen = null;
            env.sfx && env.sfx('correct');
            paint();
            if (placed === PIECES.length) setTimeout(() => finish(true), 700);
          } else {
            errors += 1;
            env.sfx && env.sfx('wrong');
            el.classList.remove('is-shake'); void el.offsetWidth; el.classList.add('is-shake');
            note.textContent = 'Não é aí. Lembre do caminho: do pátio até o Lugar Santíssimo.';
            paint();
            if (errors > maxErrors) setTimeout(() => finish(false), 500);
          }
        } }, h('small', { class: 'sant__hint', text: config.hard ? '?' : s.hint }));
        return el;
      };
      const zone = (name, cls, slots) => h('div', { class: `sant__zone ${cls}` }, h('b', { text: name }), h('div', { class: 'sant__slots' }, ...slots.map(slotEl)));
      const plan = h('div', { class: 'sant__plan' },
        zone('Lugar Santíssimo', 'sant__zone--holy', SLOTS.filter((s) => s.area === 'Lugar Santíssimo')),
        zone('Lugar Santo', 'sant__zone--santo', SLOTS.filter((s) => s.area === 'Lugar Santo')),
        zone('Pátio', 'sant__zone--patio', SLOTS.filter((s) => s.area === 'Pátio')),
      );
      wrap.replaceChildren(count, plan, h('div', { class: 'sant__pieces' }, ...pieceBtns), note);
      paint();
      const finish = (won) => {
        const score = won ? Math.max(60, 100 - errors * 13) : 0;
        resultScreen(wrap, {
          passed: won,
          big: `${placed}/${PIECES.length}`,
          title: won ? 'O santuário está pronto!' : 'Muitas peças no lugar errado',
          note: won ? 'Moisés fez tudo como o Senhor tinha mandado (Êxodo 40:16).' : 'Leia Êxodo 40:17-33 e tente de novo!',
          onContinue: () => resolve({ success: true, score, correct: placed }),
          onRetry: play,
        });
      };
    };
    play();
  });
}
