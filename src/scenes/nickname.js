// First screen for a new player: choose a gamer-style nickname. No password, no e-mail.

import { h } from '../ui/dom.js';
import { iconButton } from '../ui/icon-button.js';
import { Starfield } from './starfield.js';
import { NICK_RULE, sanitizeNick } from '../save/save-manager.js';
import { ico } from '../ui/game-ui.js';

const FIRST = ['Leao', 'Guerreiro', 'Pastor', 'Arca', 'Luz', 'Estrela', 'Profeta', 'Falcao', 'Sentinela', 'Escudo', 'Trovao', 'Fogo', 'Aguia', 'Raio', 'Semente', 'Cedro', 'Harpa', 'Farol'];
const SECOND = ['DeJuda', 'Fiel', 'DaFe', 'Veloz', 'Valente', 'DoEden', 'Celeste', 'Forte', 'Bravo', 'DeOuro', 'Dourado', 'Sabio', 'Livre', 'Alfa'];

function randomNick() {
  for (let i = 0; i < 20; i++) {
    const a = FIRST[Math.floor(Math.random() * FIRST.length)];
    const b = SECOND[Math.floor(Math.random() * SECOND.length)];
    const n = String(Math.floor(Math.random() * 90) + 10);
    const nick = Math.random() < 0.25 ? `${a}_${n}` : `${a}${b}${n}`;
    if (nick.length <= 16) return nick;
  }
  return `Peregrino${Math.floor(Math.random() * 900) + 100}`;
}

export function createNicknameScene(game) {
  const stars = new Starfield(90);
  return {
    enter(params, ui) {
      const save = game.save;
      const next = params.next || 'lobby';
      const input = h('input', {
        class: 'field__input',
        type: 'text',
        inputmode: 'text',
        autocomplete: 'off',
        autocapitalize: 'off',
        autocorrect: 'off',
        spellcheck: 'false',
        maxlength: '16',
        placeholder: 'ex.: LeaoDeJuda77',
        'aria-label': 'Seu apelido',
      });
      input.value = save.state.nick || '';
      const hint = h('p', { class: 'field__hint', text: '3 a 16 letras, números ou _ (sem acento e sem espaço).' });
      const confirm = h('button', { class: 'btn', text: 'Confirmar' });
      const preview = h('div', { class: 'nick-preview' });

      const refresh = () => {
        const clean = sanitizeNick(input.value);
        if (clean !== input.value) input.value = clean;
        const ok = NICK_RULE.test(clean);
        confirm.disabled = !ok;
        preview.textContent = clean ? `@${clean}` : '@...';
        preview.classList.toggle('is-ok', ok);
      };
      input.addEventListener('input', refresh);

      const submit = () => {
        if (save.setNick(input.value)) game.scenes.go(next);
      };
      confirm.addEventListener('click', submit);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });

      ui.appendChild(
        h('section', { class: 'screen' },
          h('header', { class: 'screen__head' },
            iconButton(game.assets, 'icon.voltar', 'Voltar', () => game.scenes.go('title'), '←'),
            h('h1', { text: 'Seu nome de jogador' }),
          ),
          h('div', { class: 'screen__body nick' },
            h('img', { class: 'pixel nick__portrait', src: game.assets.url(`portrait.${save.state.avatarId}`), alt: '' }),
            preview,
            h('div', { class: 'field' },
              input,
              h('button', { class: 'btn btn--ghost btn--icon', 'aria-label': 'Gerar um apelido', title: 'Gerar um apelido', onClick: () => { input.value = randomNick(); refresh(); } }, ico('icon.dado', '🎲')),
            ),
            hint,
            confirm,
            h('p', { class: 'screen__note', text: 'Seu progresso fica guardado neste celular.' }),
          ),
        ),
      );
      refresh();
    },
    update(dt) { stars.update(dt); },
    render(ctx, d) { stars.render(ctx, d.width, d.height); },
  };
}
