// Gift codes for the owner's challenges (stories, sharing...). Each code works
// once per phone and gives the prize below. Only fingerprints live in the code
// (codes-list.js); the list of codes stays on the owner's computer.

import { h } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { addCoins } from './economy.js';
import { addDenarios } from './meta.js';
import { GIFT_HASHES, RETIRED_HASHES } from './codes-list.js';

export const GIFT = { character: 'paulo', coins: 1500, denarios: 50 };

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const clean = (v) => v.trim().toUpperCase().replace(/\s+/g, '').replace(/[–—_]/g, '-');

/** Checks the code and gives the prize; returns a message for the player. */
export async function redeem(game, value) {
  const code = clean(value);
  if (!code) return { ok: false, msg: 'Digite o código.' };
  const hash = await sha256(`genesis-presente|${code}`);
  if (!GIFT_HASHES.includes(hash)) return { ok: false, msg: 'Código inválido. Confira as letras e os tracinhos.' };
  const { save } = game;
  const used = Object.keys(save.state.redeemed || {});
  if (used.includes(hash) || used.some((x) => RETIRED_HASHES.includes(x))) return { ok: false, msg: 'Você já resgatou o presente do desafio neste celular.' };
  const got = [];
  if (!save.isUnlocked(GIFT.character)) {
    save.unlock(GIFT.character);
    got.push('o personagem lendário Paulo');
  } else {
    addCoins(save, 2200); // already has Paulo: his shop price in talentos instead
    got.push('2200 talentos extras (você já tinha o Paulo)');
  }
  addCoins(save, GIFT.coins);
  addDenarios(save, GIFT.denarios);
  got.push(`${GIFT.coins} talentos`, `${GIFT.denarios} denários`);
  save.update((s) => { s.redeemed = { ...(s.redeemed || {}), [hash]: new Date().toISOString() }; });
  return { ok: true, msg: `Presente recebido: ${got.join(', ')}!` };
}

export function openRedeem(game, backScene = 'shop') {
  const input = h('input', { type: 'text', class: 'field__input', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'GENESIS-XXXX-XXXX-XXXX' });
  const close = () => modal.remove();
  const go = async () => {
    const r = await redeem(game, input.value);
    toast(r.msg, { ms: r.ok ? 5000 : 3000 });
    if (r.ok) { close(); game.scenes.go(backScene); }
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  const modal = h('div', { class: 'modal' }, h('div', { class: 'modal__box' },
    h('h2', { text: '🎁 Resgatar código' }),
    h('p', { text: 'Ganhou um código num desafio? Digite aqui para receber o seu presente.' }),
    input,
    h('div', { style: { display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '12px' } },
      h('button', { class: 'btn btn--ghost', text: 'Cancelar', onClick: close }),
      h('button', { class: 'btn', text: 'Resgatar', onClick: go })),
  ));
  document.getElementById('game').appendChild(modal);
  setTimeout(() => input.focus(), 50);
}
