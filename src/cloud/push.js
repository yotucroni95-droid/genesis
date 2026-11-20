// Lembretes (supabase/push.sql + supabase/functions/genesis-push): the player
// turns them on, the phone gives an address, and the server sends at most one
// reminder a day (lamp about to go out, missions left, someone passed you...).
// Only the public key is here; the secret key lives in Supabase.

import { rpc, accountCode, cloudOn } from './account.js';

const PUBLIC_KEY = 'BGsANwvUy2B3chVnrrKem-6TsPB3Rfyc8EltgOKvBGvlu7D7l61Fkpy6T7rFNJOSRHTqqyb7AGej3s6z3QBAPLk';
const ASKED_KEY = 'genesis.pushAsked';

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** 'on' | 'off' | 'blocked' | 'ios-home' (iPhone: add to home screen first) | 'none' (no account / browser can't) */
export async function pushStatus() {
  if (!cloudOn() || !accountCode()) return 'none';
  if (!supported()) return isIOS() && !standalone() ? 'ios-home' : 'none';
  if (Notification.permission === 'denied') return 'blocked';
  if (Notification.permission !== 'granted') return 'off';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  return sub ? 'on' : 'off';
}

function keyBytes(b64) {
  const s = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

/** Asks permission and registers this phone. Returns the new status. */
export async function enablePush() {
  if (await pushStatus() === 'ios-home') return 'ios-home';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'blocked' : 'off';
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) }));
  await rpc('genesis_push_subscribe', { p_code: accountCode(), p_sub: sub.toJSON() });
  return 'on';
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  if (sub) await sub.unsubscribe().catch(() => {});
  await rpc('genesis_push_unsubscribe', { p_code: accountCode() }).catch(() => {});
  return 'off';
}

/** On opening the game: the phone may have changed the address; send it again. */
export async function refreshPush() {
  try {
    if (await pushStatus() !== 'on') return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await rpc('genesis_push_subscribe', { p_code: accountCode(), p_sub: sub.toJSON() });
  } catch { /* offline: next time */ }
}

/** Should the lobby offer reminders now? Once, then again a week after "Agora não". */
export async function shouldOfferPush() {
  const st = await pushStatus();
  if (st !== 'off' && st !== 'ios-home') return false;
  let last = 0;
  try { last = Number(localStorage.getItem(ASKED_KEY)) || 0; } catch { /* storage blocked */ }
  return Date.now() - last > 7 * 24 * 3600 * 1000;
}
export function markPushAsked() { try { localStorage.setItem(ASKED_KEY, String(Date.now())); } catch { /* ignore */ } }

export const PUSH_TEXT = {
  'ios-home': 'No iPhone, os lembretes só funcionam com o jogo na tela inicial: toque em Compartilhar (□↑) e depois em "Adicionar à Tela de Início". Abra o Gênesis por lá e ative.',
  blocked: 'As notificações estão bloqueadas para o Gênesis. Libere nas configurações do navegador e tente de novo.',
};
