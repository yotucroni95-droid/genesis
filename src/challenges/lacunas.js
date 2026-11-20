// "Complete as palavras": a verse with blanks; tap the words in the right
// order to fill them. Extra words are there to confuse.
// config: { items: [{ text: 'Honre seu [pai] e sua [mãe].', ref }], extra: [], count, hard }

import { h } from '../ui/dom.js';
import { shuffle } from './shared.js';
import { resultScreen } from './result.js';

export function start(config, env) {
  const wrap = h('div', { class: 'quiz lac' });
  env.root.appendChild(wrap);
  return new Promise((resolve) => {
    const play = () => {
      const deck = shuffle(config.items || []).slice(0, config.count || 3);
      let i = 0;
      let mistakes = 0;
      const ask = () => {
        if (i >= deck.length) { finish(); return; }
        const it = deck[i];
        const parts = it.text.split(/(\[[^\]]+\])/).filter(Boolean);
        const answers = parts.filter((p) => p.startsWith('[')).map((p) => p.slice(1, -1));
        const pool = shuffle((config.extra || []).filter((w) => !answers.includes(w))).slice(0, config.hard ? 5 : 3);
        let k = 0;
        const blanks = [];
        const line = h('p', { class: 'lac__text' }, ...parts.map((p) => {
          if (!p.startsWith('[')) return h('span', { text: p });
          const b = h('span', { class: 'lac__blank', text: '____' });
          blanks.push(b);
          return b;
        }));
        const note = h('p', { class: 'screen__note', text: ' ' });
        const chips = shuffle([...answers, ...pool]).map((w) => {
          const chip = h('button', { class: 'lac__chip', text: w, onClick: () => {
            if (chip.disabled) return;
            if (w === answers[k]) {
              blanks[k].textContent = w;
              blanks[k].classList.add('is-on');
              chip.disabled = true;
              chip.classList.add('is-used');
              k += 1;
              env.sfx && env.sfx('correct');
              if (k === answers.length) { note.textContent = `✔ ${it.ref}`; i += 1; setTimeout(ask, 900); }
            } else {
              mistakes += 1;
              env.sfx && env.sfx('wrong');
              chip.classList.remove('is-shake'); void chip.offsetWidth; chip.classList.add('is-shake');
              note.textContent = 'Essa palavra não vai aí. Leia de novo!';
            }
          } });
          return chip;
        });
        wrap.replaceChildren(
          h('div', { class: 'quiz__count', text: `${i + 1} de ${deck.length} · erros: ${mistakes}` }),
          line,
          h('div', { class: 'lac__chips' }, ...chips),
          note,
        );
      };
      const finish = () => {
        const score = Math.max(0, 100 - mistakes * 12);
        resultScreen(wrap, {
          passed: score >= 60,
          big: `${deck.length - Math.min(deck.length, Math.ceil(mistakes / 2))}/${deck.length}`,
          title: score >= 60 ? 'Palavra guardada no coração!' : 'Muitos erros desta vez',
          note: score >= 60 ? `Erros: ${mistakes}. Que tal decorar um desses versículos?` : 'Você pode errar no máximo 3 palavras. Tente de novo!',
          onContinue: () => resolve({ success: true, score, correct: deck.length }),
          onRetry: play,
        });
      };
      ask();
    };
    play();
  });
}
