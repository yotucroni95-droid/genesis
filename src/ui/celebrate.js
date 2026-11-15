// Full-screen celebration with confetti (new rank, new character, chapter done).

import { h } from './dom.js';
import { sfx } from '../audio/audio.js';
import { vibrate } from './game-ui.js';

const COLORS = ['#ffd36e', '#7cf0a6', '#6fe7ff', '#ff8fd0', '#b56dff', '#ffffff'];
const queue = [];
let showing = false;

export function celebrate({ title, subtitle = '', image = '', badge = null }) {
  queue.push({ title, subtitle, image, badge });
  if (!showing) showNext();
}

function showNext() {
  const item = queue.shift();
  if (!item) { showing = false; return; }
  showing = true;
  const confetti = h('div', { class: 'confetti' }, ...Array.from({ length: 70 }, () => h('i', {
    style: {
      left: `${Math.random() * 100}%`,
      background: COLORS[Math.floor(Math.random() * COLORS.length)],
      animationDelay: `${Math.random() * 0.8}s`,
      animationDuration: `${1.8 + Math.random() * 1.6}s`,
      transform: `rotate(${Math.random() * 360}deg)`,
    },
  })));
  const el = h('div', { class: 'celebrate', role: 'dialog' },
    confetti,
    h('div', { class: 'celebrate__rays' }),
    h('div', { class: 'celebrate__box' },
      item.badge || (item.image ? h('img', { class: 'pixel celebrate__img', src: item.image, alt: '' }) : null),
      h('h2', { text: item.title }),
      item.subtitle ? h('p', { text: item.subtitle }) : null,
      h('button', { class: 'btn', text: 'Uhuu!', onClick: () => { el.remove(); showNext(); } }),
    ),
  );
  document.getElementById('game').appendChild(el);
  sfx('fanfare');
  vibrate([80, 60, 80, 60, 200]);
}
