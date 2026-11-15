import { h } from './dom.js';
import { isMuted, toggleMuted, unlockAudio } from '../audio/audio.js';

/** 🔊 / 🔇 button: one tap silences music, effects and the narrator. */
export function muteButton() {
  const b = h('button', { class: 'btn btn--ghost btn--icon mute', 'aria-label': 'Ligar ou desligar o som', title: 'Som' });
  const paint = () => { b.textContent = isMuted() ? '🔇' : '🔊'; b.classList.toggle('is-off', isMuted()); };
  b.addEventListener('click', (e) => { e.stopPropagation(); unlockAudio(); toggleMuted(); paint(); });
  paint();
  return b;
}
