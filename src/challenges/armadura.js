// "Reflexos: Armadura de Deus" (Efésios 6:13-17). An attack of the enemy
// appears; tap, in time, the piece of the armour that defends against it.
// Each right answer shortens the time. PROVISIONAL look (emoji) until the art arrives.
// config: { goal, lives, hard }

import { h } from '../ui/dom.js';
import { resultScreen, timerBar } from './result.js';
import { shuffle } from './shared.js';

const PIECES = [
  { id: 'cinto', att: 2, icon: '🎗️', label: 'Cinto da verdade', ref: 'Efésios 6:14', attacks: ['Uma mentira!', 'Fofoca sobre o colega', 'Enganar para se dar bem'] },
  { id: 'couraca', att: 3, icon: '🛡️', label: 'Couraça da justiça', ref: 'Efésios 6:14', attacks: ['Fazer algo errado escondido', 'Culpa que acusa', 'Ser injusto com alguém'] },
  { id: 'calcados', att: 1, icon: '👟', label: 'Calçados do evangelho da paz', ref: 'Efésios 6:15', attacks: ['Uma briga começando', 'Vergonha de falar de Jesus', 'Discórdia entre amigos'] },
  { id: 'escudo', att: 0, icon: '🔰', label: 'Escudo da fé', ref: 'Efésios 6:16', attacks: ['🔥 Seta inflamada!', 'Dúvida: "Deus não cuida de você"', 'Medo do amanhã'] },
  { id: 'capacete', att: 1, icon: '⛑️', label: 'Capacete da salvação', ref: 'Efésios 6:17', attacks: ['"Você não tem valor"', 'Desânimo profundo', '"Deus desistiu de você"'] },
  { id: 'espada', att: 2, icon: '🗡️', label: 'Espada do Espírito (a Palavra)', ref: 'Efésios 6:17', attacks: ['"Deus não disse isso…"', 'Tentação para pecar', 'Um ensino falso'] },
];

export function start(config, env) {
  const wrap = h('div', { class: 'quiz armor' });
  env.root.appendChild(wrap);
  const goal = (config.goal || 10) + (config.hard ? 4 : 0);
  return new Promise((resolve) => {
    const play = () => {
      let lives = config.lives || 3, score = 0, over = false, raf = 0;
      const status = h('p', { class: 'quiz__count' });
      const attack = h('div', { class: 'armor__attack', role: 'status', 'aria-live': 'polite' });
      const bar = timerBar();
      const btns = shuffle(PIECES).map((p) => h('button', { class: 'armor__piece', 'data-id': p.id, 'aria-label': p.label }, h('span', { class: `armor__art armor__art--${PIECES.indexOf(p)}`, 'aria-hidden': 'true' }), h('small', { text: p.label })));
      wrap.replaceChildren(status, h('h2', { class: 'quiz__q', text: 'Vista a armadura de Deus! Toque na peça certa.' }), bar.el, attack, h('div', { class: 'armor__grid' }, ...btns));
      const paint = () => { status.textContent = `Defesas ${score}/${goal} · ${'❤️'.repeat(Math.max(0, lives))}`; };
      let cur = null, t0 = 0, win = 0;
      const next = () => {
        if (!wrap.isConnected) return;
        cur = PIECES[Math.floor(Math.random() * PIECES.length)];
        attack.replaceChildren(h('span', { class: `armor__foe armor__foe--${cur.att}`, 'aria-hidden': 'true' }), h('span', { text: cur.attacks[Math.floor(Math.random() * cur.attacks.length)].replace('🔥 ', '') }));
        attack.classList.remove('is-hit', 'is-miss');
        win = Math.max(2200, (config.ms || (config.hard ? 3600 : 4400)) - score * (config.step ?? 200));
        t0 = performance.now();
        cancelAnimationFrame(raf);
        const tick = () => { if (over || !wrap.isConnected) return; const f = 1 - (performance.now() - t0) / win; bar.set(f); if (f <= 0) answer(null); else raf = requestAnimationFrame(tick); };
        raf = requestAnimationFrame(tick);
      };
      const answer = (id) => {
        if (over || !cur) return;
        cancelAnimationFrame(raf);
        const ok = id === cur.id;
        if (ok) { score++; env.sfx && env.sfx('correct'); attack.classList.add('is-hit'); } else { lives--; env.sfx && env.sfx('wrong'); attack.classList.add('is-miss'); attack.replaceChildren(h('span', { class: `armor__art armor__art--${PIECES.indexOf(cur)}`, 'aria-hidden': 'true' }), h('span', { text: `${cur.label} (${cur.ref})` })); }
        cur = null;
        paint();
        if (score >= goal) return finish(true);
        if (lives <= 0) return finish(false);
        setTimeout(next, ok ? 350 : 1300);
      };
      btns.forEach((b) => { b.onclick = () => answer(b.dataset.id); });
      const finish = (won) => {
        over = true;
        resultScreen(wrap, {
          passed: won, big: `${score}/${goal}`,
          title: won ? 'Firme na armadura de Deus!' : 'O inimigo passou desta vez',
          note: '"Vistam toda a armadura de Deus, para poderem ficar firmes contra as ciladas do diabo." (Efésios 6:11)',
          onContinue: () => resolve({ success: true, score: Math.min(100, 60 + lives * 13), correct: score }),
          onRetry: play,
        });
      };
      paint();
      setTimeout(next, 700);
    };
    play();
  });
}
