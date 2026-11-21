// Daily play limit for specific players. The list is limits.json at the site
// root: { "nick": minutesPerDay } (0 removes the limit). Once a nick is listed
// the limit is kept in that player's save, so changing the nick does not escape it.
// When today's play time reaches the limit the game rests until midnight.

const today = () => new Date().toLocaleDateString('sv-SE');
const isOwner = () => { try { return localStorage.getItem('genesis.owner') === '1'; } catch { return false; } };

function block(min) {
  if (document.getElementById('maintenance')) return;
  const el = document.createElement('div');
  el.id = 'maintenance';
  el.innerHTML = `<div class="maint__box"><div class="maint__icon">🌙</div>
    <h1 class="maint__title">Hora de descansar</h1>
    <p class="maint__msg"></p><p class="maint__small">Seu progresso está guardado. O jogo volta amanhã.</p></div>`;
  el.querySelector('.maint__msg').textContent = `Você já jogou ${min} minutos hoje. Que tal ler a Bíblia, brincar lá fora ou ajudar em casa?`;
  document.body.appendChild(el);
}

export function startLimits(save) {
  if (isOwner()) return;
  const check = () => {
    const s = save.state;
    const min = s.dailyLimit;
    if (!min) return;
    const secs = (s.play && s.play.days && s.play.days[today()]) || 0;
    if (secs >= min * 60) block(min);
  };
  fetch(`limits.json?t=${Date.now()}`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : {})).then((list) => {
    const nick = String(save.state.nick || '').toLowerCase();
    if (!nick || !(nick in list)) return;
    const min = Math.max(0, Number(list[nick]) || 0);
    if (save.state.dailyLimit !== min) save.update((s) => { if (min) s.dailyLimit = min; else delete s.dailyLimit; });
  }).catch(() => {}).finally(check);
  setInterval(check, 60000);
}
