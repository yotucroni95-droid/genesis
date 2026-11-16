// Quiz: 3 to 5 multiple-choice questions about the story. After each answer
// a short explanation with the verse is shown. A minimum score is needed to
// pass, and the player can try again as many times as needed.

import { h } from '../ui/dom.js';
import { timerBar } from './result.js';

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function start(config, env) {
  // config.pool: a bank of questions; a different handful is drawn every time
  const draw = () => (config.pool ? shuffle(config.pool).slice(0, config.count || 5) : config.questions || []);
  let questions = draw();
  const minScore = config.minScore ?? Math.ceil(questions.length * 0.6);
  let raf = 0;
  const wrap = h('div', { class: 'quiz' });
  env.root.appendChild(wrap);

  return new Promise((resolve) => {
    let index = 0;
    let score = 0;

    const showQuestion = () => {
      const q = questions[index];
      // options are shuffled each time so the answer is not memorised by position
      const opts = shuffle(q.options.map((text, i) => ({ text, correct: i === q.answer })));
      const feedback = h('div', { class: 'quiz__feedback', hidden: true });
      const bar = config.timer ? timerBar() : null;
      const choose = (o) => {
          cancelAnimationFrame(raf);
          buttons.forEach((b) => { b.disabled = true; });
          const chosen = o ? buttons[opts.indexOf(o)] : null;
          if (o && o.correct) score += 1;
          env.sfx && env.sfx(o && o.correct ? 'correct' : 'wrong');
          if (chosen) chosen.classList.add(o.correct ? 'is-right' : 'is-wrong');
          buttons[opts.findIndex((x) => x.correct)].classList.add('is-right');
          feedback.hidden = false;
          const nextBtn = h('button', { class: 'btn', disabled: true, text: index < questions.length - 1 ? 'Próxima pergunta' : 'Ver resultado', onClick: () => { index += 1; if (index < questions.length) showQuestion(); else showResult(); } });
          feedback.replaceChildren(
            h('strong', { text: !o ? 'O tempo acabou!' : o.correct ? 'Isso mesmo!' : 'Quase!' }),
            q.explain ? h('p', { text: q.explain }) : null,
            h('span', { class: 'verse' }, h('img', { class: 'pixel', src: env.assets.url('icon.livro'), alt: '' }), q.verse),
            nextBtn,
          );
          // a short pause so the explanation and the verse are read
          setTimeout(() => { nextBtn.disabled = false; }, Math.min(5000, Math.max(1800, (q.explain || '').length * 45)));
      };
      const buttons = opts.map((o) => h('button', { class: 'quiz__opt', onClick: () => choose(o) }, o.text));
      wrap.replaceChildren(
        h('div', { class: 'quiz__progress' },
          ...questions.map((_, i) => h('span', { class: i < index ? 'is-done' : i === index ? 'is-now' : '' }))),
        h('div', { class: 'quiz__count', text: `Pergunta ${index + 1} de ${questions.length}` }),
        bar ? bar.el : null,
        h('h2', { class: 'quiz__q', text: q.q }),
        h('div', { class: 'quiz__opts' }, ...buttons),
        feedback,
      );
      if (bar) {
        const end = performance.now() + config.timer * 1000;
        const tick = () => {
          const left = end - performance.now();
          bar.set(left / (config.timer * 1000));
          if (left <= 0) { choose(null); return; }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }
    };

    const showResult = () => {
      const passed = score >= minScore;
      wrap.replaceChildren(
        h('div', { class: 'quiz__result' },
          h('div', { class: 'quiz__score', text: `${score}/${questions.length}` }),
          h('h2', { class: 'quiz__q', text: passed ? 'Muito bem!' : 'Quase lá!' }),
          h('p', { class: 'screen__note', text: passed
            ? 'Você conhece bem esta parte da história.'
            : `Você precisa acertar pelo menos ${minScore}. Releia a passagem e tente de novo!` }),
          passed
            ? h('button', { class: 'btn', text: 'Continuar', onClick: () => resolve({ success: true, score: Math.round((score / questions.length) * 100), correct: score }) })
            : h('button', { class: 'btn', text: 'Tentar de novo', onClick: () => { index = 0; score = 0; questions = draw(); showQuestion(); } }),
        ),
      );
    };

    showQuestion();
  });
}
