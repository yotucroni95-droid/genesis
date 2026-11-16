// "Ordem certa": tap the events of the story in the right order.
// config: { title, ref, items (in the right order), count }

import { h } from '../ui/dom.js';
import { shuffle } from './shared.js';
import { resultScreen } from './result.js';

export function start(config, env) {
  const all = config.items || [];
  const wrap = h('div', { class: 'quiz ordem' });
  env.root.appendChild(wrap);
  return new Promise((resolve) => {
    const play = () => {
      // keep the story order but use only some events when the list is long
      const count = Math.min(all.length, config.count || 5);
      const start0 = Math.floor(Math.random() * (all.length - count + 1));
      const items = all.slice(start0, start0 + count);
      let next = 0;
      let mistakes = 0;
      const placed = h('ol', { class: 'ordem__done' });
      const hint = h('p', { class: 'screen__note', text: 'Toque nos acontecimentos na ordem em que aconteceram.' });
      const buttons = shuffle(items.map((text, i) => ({ text, i }))).map((it) => {
        const b = h('button', { class: 'quiz__opt', onClick: () => {
          if (it.i === next) {
            env.sfx && env.sfx('correct');
            b.remove();
            placed.appendChild(h('li', { text: it.text }));
            next += 1;
            if (next === items.length) finish();
          } else {
            mistakes += 1;
            env.sfx && env.sfx('wrong');
            b.classList.remove('is-shake'); void b.offsetWidth; b.classList.add('is-shake', 'is-wrong');
            setTimeout(() => b.classList.remove('is-wrong'), 500);
            hint.textContent = `Ops! Ainda não é esse. Erros: ${mistakes}`;
          }
        } }, it.text);
        return b;
      });
      wrap.replaceChildren(
        h('h2', { class: 'quiz__q', text: config.title || 'Coloque na ordem' }),
        hint,
        placed,
        h('div', { class: 'quiz__opts ordem__opts' }, ...buttons),
      );
      function finish() {
        const score = Math.max(0, 100 - mistakes * 20);
        const passed = mistakes <= 3;
        resultScreen(wrap, {
          passed,
          big: mistakes === 0 ? 'Perfeito!' : `${mistakes} ${mistakes === 1 ? 'erro' : 'erros'}`,
          note: passed ? (config.doneNote || `Leia a história completa em ${config.ref}.`) : (config.failNote || `Muitos erros. Releia ${config.ref} e tente de novo!`),
          onContinue: () => resolve({ success: true, score, correct: items.length - Math.min(items.length, mistakes) }),
          onRetry: play,
        });
      }
    };
    play();
  });
}
