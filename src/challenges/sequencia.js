// "Siga a sequência": the symbols light up in order; repeat them. Every round
// the sequence grows by one and plays a little faster.
// config: { symbols: [{ icon, label }], goal, intro, hard }

import { h } from '../ui/dom.js';
import { resultScreen } from './result.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function start(config, env) {
  const wrap = h('div', { class: 'quiz seq' });
  env.root.appendChild(wrap);
  const symbols = (config.symbols && config.symbols.length >= 3) ? config.symbols : [{ icon: '☁️', label: 'Nuvem' }, { icon: '🔥', label: 'Fogo' }, { icon: '⛺', label: 'Tenda' }, { icon: '🐑', label: 'Ovelha' }];
  const goal = (config.goal || 6) + (config.hard ? 2 : 0);
  return new Promise((resolve) => {
    const play = () => {
      const seq = [];
      let lives = 2;
      let best = 0;
      const status = h('p', { class: 'quiz__count' });
      const say = h('h2', { class: 'quiz__q', text: config.intro || 'Observe e repita a sequência!' });
      const pads = symbols.map((s, i) => h('button', { class: 'seq__pad', 'data-i': i, disabled: true }, h('span', { class: 'seq__icon', text: s.icon }), h('small', { text: s.label })));
      wrap.replaceChildren(status, say, h('div', { class: 'seq__grid' }, ...pads));
      const paint = () => { status.textContent = `Sequência ${seq.length} de ${goal} · ${'❤️'.repeat(lives)}`; };
      const lit = async (i, ms) => { pads[i].classList.add('is-lit'); env.sfx && env.sfx('click'); await wait(ms); pads[i].classList.remove('is-lit'); };
      const round = async () => {
        if (!wrap.isConnected) return;
        seq.push(Math.floor(Math.random() * symbols.length));
        paint();
        say.textContent = 'Observe...';
        pads.forEach((p) => { p.disabled = true; });
        await wait(600);
        const ms = Math.max(260, 620 - seq.length * 45 - (config.hard ? 80 : 0));
        for (const i of seq) { if (!wrap.isConnected) return; await lit(i, ms); await wait(ms * 0.45); }
        say.textContent = 'Sua vez!';
        pads.forEach((p) => { p.disabled = false; });
        let k = 0;
        await new Promise((done) => {
          pads.forEach((p, i) => {
            p.onclick = () => {
              lit(i, 180);
              if (i === seq[k]) {
                k += 1;
                if (k === seq.length) { pads.forEach((q) => { q.onclick = null; q.disabled = true; }); best = seq.length; env.sfx && env.sfx('correct'); done(); }
              } else {
                lives -= 1;
                env.sfx && env.sfx('wrong');
                pads.forEach((q) => { q.onclick = null; q.disabled = true; });
                if (lives <= 0) { done(); return; }
                say.textContent = 'Errou! Veja de novo...';
                seq.pop(); // the same length again
                done();
              }
            };
          });
        });
        if (lives <= 0) { finish(false); return; }
        if (best >= goal) { finish(true); return; }
        round();
      };
      const finish = (won) => {
        const score = won ? Math.min(100, 70 + lives * 15) : 0;
        resultScreen(wrap, {
          passed: won,
          big: `${best}/${goal}`,
          title: won ? 'Você seguiu o caminho certo!' : 'Ops, a sequência se perdeu',
          note: won ? 'De dia a nuvem, de noite o fogo: Deus guiava o povo (Êxodo 13:21).' : 'Preste atenção na ordem e tente de novo!',
          onContinue: () => resolve({ success: true, score, correct: best }),
          onRetry: play,
        });
      };
      paint();
      setTimeout(round, 500);
    };
    play();
  });
}
