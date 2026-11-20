// Amigos: my friend code, search, requests, friend list and Arena invites.

import { h } from '../ui/dom.js';
import { gameScreen } from '../ui/screen.js';
import { toast } from '../ui/toast.js';
import { sfx } from '../audio/audio.js';
import { Starfield } from './starfield.js';
import { rankBadge } from '../ui/game-ui.js';
import { friendsOn, friendsState, searchPlayers, requestFriend, answerFriend, removeFriend, inviteFriend, clearInvite, friendError } from '../cloud/friends.js';
import { createRoom } from '../cloud/rooms.js';

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
          h('small', { text: `${p.online ? '🟢 online' : '⚪ offline'} · nível ${p.level || 1}` })),
        rankBadge(p.trophies || 0),
        h('div', { class: 'friend__actions' }, ...actions));
      const act = (text, cls, fn) => h('button', { class: `btn btn--small ${cls}`, text, onClick: async (e) => {
        e.currentTarget.disabled = true;
        try { await fn(); sfx('click'); } catch (err) { toast(friendError(err)); }
        if (alive) await load();
      } });

      const challenge = async (p) => {
        try {
          const room = await createRoom(save.state.nick || 'jogador', save.state.avatarId);
          await inviteFriend(p.tag, room.code);
          toast(`Convite enviado para @${p.nick}!`);
          game.scenes.go('online', { join: room.code });
        } catch (err) { toast(friendError(err)); }
      };

      const input = h('input', { class: 'field__input friends__search', placeholder: 'Apelido ou código de amigo', maxlength: '16', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Pesquisar jogador' });
      const search = async () => {
        try { results = await searchPlayers(input.value); } catch (err) { toast(friendError(err)); results = null; }
        if (alive) paint();
      };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') search(); });

      const paint = () => {
        if (!state) { body.replaceChildren(h('p', { class: 'screen__note', text: 'Carregando amigos…' })); return; }
        const known = new Set([...state.friends, ...state.outgoing, ...state.incoming].map((p) => p.tag));
        const section = (title, list, empty) => [h('h3', { class: 'friends__title', text: title }),
          list.length ? h('div', { class: 'friends__list' }, ...list) : h('p', { class: 'screen__note', text: empty })];
        body.replaceChildren(...[
          h('div', { class: 'friends__me' },
            h('span', { text: 'Seu código de amigo:' }), h('b', { class: 'friends__tag', text: state.me.tag }),
            h('button', { class: 'btn btn--small btn--ghost', text: 'Copiar', onClick: () => navigator.clipboard && navigator.clipboard.writeText(state.me.tag).then(() => toast('Código copiado!')).catch(() => {}) })),
          ...(state.invites.length ? section('Convites para a Arena', state.invites.map((p) => card(p,
            act('Jogar!', 'btn--play', async () => { await clearInvite(p.room); game.scenes.go('online', { join: p.room }); }),
            act('Agora não', 'btn--ghost', () => clearInvite(p.room))))) : []),
          ...(state.incoming.length ? section('Pedidos de amizade', state.incoming.map((p) => card(p,
            act('Aceitar', '', () => answerFriend(p.tag, true)),
            act('Recusar', 'btn--ghost', () => answerFriend(p.tag, false))))) : []),
          ...section(`Amigos (${state.friends.length})`, state.friends.sort((a, b) => Number(b.online) - Number(a.online)).map((p) => card(p,
            h('button', { class: 'btn btn--small btn--online', text: '⚡ Desafiar', onClick: () => challenge(p) }),
            act('Remover', 'btn--ghost', () => (confirm(`Remover @${p.nick} dos amigos?`) ? removeFriend(p.tag) : null)))),
          'Pesquise pelo apelido ou pelo código de amigo e mande um pedido.'),
          h('h3', { class: 'friends__title', text: 'Encontrar jogadores' }),
          h('div', { class: 'online__row' }, input, h('button', { class: 'btn', text: '🔍 Pesquisar', onClick: search })),
          results ? (results.length ? h('div', { class: 'friends__list' }, ...results.map((p) => card(p,
            known.has(p.tag) ? h('span', { class: 'tag', text: state.friends.some((f) => f.tag === p.tag) ? 'Amigo' : 'Pedido enviado' })
              : act('Adicionar', '', () => requestFriend(p.tag).then(() => toast(`Pedido enviado para @${p.nick}!`)))))) : h('p', { class: 'screen__note', text: 'Ninguém encontrado com esse nome.' })) : null,
          state.outgoing.length ? h('p', { class: 'screen__note', text: `Esperando resposta: ${state.outgoing.map((p) => '@' + p.nick).join(', ')}` }) : null,
        ].filter(Boolean));
      };
      paint();
      const load = async () => {
        try { state = await friendsState(); } catch (err) { if (!state) body.replaceChildren(h('p', { class: 'screen__note', text: friendError(err) })); return; }
        if (alive) paint();
      };
      await load();
      timer = setInterval(load, 20000); // new requests and invites show up while the screen is open
    },
    exit() { alive = false; clearInterval(timer); },
    update(dt) { stars.update(dt); },
    render(ctx, d) { stars.render(ctx, d.width, d.height); },
  };
}
