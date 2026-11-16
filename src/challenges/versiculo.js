// "Complete o versículo": choose the word that is missing.
// config: { verses: [{ text, ref }], count }

import { h } from '../ui/dom.js';
import { shuffle } from './shared.js';
import { resultScreen } from './result.js';

const clean = (w) => w.replace(/[.,;:!?"“”()]/g, '');

function blankWord(text) {
  const words = text.split(' ').map(clean).filter((w) => w.length >= 4 && !/^(para|como|pelo|pela|sobre|entre|depois|quando|porque|todo|toda|todos|isso|este|esta|disse|seus|suas)$/i.test(w));
  return words.length ? words[Math.floor(Math.random() * words.length)] : clean(text.split(' ')[0]);
}

export function start(config, env) {
  const wrap = h('div', { class: 'quiz versiculo' });
  env.root.appendChild(wrap);
  return new Promise((resolve) => {
    const play = () => {
      const list = shuffle(config.verses || []).slice(0, config.count || 3);
      const pool = (config.verses || []).flatMap((v) => v.text.split(' ').map(clean)).filter((w) => w.length >= 4);
      let i = 0;
      let right = 0;
      const ask = () => {
        if (i >= list.length) { finish(); return; }
        const v = list[i];
        const answer = blankWord(v.text);
        const wrongs = shuffle([...new Set(pool.filter((w) => w.toLowerCase() !== answer.toLowerCase()))]).slice(0, 3);
        const opts = shuffle([answer, ...wrongs]);
        const masked = v.text.replace(answer, '_____');
        let tries = 0;
        wrap.replaceChildren(
          h('div', { class: 'quiz__count', text: `Versículo ${i + 1} de ${list.length}` }),
          h('div', { class: 'verse-card daily__card' }, h('p', { class: 'verse-card__text', text: masked }), h('b', { class: 'verse-card__ref', text: v.ref })),
          h('h2', { class: 'quiz__q', text: 'Qual palavra completa?' }),
          h('div', { class: 'quiz__opts' }, ...opts.map((o) => h('button', { class: 'quiz__opt', onClick: (e) => {
            const btn = e.currentTarget;
            if (o === answer) {
              if (tries === 0) right += 1;
              env.sfx && env.sfx('correct');
              btn.classList.add('is-right');
              i += 1;
              setTimeout(ask, 900);
            } else {
              tries += 1;
              env.sfx && env.sfx('wrong');
              btn.classList.add('is-wrong');
              btn.disabled = true;
            }
          } }, o))),
        );
      };
      const finish = () => {
        const score = Math.round((right / list.length) * 100);
        resultScreen(wrap, {
          passed: right >= Math.ceil(list.length / 2),
          big: `${right}/${list.length}`,
          note: 'Conta só o que você acertou na primeira tentativa.',
          onContinue: () => resolve({ success: true, score: Math.max(score, 34), correct: right }),
          onRetry: play,
        });
      };
      ask();
    };
    play();
  });
}
