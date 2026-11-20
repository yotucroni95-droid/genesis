// Temporary tool for the game's owner: unlock everything on this phone.
// Hidden: hold the "Perfil" title for 3 seconds and type the secret code.
// Only the SHA-256 fingerprint of the code is here, never the code itself.
// Remove this file and its hook in scenes/profile.js when no longer needed.

import { h } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { loadChapter, completeStop } from '../content/progression.js';
import { loadExtras } from '../ui/game-ui.js';
import { RANKS, heroKey } from './economy.js';
import { PASS_LEVELS, FE_PER_LEVEL } from './meta.js';

const CODE_HASH = '44127e5e609466eaf724474cfb16762dadfd82c9709c797c70b8eb9940a9e668';

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Every chapter with 3 stars (also Modo Herói), all characters, cosmetics, cards and medals. */
export async function unlockEverything(game) {
  const { save, assets } = game;
  try { localStorage.setItem('genesis.owner', '1'); } catch { /* storage blocked */ } // keeps the creator out of the ranking
  const now = new Date().toISOString();
  const entries = assets.json('chapters/index.json').chapters;
  const chapters = (await Promise.all(entries.map((e) => loadChapter(assets, e)))).filter(Boolean);
  for (const c of chapters) {
    for (const stop of c.stops) completeStop(save, c, stop, 100);
  }
  game.extras = game.extras || await loadExtras(assets);
  const { cosmetics, verses } = game.extras;
  save.update((s) => {
    for (const c of chapters) {
      for (const stop of c.stops) s.stars = { ...s.stars, [stop.id]: 3, [heroKey(stop.id)]: 3 };
      s.heroDone = { ...(s.heroDone || {}), [c.id]: now };
    }
    for (const c of assets.json('characters.json').characters) s.unlocked[c.id] = s.unlocked[c.id] || now;
    s.fragments = {};
    for (const kind of ['titles', 'frames', 'trails']) {
      s[kind] = { ...(s[kind] || {}) };
      for (const c of cosmetics[kind] || []) s[kind][c.id] = s[kind][c.id] || now;
    }
    s.verses = { ...(s.verses || {}) };
    for (const v of verses) s.verses[v.id] = s.verses[v.id] || 1;
    for (const m of assets.manifest.assets.filter((a) => a.kind === 'medal')) {
      const id = m.id.replace('medal.', '');
      s.achievements[id] = s.achievements[id] || now;
    }
    s.level = Math.max(s.level, chapters.length + 1);
    s.coins = Math.max(s.coins || 0, 99999);
    s.denarios = Math.max(s.denarios || 0, 9999);
    s.trophies = Math.max(s.trophies || 0, RANKS.find((r) => r.id === 'jerusalem3').min);
    s.rankBest = RANKS.length - 1;
    s.pass = { ...(s.pass || {}), fe: Math.max((s.pass && s.pass.fe) || 0, PASS_LEVELS * FE_PER_LEVEL) };
    s.oil = Math.max(s.oil || 0, 5);
  });
}

/** Holding the element for 3 s opens the code box. */
export function attachSecretUnlock(game, el) {
  let timer = null;
  const cancel = () => { clearTimeout(timer); timer = null; };
  el.addEventListener('pointerdown', () => { cancel(); timer = setTimeout(() => openBox(game), 3000); });
  for (const t of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(t, cancel);
  el.style.userSelect = 'none';
  el.style.webkitUserSelect = 'none';
}

function openBox(game) {
  const input = h('input', { type: 'password', class: 'field__input', autocomplete: 'off', placeholder: 'Código' });
  const close = () => modal.remove();
  const go = async () => {
    const ok = (await sha256(`genesis|${input.value.trim().toUpperCase()}`)) === CODE_HASH;
    if (!ok) { toast('Código errado.'); return; }
    close();
    await unlockEverything(game);
    toast('Tudo liberado neste celular!', { ms: 4000 });
    game.scenes.go('profile');
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  const modal = h('div', { class: 'modal' }, h('div', { class: 'modal__box' },
    h('h2', { text: 'Modo do criador' }),
    input,
    h('div', { style: { display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '12px' } },
      h('button', { class: 'btn btn--ghost', text: 'Cancelar', onClick: close }),
      h('button', { class: 'btn', text: 'Liberar tudo', onClick: go })),
  ));
  document.getElementById('game').appendChild(modal);
  setTimeout(() => input.focus(), 50);
}
