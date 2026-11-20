// Gênesis: entrega os lembretes do dia (chamada pelo agendador às 18h de Brasília).
// Supabase > Edge Functions > genesis-push. "Verify JWT" desligado: chamar de novo
// não faz mal, porque o banco só libera 1 lembrete por jogador por dia, das 17h às 21h.
// Segredo necessário (Edge Functions > Secrets): VAPID_PRIVATE_KEY.
// SUPABASE_DB_URL já vem pronto do Supabase.

import webpush from 'npm:web-push@3.6.7';
import postgres from 'npm:postgres@3.4.4';

const PUBLIC_KEY = 'BGsANwvUy2B3chVnrrKem-6TsPB3Rfyc8EltgOKvBGvlu7D7l61Fkpy6T7rFNJOSRHTqqyb7AGej3s6z3QBAPLk';
const SITE = 'https://yotucroni95-droid.github.io/genesis/';

type Row = { endpoint: string; p256dh: string; auth: string; kind: string; nick: string; lamp: number; missions: number; pos: number | null; above: string | null };

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

function message(r: Row) {
  const n = r.nick ? `@${r.nick}` : 'Peregrino';
  switch (r.kind) {
    case 'lamp': return pick([
      { title: `🔥 Sua lamparina de ${r.lamp} dias vai apagar!`, body: 'Jogue só 1 minuto hoje para manter a chama acesa.' },
      { title: `🪔 ${n}, não deixe a luz apagar!`, body: `São ${r.lamp} dias seguidos. Uma parada rápida mantém tudo aceso.` },
      { title: '🔥 A chama ainda está acesa… por pouco!', body: `Faça uma missão hoje e chegue a ${r.lamp + 1} dias de lamparina.` },
    ]);
    case 'rank': return pick([
      { title: `⚠️ @${r.above} passou você no ranking!`, body: `Você caiu para o ${r.pos}º lugar da temporada. Bora recuperar?` },
      { title: '🏆 Perdeu uma posição no ranking!', body: `@${r.above} está logo à sua frente. Jogue hoje e passe de volta!` },
    ]);
    case 'missions': return pick([
      { title: `📜 Faltam ${r.missions} ${r.missions === 1 ? 'missão' : 'missões'} hoje`, body: 'Termine e pegue seus talentos antes da meia-noite!' },
      { title: '🎯 Quase lá!', body: `Só ${r.missions} ${r.missions === 1 ? 'missão' : 'missões'} para completar o dia. Seu prêmio está esperando.` },
    ]);
    default: return pick([
      { title: `👋 ${n}, sentimos sua falta!`, body: 'Acenda a lamparina hoje e ganhe talentos de presente.' },
      { title: '📖 Uma nova aventura te espera', body: 'As missões de hoje já chegaram. Vamos jogar?' },
      { title: '✨ Hoje é dia de Gênesis!', body: 'Uma parada rápida acende sua lamparina e conta pontos no ranking.' },
    ]);
  }
}

Deno.serve(async () => {
  const secret = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!secret) return new Response('falta o segredo VAPID_PRIVATE_KEY', { status: 500 });
  webpush.setVapidDetails(SITE, PUBLIC_KEY, secret);
  const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 1 });
  let sent = 0; let gone = 0; let failed = 0;
  try {
    const [{ list }] = await sql`select public.genesis_push_batch() as list`;
    for (const r of (list || []) as Row[]) {
      const m = message(r);
      try {
        await webpush.sendNotification(
          { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
          JSON.stringify({ ...m, url: SITE, tag: `genesis-${r.kind}` }),
          { TTL: 4 * 3600, urgency: 'normal' },
        );
        sent += 1;
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) { await sql`select public.genesis_push_gone(${r.endpoint})`; gone += 1; } else failed += 1;
      }
    }
  } finally {
    await sql.end();
  }
  return Response.json({ sent, gone, failed });
});
