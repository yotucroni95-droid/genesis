// Configurações: volume (música, efeitos, dublagem), lembretes, conta e tamanho do texto.
// Everything is saved in this phone only (localStorage); nothing changes the save.

import { h } from '../ui/dom.js';
import { gameScreen } from '../ui/screen.js';
import { toast } from '../ui/toast.js';
import { Starfield } from './starfield.js';
import { getVolume, setVolume, unlockAudio, sfx } from '../audio/audio.js';
import { pushStatus, enablePush, disablePush, PUSH_TEXT } from '../cloud/push.js';
import { openAccountMenu } from '../cloud/account-ui.js';
import { cloudOn } from '../cloud/account.js';

const TEXT_KEY = 'genesis.textSize';
const TEXT_SIZES = [['normal', 'Normal', 1], ['grande', 'Grande', 1.15]];

/** Applies the saved text size (called on boot and when it changes). */
export function applyTextSize() {
  let id = 'normal';
  try { id = localStorage.getItem(TEXT_KEY) || 'normal'; } catch { /* storage blocked */ }
  const size = TEXT_SIZES.find((t) => t[0] === id) || TEXT_SIZES[0];
  document.documentElement.style.setProperty('--fs', String(size[2]));
  return size[0];
}

export function createSettingsScene(game) {
  const stars = new Starfield(90);
  return {
    enter(params, ui) {
      const row = (label, control) => h('div', { class: 'set-row' }, h('span', { class: 'set-label', text: label }), control);

      const slider = (part, label) => {
        const out = h('b', { class: 'set-val' });
        const input = h('input', { type: 'range', min: '0', max: '100', step: '5', class: 'set-range', 'aria-label': label });
        input.value = String(Math.round(getVolume()[part] * 100));
        const paint = () => { out.textContent = `${input.value}%`; };
        input.addEventListener('input', () => { unlockAudio(); setVolume(part, Number(input.value) / 100); paint(); });
        input.addEventListener('change', () => { if (part === 'sfx') sfx('click'); });
        paint();
        return row(label, h('div', { class: 'set-slider' }, input, out));
      };

      const textBtns = h('div', { class: 'set-choice' });
      const paintText = () => {
        const cur = applyTextSize();
        textBtns.replaceChildren(...TEXT_SIZES.map(([id, label]) => h('button', {
          class: `btn btn--small${id === cur ? '' : ' btn--ghost'}`, text: label,
          onClick: () => { try { localStorage.setItem(TEXT_KEY, id); } catch { /* ignore */ } paintText(); },
        })));
      };
      paintText();

      const bell = h('button', { class: 'btn btn--small btn--ghost', text: '...' });
      const paintBell = (st) => {
        bell.disabled = st === 'none';
        bell.textContent = st === 'on' ? '🔔 Ligados' : st === 'none' ? 'Indisponível' : '🔕 Desligados';
        bell.onclick = async () => {
          bell.disabled = true;
          const next = st === 'on' ? await disablePush() : await enablePush().catch(() => 'off');
          if (next === 'on') toast('🔔 Lembretes ligados! No máximo 1 aviso por dia.');
          else if (PUSH_TEXT[next]) toast(PUSH_TEXT[next], { ms: 7000 });
          paintBell(next);
        };
      };
      pushStatus().then(paintBell).catch(() => paintBell('none'));

      const account = h('button', { class: 'btn btn--small btn--ghost', text: '☁️ Minha conta', onClick: () => openAccountMenu(game) });

      const body = h('div', { class: 'settings' },
        h('h2', { class: 'set-title', text: '🔊 Som' }),
        slider('music', 'Música'),
        slider('sfx', 'Efeitos'),
        slider('voice', 'Dublagem'),
        h('h2', { class: 'set-title', text: '⚙️ Geral' }),
        row('Tamanho do texto', textBtns),
        row('Lembretes', bell),
        cloudOn() ? row('Conta e código', account) : null,
      );
      ui.appendChild(gameScreen(game, 'Configurações', body, { back: params.back || 'lobby' }));
    },
    update(dt) { stars.update(dt); },
    render(ctx, d) { stars.render(ctx, d.width, d.height); },
  };
}
