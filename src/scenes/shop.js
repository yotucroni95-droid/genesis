// Shop: offers of the day, the pack of the week and boxes. Game coins only
// (talentos and denários): there is no real money anywhere.

import { h } from '../ui/dom.js';
import { gameScreen } from '../ui/screen.js';
import { chest, frameView, ico, loadExtras, formatWait } from '../ui/game-ui.js';
import { toast } from '../ui/toast.js';
import { SHOP, buyBox, RARITY_LABEL, RARITY_COLOR } from '../game/economy.js';
import { dailyOffers, buyOffer, buyWeeklyPack, weeklyPackBought, WEEKLY_PACK, charById, fragmentsNeeded } from '../game/meta.js';
import { Starfield } from './starfield.js';
import { sfx } from '../audio/audio.js';
import { openRedeem } from '../game/codes.js';

const WHAT = {
  comum: 'Talentos, 1 carta e fragmentos',
  raro: 'Talentos, 2 cartas, fragmentos e 1 denário',
  'épico': 'Talentos, 3 cartas, muitos fragmentos e denários',
  'lendário': 'Muitos fragmentos (lendários também!), denários e um item raro',
};

const msUntilMidnight = () => { const d = new Date(); d.setHours(24, 0, 0, 0); return d - Date.now(); };
const price = (n, currency) => [currency === 'denarios' ? ico('icon.denario', '🥈') : ico('icon.moeda', '🪙'), h('b', { text: String(n) })];

export function createShopScene(game) {
  const stars = new Starfield(100);
  return {
    async enter(_p, ui) {
      game.extras = game.extras || await loadExtras(game.assets);
      const save = game.save;
      const cos = game.extras.cosmetics;
      const reload = () => game.scenes.go('shop');

      const offerArt = (o) => {
        if (o.kind === 'frag') {
          const c = charById(o.id);
          return h('div', { class: 'offer__face', style: { '--r': RARITY_COLOR[c.rarity] } },
            h('img', { class: 'pixel', src: game.assets.url(`portrait.${o.id}`), alt: '' }),
            h('span', { class: 'offer__frag', text: `🧩 ${(save.state.fragments || {})[o.id] || 0}/${fragmentsNeeded(charById(o.id))}` }));
        }
        if (o.kind === 'oil') return ico('icon.azeite', '🫙', 'offer__ico');
        if (o.kind === 'box') return chest(o.rarity, { size: 56 });
        if (o.cosmeticKind === 'frames') return frameView(o.id, 60, game.assets.url(`portrait.${save.state.avatarId}`));
        if (o.cosmeticKind === 'trails') return h('span', { class: 'offer__trail', style: { '--c': (cos.trails.find((t) => t.id === o.id) || {}).color } }, '✦ ✦ ✦');
        return ico('icon.titulo', '🏷️', 'offer__ico');
      };

      const offers = dailyOffers(save, cos).map((o) => {
        const c = o.kind === 'frag' ? charById(o.id) : null;
        const rarity = c ? c.rarity : o.rarity || 'comum';
        const sub = o.kind === 'frag' ? `Personagem ${RARITY_LABEL[c.rarity] || c.rarity}` : o.kind === 'cosmetic' ? { frames: 'Moldura', titles: 'Título', trails: 'Rastro ao andar' }[o.cosmeticKind] : o.kind === 'oil' ? 'Protege a lamparina 1 dia' : 'Oferta';
        return h('div', { class: `offer${o.bought || o.owned ? ' is-sold' : ''}`, style: { '--r': RARITY_COLOR[rarity] || '#9fb3c8' } },
          offerArt(o),
          h('b', { text: o.label }),
          h('small', { text: sub }),
          o.bought ? h('span', { class: 'tag tag--final', text: 'Comprado ✓' })
            : o.owned ? h('span', { class: 'tag', text: o.kind === 'oil' ? 'Máximo de 5' : 'Você já tem' })
              : h('button', { class: 'btn btn--small offer__buy', onClick: () => {
                const r = buyOffer(save, o);
                if (r.error) { toast(r.error, { ms: 3500 }); return; }
                sfx('coin');
                if (o.kind === 'frag') toast(r.unlocked ? `${c.name} liberado!` : r.converted ? `Você já tinha ${c.name}: virou ${r.converted} denários.` : `+${o.amount} fragmentos de ${c.name}!`);
                else toast(`${o.label}: é seu!${o.kind === 'box' ? ' Abra em Baús.' : ''}`);
                reload();
              } }, ...price(o.price, o.currency)),
        );
      });

      const packBought = weeklyPackBought(save);
      const pack = h('div', { class: `offer offer--pack${packBought ? ' is-sold' : ''}` },
        ico('ui.pacote_semana', '🎒', 'offer__ico offer__ico--big'),
        h('div', { class: 'offer__packtext' }, h('b', { text: WEEKLY_PACK.label }), h('small', { text: WEEKLY_PACK.text })),
        packBought ? h('span', { class: 'tag tag--final', text: 'Comprado esta semana ✓' })
          : h('button', { class: 'btn offer__buy', onClick: () => {
            const r = buyWeeklyPack(save);
            if (r.error) { toast(r.error, { ms: 3500 }); return; }
            sfx('fanfare');
            toast(`Pacote comprado! Baú Épico em Baús${r.character ? ` e +6 fragmentos de ${r.character.name}` : ''}.`, { ms: 4000 });
            reload();
          } }, ...price(WEEKLY_PACK.price, 'denarios')),
      );

      const boxes = h('div', { class: 'shop' }, ...SHOP.map((item) => h('div', { class: 'shopcard', style: { '--r': RARITY_COLOR[item.rarity] } },
        chest(item.rarity, { size: 64 }),
        h('b', { text: `Baú ${RARITY_LABEL[item.rarity]}` }),
        h('small', { text: WHAT[item.rarity] }),
        h('button', { class: 'btn btn--small', onClick: () => {
          if (buyBox(game.save, item.rarity)) { sfx('coin'); toast(`Baú ${RARITY_LABEL[item.rarity]} comprado! Abra em Baús.`); reload(); }
          else toast('Talentos insuficientes. Complete paradas, missões e a Arena para ganhar mais!');
        } }, ...price(item.price, 'coins')),
      )));

      ui.appendChild(gameScreen(game, 'Loja', h('div', {},
        h('div', { class: 'shop__code' },
          h('span', { text: '🎁 Ganhou um código num desafio?' }),
          h('button', { class: 'btn btn--small', text: 'Resgatar código', onClick: () => openRedeem(game, 'shop') })),
        h('div', { class: 'shop__title' }, h('h3', { text: 'Ofertas do dia' }), h('small', { text: `Novas ofertas em ${formatWait(msUntilMidnight())}` })),
        h('div', { class: 'offers' }, ...offers),
        h('h3', { text: 'Pacote da semana' }),
        pack,
        h('h3', { text: 'Baús' }),
        boxes,
        h('p', { class: 'screen__note', text: 'Tudo aqui é comprado com talentos e denários, as moedas do jogo. Não existe dinheiro de verdade. Denários vêm das missões da semana, do Passe da Fé, do Modo Herói e de baús épicos.' }),
        h('div', { style: { display: 'flex', justifyContent: 'center', marginTop: '10px' } }, h('button', { class: 'btn btn--ghost', text: 'Ir para meus baús', onClick: () => game.scenes.go('boxes') })),
      )));
    },
    update(dt) { stars.update(dt); },
    render(ctx, d) { stars.render(ctx, d.width, d.height); },
  };
}
