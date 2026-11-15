// Quiz: 3 to 5 multiple-choice questions about the story. After each answer
// a short explanation with the verse is shown. A minimum score is needed to
// pass, and the player can try again as many times as needed.

import { h } from '../ui/dom.js';

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function start(config, env) {
  const questions = config.questions || [];
  const minScore = config.minScore ?? Math.ceil(questions.length * 0.6);
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
      const buttons = opts.map((o) => h('button', {
        class: 'quiz__opt',
        onClick: () => {
          buttons.forEach((b) => { b.disabled = true; });
          const chosen = buttons[opts.indexOf(o)];
          if (o.correct) score += 1;
          env.sfx && env.sfx(o.correct ? 'correct' : 'wrong');
          chosen.classList.add(o.correct ? 'is-right' : 'is-wrong');
          buttons[opts.findIndex((x) => x.correct)].classList.add('is-right');
          feedback.hidden = false;
          feedback.replaceChildren(
            h('strong', { text: o.correct ? 'Isso mesmo!' : 'Quase!' }),
            h('p', { text: q.explain }),
            h('span', { class: 'verse' }, h('img', { class: 'pixel', src: env.assets.url('icon.livro'), alt: '' }), q.verse),
            h('button', { class: 'btn', text: index < questions.length - 1 ? 'Próxima pergunta' : 'Ver resultado', onClick: () => { index += 1; if (index < questions.length) showQuestion(); else showResult(); } }),
          );
        },
      }, o.text));
      wrap.replaceChildren(
        h('div', { class: 'quiz__progress' },
          ...questions.map((_, i) => h('span', { class: i < index ? 'is-done' : i === index ? 'is-now' : '' }))),
        h('div', { class: 'quiz__count', text: `Pergunta ${index + 1} de ${questions.length}` }),
        h('h2', { class: 'quiz__q', text: q.q }),
        h('div', { class: 'quiz__opts' }, ...buttons),
        feedback,
      );
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
            : h('button', { class: 'btn', text: 'Tentar de novo', onClick: () => { index = 0; score = 0; showQuestion(); } }),
        ),
      );
    };

    showQuestion();
  });
}
