// Gift codes for the owner's challenges (stories, sharing...).
// - The challenge code (GIFT_HASHES) works once per phone and gives GIFT.
// - Prize codes (raffles, promises) live in Supabase (supabase/codes.sql) and
//   work ONCE IN TOTAL: the first player who redeems one uses it up.
// Only fingerprints are published; the codes stay on the owner's computer.

import { h } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { addCoins } from './economy.js';
import { addDenarios } from './meta.js';
import { GIFT_HASHES, RETIRED_HASHES } from './codes-list.js';
import { CLOUD } from '../cloud/config.js';
import { accountCode } from '../cloud/account.js';

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
  if (!GIFT_HASHES.includes(hash)) return redeemPrize(game, code, hash);
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

/** A one-time prize code kept in Supabase: the server hands out the prize only once. */
async function redeemPrize(game, code, hash) {
  if (!CLOUD.url || !CLOUD.key) return { ok: false, msg: 'Código inválido. Confira as letras e os tracinhos.' };
  let res;
  try {
    const headers = { apikey: CLOUD.key, 'Content-Type': 'application/json' };
    if (CLOUD.key.startsWith('eyJ')) headers.Authorization = `Bearer ${CLOUD.key}`;
    res = await fetch(`${CLOUD.url}/rest/v1/rpc/genesis_redeem`, { method: 'POST', headers, body: JSON.stringify({ p_code: code, p_account: accountCode() || null }) });
  } catch {
    return { ok: false, msg: 'Sem internet agora. Conecte e tente de novo.' };
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (/usado/.test(err.message || '')) return { ok: false, msg: 'Esse código já foi resgatado. Cada código vale só uma vez.' };
    return { ok: false, msg: 'Código inválido. Confira as letras e os tracinhos.' };
  }
  const prize = await res.json();
  const { save } = game;
  const chars = game.assets.json('characters.json').characters;
  const got = [];
  if (prize.character) {
    const c = chars.find((x) => x.id === prize.character);
    const label = c ? `o personagem ${c.rarity ? `${c.rarity} ` : ''}${c.name}` : 'um personagem';
    if (!save.isUnlocked(prize.character)) { save.unlock(prize.character); got.push(label); }
    else if (prize.fallbackCoins) { addCoins(save, prize.fallbackCoins); got.push(`${prize.fallbackCoins} talentos extras (você já tinha ${c ? c.name : 'esse personagem'})`); }
  }
  if (prize.coins) { addCoins(save, prize.coins); got.push(`${prize.coins} talentos`); }
  if (prize.denarios) { addDenarios(save, prize.denarios); got.push(`${prize.denarios} denários`); }
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
