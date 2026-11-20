// Friends (supabase/friends.sql): search by nickname or friend code, requests,
// friend list and invites to an online Arena room. Every call uses the secret
// account code; other players only ever see friend code, nickname and avatar.

import { rpc, accountCode, cloudOn } from './account.js';

export const friendsOn = () => cloudOn() && Boolean(accountCode());
const code = () => accountCode();
let cache = null;
export const cachedFriends = () => cache;
const keep = (s) => { cache = s; return s; };

export const friendsState = () => rpc('genesis_friends_state', { p_code: code() }, { timeout: 8000 }).then(keep);
export const searchPlayers = (q) => rpc('genesis_friend_search', { p_code: code(), p_query: q }, { timeout: 8000 });
export const requestFriend = (tag) => rpc('genesis_friend_request', { p_code: code(), p_tag: tag }).then(keep);
export const answerFriend = (tag, accept) => rpc('genesis_friend_respond', { p_code: code(), p_tag: tag, p_accept: accept }).then(keep);
export const removeFriend = (tag) => rpc('genesis_friend_remove', { p_code: code(), p_tag: tag }).then(keep);
export const inviteFriend = (tag, room) => rpc('genesis_friend_invite', { p_code: code(), p_tag: tag, p_room: room });
export const clearInvite = (room) => rpc('genesis_invite_clear', { p_code: code(), p_room: room }).catch(() => {});

export function friendError(err) {
  const m = String((err && err.message) || err);
  if (/pesquisa curta/.test(m)) return 'Digite pelo menos 3 letras.';
  if (/nao encontrad/.test(m)) return 'Jogador não encontrado.';
  if (/voce mesmo/.test(m)) return 'Esse é você!';
  if (/pedidos demais/.test(m)) return 'Você tem pedidos demais esperando resposta.';
  if (/nao sao amigos/.test(m)) return 'Vocês ainda não são amigos.';
  return 'Sem conexão com o servidor. Verifique a internet.';
}
