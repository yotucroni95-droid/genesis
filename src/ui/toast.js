import { h } from './dom.js';
import { sfx } from '../audio/audio.js';

/** Small message that slides in at the top and disappears by itself. */
export function toast(text, { icon = '', ms = 2600 } = {}) {
  const root = document.getElementById('game');
  const el = h('div', { class: 'toast', role: 'status' }, icon ? h('img', { class: 'pixel', src: icon, alt: '' }) : null, h('span', { text }));
  root.appendChild(el);
  sfx('notify');
  requestAnimationFrame(() => el.classList.add('is-in'));
  setTimeout(() => { el.classList.remove('is-in'); setTimeout(() => el.remove(), 400); }, ms);
}
