// Amigos: my friend code, search, requests, friend list and Arena invites.

import { h } from '../ui/dom.js';
import { gameScreen } from '../ui/screen.js';
import { toast } from '../ui/toast.js';
import { sfx } from '../audio/audio.js';
import { Starfield } from './starfield.js';
import { rankBadge } from '../ui/game-ui.js';
import { friendsOn, friendsState, searchPlayers, requestFriend, answerFriend, removeFriend, inviteFriend, clearInvite, friendError } from '../cloud/friends.js';
import { createRoom } from '../cloud/rooms.js';
import { isSabbath, showSabbath } from '../game/sabbath.js';
import { online as fugaRooms, fugaError } from '../cloud/fuga.js';

export function createFriendsScene(game) {
  const stars = new Starfield(100);
  let alive = false;
  let timer = 0;
  return {
    async enter(_p, ui) {
      alive = true;
      const save = game.save;
      const body = h('div', { class: 'friends' });
      ui.appendChild(gameScreen(game, 'Amigos 👥', body));
      const portrait = (id) => game.assets.url(game.assets.entry(`portrait.${id}`) ? `portrait.${id}` : 'portrait.peregrino');

      if (!friendsOn()) {
        body.replaceChildren(h('div', { class: 'quiz__result' },
          h('h2', { class: 'quiz__q', text: 'Crie sua conta para ter amigos' }),
          h('p', { class: 'screen__note', text: 'Os amigos ficam guardados na sua conta. Abra o Perfil e toque em "Minha conta".' }),
          h('button', { class: 'btn', text: 'Ir para o Perfil', onClick: () => game.scenes.go('profile') })));
        return;
      }

      let state = null;
      let results = null;
      const card = (p, ...actions) => h('div', { class: `friend${p.online ? ' is-online' : ''}` },
        h('img', { class: 'pixel friend__face', src: portrait(p.avatar), alt: '' }),
        h('div', { class: 'friend__info' },
          h('b', { text: `@${p.nick}` }),
          h('small', {}, h('span', { class: `aico aico--${p.online ? 0 : 1}`, 'aria-hidden': 'true' }), `${p.online ? 'online' : 'offline'} · nível ${p.level || 1}`)),
        rankBadge(p.trophies || 0),
        h('div', { class: 'friend__actions' }, ...actions));
      const act = (text, cls, fn) => h('button', { class: `btn btn--small ${cls}`, text, onClick: async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        try { await fn(); sfx('click'); } catch (err) { toast(friendError(err)); }
        const menu = btn.closest('details'); if (menu) menu.open = false; // let the refresh repaint the list
        btn.disabled = false;
        if (alive) await load();
      } });

      const challenge = async (p, mode = '1x1') => {
        if (isSabbath()) return showSabbath();
        try {
          const room = await createRoom(save.state.nick || 'jogador', save.state.avatarId, mode);
          await inviteFriend(p.tag, room.code);
          toast(`Convite enviado para @${p.nick}!`);
          game.scenes.go('online', { join: room.code });
        } catch (err) { toast(friendError(err)); }
      };

      // Fuga da Tentação: private co-op room, the friend gets the code as an invite
      const inviteFuga = async (p) => {
        try {
          const room = await fugaRooms.create(save.state.nick || 'jogador', save.state.avatarId, false, 1);
          await inviteFriend(p.tag, room.code);
          toast(`Convite da Fuga enviado para @${p.nick}!`);
          game.scenes.go('fuga', { join: room.code });
        } catch (err) { toast(/fuga|404|PGRST/.test(String(err && err.message)) ? fugaError(err) : friendError(err)); }
      };

      const input = h('input', { class: 'field__input friends__search', placeholder: 'Apelido ou código de amigo', maxlength: '16', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Pesquisar jogador' });
      const search = async () => {
        try { results = await searchPlayers(input.value); } catch (err) { toast(friendError(err)); results = null; }
        if (alive) paint();
      };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') search(); });

      // compact row for the friend list: small face, name, online dot + a discreet actions menu
      let filter = '';
      const row = (p) => {
        const menu = h('details', { class: 'frow__menu' },
          h('summary', { class: 'frow__more', 'aria-label': `Ações para @${p.nick}` }, h('span', { class: 'aico aico--7', 'aria-hidden': 'true' })),
          h('div', { class: 'frow__pop' },
            h('button', { class: 'btn btn--small btn--online', onClick: () => challenge(p, '1x1') }, h('span', { class: 'aico aico--3', 'aria-hidden': 'true' }), 'Desafiar 1x1'),
            h('button', { class: 'btn btn--small btn--online', onClick: () => challenge(p, '2x2') }, h('span', { class: 'aico aico--4', 'aria-hidden': 'true' }), 'Convidar 2x2'),
            h('button', { class: 'btn btn--small', onClick: () => inviteFuga(p) }, h('span', { class: 'aico aico--5', 'aria-hidden': 'true' }), 'Convidar para a Fuga'),
            act('Remover', 'btn--ghost', () => (confirm(`Remover @${p.nick} dos amigos?`) ? removeFriend(p.tag) : null))));
        return h('li', { class: `frow${p.online ? ' is-online' : ''}` },
          h('img', { class: 'pixel frow__face', src: portrait(p.avatar), alt: '' }),
          h('span', { class: 'frow__name', text: `@${p.nick}`, title: `@${p.nick}` }),
          h('span', { class: 'frow__status', role: 'status', 'aria-label': p.online ? 'online' : 'offline' },
            h('i', { class: 'frow__dot', 'aria-hidden': 'true' }), h('small', { text: p.online ? 'online' : 'offline' })),
          menu);
      };
      const friendList = () => {
        const list = h('ul', { class: 'frows' });
        const fill = () => {
          const q = filter.trim().toLowerCase();
          const shown = state.friends.filter((p) => !q || String(p.nick).toLowerCase().includes(q) || String(p.tag).toLowerCase().includes(q));
          list.replaceChildren(...(shown.length ? shown.map(row) : [h('li', { class: 'screen__note', text: 'Nenhum amigo com esse nome.' })]));
        };
        fill();
        if (state.friends.length <= 6) return [list];
        const f = h('input', { class: 'field__input frows__filter', placeholder: 'Buscar entre amigos', value: filter, maxlength: '16', autocomplete: 'off', 'aria-label': 'Buscar entre amigos' });
        f.addEventListener('input', () => { filter = f.value; fill(); });
        return [f, list];
      };

      const paint = () => {
        if (!state) { body.replaceChildren(h('p', { class: 'screen__note', text: 'Carregando amigos…' })); return; }
        const known = new Set([...state.friends, ...state.outgoing, ...state.incoming].map((p) => p.tag));
        const section = (title, list, empty) => [h('h3', { class: 'friends__title', text: title }),
          list.length ? h('div', { class: 'friends__list' }, ...list) : h('p', { class: 'screen__note', text: empty })];
        body.replaceChildren(...[
          h('div', { class: 'friends__me' },
            h('span', { text: 'Seu código de amigo:' }), h('b', { class: 'friends__tag', text: state.me.tag }),
            h('button', { class: 'btn btn--small btn--ghost', text: 'Copiar', onClick: () => navigator.clipboard && navigator.clipboard.writeText(state.me.tag).then(() => toast('Código copiado!')).catch(() => {}) })),
          ...(state.invites.length ? section('Convites para jogar', state.invites.map((p) => card(p,
            act('Jogar!', 'btn--play', async () => { await clearInvite(p.room); game.scenes.go('fuga', { join: p.room, orArena: true }); }),
            act('Agora não', 'btn--ghost', () => clearInvite(p.room))))) : []),
          ...(state.incoming.length ? section('Pedidos de amizade', state.incoming.map((p) => card(p,
            act('Aceitar', '', () => answerFriend(p.tag, true)),
            act('Recusar', 'btn--ghost', () => answerFriend(p.tag, false))))) : []),
          h('h3', { class: 'friends__title', text: `Amigos (${state.friends.length}) · ${state.friends.filter((p) => p.online).length} online` }),
          ...(state.friends.sort((a, b) => Number(b.online) - Number(a.online) || String(a.nick).localeCompare(String(b.nick))), state.friends.length
            ? friendList() : [h('p', { class: 'screen__note', text: 'Pesquise pelo apelido ou pelo código de amigo e mande um pedido.' })]),
          h('h3', { class: 'friends__title', text: 'Encontrar jogadores' }),
          h('div', { class: 'online__row' }, input, h('button', { class: 'btn', onClick: search }, h('span', { class: 'aico aico--2', 'aria-hidden': 'true' }), 'Pesquisar')),
          results ? (results.length ? h('div', { class: 'friends__list' }, ...results.map((p) => card(p,
            known.has(p.tag) ? h('span', { class: 'tag', text: state.friends.some((f) => f.tag === p.tag) ? 'Amigo' : 'Pedido enviado' })
              : act('Adicionar', '', () => requestFriend(p.tag).then(() => toast(`Pedido enviado para @${p.nick}!`)))))) : h('p', { class: 'screen__note', text: 'Ninguém encontrado com esse nome.' })) : null,
          state.outgoing.length ? h('p', { class: 'screen__note', text: `Esperando resposta: ${state.outgoing.map((p) => '@' + p.nick).join(', ')}` }) : null,
        ].filter(Boolean));
      };
      paint();
      const load = async () => {
        try { state = await friendsState(); } catch (err) { if (!state) body.replaceChildren(h('p', { class: 'screen__note', text: friendError(err) })); return; }
        // don't rebuild under the player's finger: an open actions menu or the friend filter in use
        if (alive && !body.querySelector('.frow__menu[open]') && document.activeElement?.classList?.contains('frows__filter') !== true) paint();
      };
      body.addEventListener('toggle', (e) => { if (e.target.open) body.querySelectorAll('.frow__menu[open]').forEach((d) => { if (d !== e.target) d.open = false; }); }, true);
      body.addEventListener('click', (e) => { if (!e.target.closest('.frow__menu')) body.querySelectorAll('.frow__menu[open]').forEach((d) => { d.open = false; }); });
      await load();
      timer = setInterval(load, 20000); // new requests and invites show up while the screen is open
    },
    exit() { alive = false; clearInterval(timer); },
    update(dt) { stars.update(dt); },
    render(ctx, d) { stars.render(ctx, d.width, d.height); },
  };
}
