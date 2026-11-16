// Screens for the cloud account: the code card, "enter with my code" and the
// welcome choice for a new phone ("first time here" / "I have an account").

import { h } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { iconButton } from '../ui/icon-button.js';
import { Starfield } from '../scenes/starfield.js';
import { cloudOn, accountCode, createAccount, enterAccount } from './account.js';

function modal(...children) {
  const el = h('div', { class: 'modal account-modal' }, h('div', { class: 'modal__box account' }, ...children));
  document.getElementById('game').appendChild(el);
  return el;
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* old browser */ }
  try {
    const t = h('textarea', { style: { position: 'fixed', opacity: '0' } }); t.value = text;
    document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return ok;
  } catch { return false; }
}

/** The card with the player's code: copy it, keep it, never share it. */
export function showCodeCard(game, code, { isNew = false, onClose = null } = {}) {
  const codeEl = h('div', { class: 'account__code', text: code });
  const close = () => { el.remove(); if (onClose) onClose(); };
  const el = modal(
    h('div', { class: 'account__icon', text: '☁️' }),
    h('h2', { text: isNew ? 'Sua conta foi salva!' : 'Sua conta' }),
    h('p', { text: isNew
      ? 'Agora o seu progresso fica guardado na nuvem. Este é o código da SUA conta:'
      : 'Este é o código da sua conta:' }),
    codeEl,
    h('button', { class: 'btn', text: '📋 Copiar código', onClick: async () => { toast((await copy(code)) ? 'Código copiado! Cole nas suas notas ou mande para você mesmo.' : 'Não deu para copiar. Anote o código num papel.', { ms: 4000 }); } }),
    h('ul', { class: 'account__tips' },
      h('li', { text: 'Guarde este código: anote num papel, nas notas do celular ou mande para você mesmo.' }),
      h('li', { text: 'Trocou de celular ou de navegador? Toque em "Já tenho uma conta" e digite o código: tudo volta.' }),
      h('li', {}, h('b', { text: 'Não mostre o código para ninguém. ' }), 'Quem tiver o código entra na sua conta.'),
    ),
    h('button', { class: 'btn btn--play', onClick: close }, h('b', { text: 'Já guardei o código' })),
  );
  return el;
}

/** Type a code to open an account on this phone. */
export function openEnterCode(game, { onDone } = {}) {
  const input = h('input', { type: 'text', class: 'field__input account__input', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'GEN-XXXX-XXXX-XXXX', 'aria-label': 'Código da conta' });
  const msg = h('p', { class: 'account__msg' });
  const btn = h('button', { class: 'btn', text: 'Entrar na conta' });
  const hasHere = Boolean(game.save.state.nick);
  const go = async () => {
    btn.disabled = true; msg.textContent = 'Procurando sua conta...';
    const r = await enterAccount(game.save, input.value);
    btn.disabled = false;
    if (!r.ok) { msg.textContent = r.msg; return; }
    el.remove();
    toast(`Bem-vindo de volta, @${game.save.state.nick || 'peregrino'}! Seu progresso voltou.`, { ms: 4000 });
    if (onDone) onDone(); else game.scenes.go(game.save.hasNick ? 'lobby' : 'nickname', { next: 'lobby' });
  };
  btn.addEventListener('click', go);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  const el = modal(
    h('h2', { text: '🔑 Entrar com meu código' }),
    h('p', { text: 'Digite ou cole o código da sua conta.' }),
    input,
    hasHere ? h('p', { class: 'account__warn', text: '⚠️ O progresso que está neste celular agora será trocado pelo da conta.' }) : null,
    msg,
    h('div', { class: 'account__row' },
      h('button', { class: 'btn btn--ghost', text: 'Cancelar', onClick: () => el.remove() }),
      btn),
  );
  setTimeout(() => input.focus(), 50);
}

/** "Minha conta" on the title screen. */
export function openAccountMenu(game) {
  const code = accountCode();
  if (code) {
    const card = showCodeCard(game, code);
    card.querySelector('.modal__box').appendChild(
      h('button', { class: 'btn btn--ghost btn--small account__other', text: 'Entrar com outro código', onClick: () => { card.remove(); openEnterCode(game, { onDone: () => game.scenes.go('title') }); } }));
    return;
  }
  const el = modal(
    h('h2', { text: '☁️ Minha conta' }),
    h('p', { text: 'Salve seu progresso para não perder nada se trocar de celular.' }),
    h('div', { class: 'account__row' },
      h('button', { class: 'btn', text: 'Já tenho uma conta', onClick: () => { el.remove(); openEnterCode(game, { onDone: () => game.scenes.go('title') }); } }),
      game.save.hasNick ? h('button', { class: 'btn btn--ghost', text: 'Salvar meu progresso', onClick: async () => { el.remove(); await ensureAccount(game); } }) : null),
    h('button', { class: 'btn btn--ghost btn--small', text: 'Fechar', onClick: () => el.remove() }),
  );
}

let creating = false;
/** Gives the player an account (and shows the code) when they still have none. */
export async function ensureAccount(game) {
  if (!cloudOn() || accountCode() || creating || !game.save.hasNick) return;
  creating = true;
  try {
    // wait for the "nova versão" notice to close first
    while (document.getElementById('news')) await new Promise((r) => setTimeout(r, 500));
    const code = await createAccount(game.save);
    showCodeCard(game, code, { isNew: true });
  } catch { /* offline: try again next time the lobby opens */ } finally {
    creating = false;
  }
}

/** First screen on a phone with no progress: new player or existing account. */
export function createWelcomeScene(game) {
  const stars = new Starfield(90);
  return {
    enter(_params, ui) {
      ui.appendChild(h('section', { class: 'screen' },
        h('header', { class: 'screen__head' },
          iconButton(game.assets, 'icon.voltar', 'Voltar', () => game.scenes.go('title'), '←'),
          h('h1', { text: 'Bem-vindo ao Gênesis!' }),
        ),
        h('div', { class: 'screen__body welcome' },
          h('button', { class: 'welcome__opt', onClick: () => game.scenes.go('nickname', { next: 'lobby' }) },
            h('span', { class: 'welcome__ico', text: '✨' }),
            h('b', { text: 'Estou aqui pela primeira vez' }),
            h('small', { text: 'Criar meu jogador e começar' })),
          h('button', { class: 'welcome__opt', onClick: () => openEnterCode(game) },
            h('span', { class: 'welcome__ico', text: '🔑' }),
            h('b', { text: 'Já tenho uma conta' }),
            h('small', { text: 'Entrar com o meu código' })),
        ),
      ));
    },
    update(dt) { stars.update(dt); },
    render(ctx, d) { stars.render(ctx, d.width, d.height); },
  };
}
