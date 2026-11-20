// Pets: collection, unlock (talents or Fuga wins) and equip one pet.

import { h } from '../ui/dom.js';
import { gameScreen } from '../ui/screen.js';
import { toast } from '../ui/toast.js';
import { sfx } from '../audio/audio.js';
import { Starfield } from './starfield.js';
import { RARITY_LABEL, RARITY_COLOR } from '../game/economy.js';
import { petState, equipPet, unlockPet } from '../world/pet.js';

export function createPetsScene(game) {
  const stars = new Starfield(80);
  return {
    async enter(_p, ui) {
      const pets = (await game.assets.loadJSON('pets.json')).pets;
      const body = h('div', { class: 'pets' });
      ui.appendChild(gameScreen(game, 'Pets 🐾', body));
      let sel = petState(game.save).on || 'ovelhinha';
      const pic = (p, cls) => (game.assets.entry(`petface.${p.id}`)
        ? h('img', { class: `pixel ${cls}`, src: game.assets.url(`petface.${p.id}`), alt: '' })
        : h('span', { class: cls, text: p.emoji, 'aria-hidden': 'true' }));
      const paint = () => {
        const st = petState(game.save);
        const p = pets.find((x) => x.id === sel) || pets[0];
        const owned = Boolean(st.owned[p.id]);
        const cond = p.wins ? `🏆 ${p.wins} vitórias na Fuga` : p.price ? `🪙 ${p.price} talentos` : 'Grátis';
        body.replaceChildren(
          h('div', { class: 'pets__detail', style: { borderColor: RARITY_COLOR[p.rarity] } },
            pic(p, 'pets__big'),
            h('div', { class: 'pets__info' },
              h('b', { text: p.name }),
              h('small', { style: { color: RARITY_COLOR[p.rarity] }, text: RARITY_LABEL[p.rarity] }),
              h('p', { text: p.desc }), h('em', { text: p.ref })),
            owned
              ? h('button', { class: `btn${st.on === p.id ? ' btn--ghost' : ''}`, text: st.on === p.id ? 'Guardar' : 'Levar comigo', onClick: () => { equipPet(game.save, st.on === p.id ? '' : p.id); sfx('click'); paint(); } })
              : h('button', { class: 'btn btn--play', text: p.wins ? `Desbloquear (${cond})` : `Adotar · ${cond}`, onClick: () => { const err = unlockPet(game.save, p); if (err) { toast(err); sfx('wrong'); } else { sfx('open'); toast(`${p.name} agora acompanha você!`); } paint(); } })),
          h('p', { class: 'screen__note', text: `${Object.keys(st.owned).length}/${pets.length} pets · Pets são só companhia: não dão vantagem nas partidas.` }),
          h('div', { class: 'pets__grid', role: 'listbox', 'aria-label': 'Coleção de pets' }, ...pets.map((x) => h('button', {
            class: `pets__cell${x.id === sel ? ' is-sel' : ''}${st.owned[x.id] ? '' : ' is-locked'}${st.on === x.id ? ' is-on' : ''}`,
            role: 'option', 'aria-selected': String(x.id === sel), 'aria-label': `${x.name}${st.owned[x.id] ? '' : ' (bloqueado)'}`,
            style: { borderColor: RARITY_COLOR[x.rarity] }, onClick: () => { sel = x.id; paint(); },
          }, pic(x, 'pets__face'), h('small', { text: x.name })))),
        );
      };
      paint();
    },
    update(dt) { stars.update(dt); },
    render(ctx, d) { stars.render(ctx, d.width, d.height); },
  };
}
