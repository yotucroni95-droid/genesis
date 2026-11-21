// "Verdadeiro ou Falso relâmpago": quick statements against the clock.
// config: { items: [{ s, ok, ref }], count, seconds }

import { h } from '../ui/dom.js';
import { shuffle } from './shared.js';
import { resultScreen, timerBar } from './result.js';

export function start(config, env) {
  const wrap = h('div', { class: 'quiz vf' });
  env.root.appendChild(wrap);
  const seconds = config.seconds || 10;
  let raf = 0;
  return new Promise((resolve) => {
    const play = () => {
      const deck = shuffle(config.items || []).slice(0, config.count || 6);
      let i = 0;
      let right = 0;
      const ask = () => {
        if (i >= deck.length) { finish(); return; }
        const it = deck[i];
        const bar = timerBar();
        let done = false;
        const answer = (val, btn) => {
          if (done) return;
          done = true;
          cancelAnimationFrame(raf);
          const ok = val === it.ok;
          if (ok) right += 1;
          env.sfx && env.sfx(ok ? 'correct' : 'wrong');
          if (btn) btn.classList.add(ok ? 'is-right' : 'is-wrong');
          note.textContent = ok ? 'Isso mesmo!' : `${it.ok ? 'É verdade!' : 'É falso!'} Veja ${it.ref}.`;
          i += 1;
          setTimeout(ask, ok ? 700 : 1700);
        };
        const tBtn = h('button', { class: 'quiz__opt vf__btn vf__btn--v', onClick: () => answer(true, tBtn) }, '✔ Verdadeiro');
        const fBtn = h('button', { class: 'quiz__opt vf__btn vf__btn--f', onClick: () => answer(false, fBtn) }, '✘ Falso');
        const note = h('p', { class: 'screen__note', text: ' ' });
        wrap.replaceChildren(
          h('div', { class: 'quiz__count', text: `${i + 1} de ${deck.length} · acertos: ${right}` }),
          bar.el,
          h('h2', { class: 'quiz__q', text: it.s }),
          h('div', { class: 'quiz__opts' }, tBtn, fBtn),
          note,
        );
        const end = performance.now() + seconds * 1000;
        const tick = () => {
          const left = end - performance.now();
          bar.set(left / (seconds * 1000));
          if (left <= 0) { note.textContent = 'O tempo acabou!'; answer(null, null); return; }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      };
      const finish = () => {
        const score = Math.round((right / deck.length) * 100);
        resultScreen(wrap, {
          passed: score >= 60,
          big: `${right}/${deck.length}`,
          note: score >= 60 ? 'Rápido e certeiro!' : 'Você precisa acertar pelo menos 60%. Tente de novo!',
          onContinue: () => resolve({ success: true, score, correct: right }),
          onRetry: play,
        });
      };
      ask();
    };
    play();
  });
}
