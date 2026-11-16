// Shared end screen for the new challenges: score, message, continue/retry.

import { h } from '../ui/dom.js';

export function resultScreen(wrap, { passed, big, title, note, onContinue, onRetry }) {
  wrap.replaceChildren(h('div', { class: 'quiz__result' },
    h('div', { class: 'quiz__score', text: big }),
    h('h2', { class: 'quiz__q', text: title || (passed ? 'Muito bem!' : 'Quase lá!') }),
    note ? h('p', { class: 'screen__note', text: note }) : null,
    passed ? h('button', { class: 'btn', text: 'Continuar', onClick: onContinue })
      : h('button', { class: 'btn', text: 'Tentar de novo', onClick: onRetry }),
  ));
}

export function timerBar() {
  const fill = h('div', { class: 'arena__timefill' });
  const el = h('div', { class: 'arena__timer' }, fill);
  return { el, set(f) { fill.style.width = `${Math.max(0, Math.min(1, f)) * 100}%`; el.classList.toggle('is-low', f < 0.3); } };
}
