// Maintenance mode. The switch is the file maintenance.json at the site root:
//   { "on": true, "message": "..." }  -> players see a "we'll be back" screen
//   { "on": false }                   -> the game works normally
// It is checked when the game opens and every minute while it is open.
// Without internet the game is not blocked (it keeps the last known state).
// The owner can still enter: hold the title for 3 s and type the secret code;
// that phone then skips maintenance from then on.

const CODE_HASH = '1107bd8973b47833b8b9e38b1d35fea1bd6179000467dbae2b8ba03a3ab2c797';
const OWNER_KEY = 'genesis.owner';

const isOwner = () => { try { return localStorage.getItem(OWNER_KEY) === '1'; } catch { return false; } };

async function readSwitch() {
  try {
    const res = await fetch(`maintenance.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return { on: false };
    return await res.json();
  } catch { return { on: false }; }
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function showScreen(info) {
  if (document.getElementById('maintenance')) return;
  const el = document.createElement('div');
  el.id = 'maintenance';
  el.innerHTML = `
    <div class="maint__box">
      <div class="maint__icon">🛠️</div>
      <h1 class="maint__title">Em manutenção</h1>
      <p class="maint__msg"></p>
      <p class="maint__small">Seu progresso está guardado. Volte daqui a pouco!</p>
      <button class="btn maint__retry" type="button">Tentar de novo</button>
      <div class="maint__owner" hidden>
        <input class="field__input" type="password" autocomplete="off" placeholder="Código">
        <button class="btn" type="button">Entrar</button>
      </div>
    </div>`;
  el.querySelector('.maint__msg').textContent = info.message || 'Estamos deixando o Gênesis ainda melhor.';
  el.querySelector('.maint__retry').addEventListener('click', () => location.reload());
  // hidden entrance for the game's owner
  const title = el.querySelector('.maint__title');
  const owner = el.querySelector('.maint__owner');
  let timer = null;
  title.addEventListener('pointerdown', () => { clearTimeout(timer); timer = setTimeout(() => { owner.hidden = false; owner.querySelector('input').focus(); }, 3000); });
  for (const t of ['pointerup', 'pointerleave', 'pointercancel']) title.addEventListener(t, () => clearTimeout(timer));
  const enter = async () => {
    const input = owner.querySelector('input');
    if ((await sha256(`genesis|${input.value.trim().toUpperCase()}`)) !== CODE_HASH) { input.value = ''; input.placeholder = 'Código errado'; return; }
    try { localStorage.setItem(OWNER_KEY, '1'); } catch { /* storage blocked */ }
    location.reload();
  };
  owner.querySelector('button').addEventListener('click', enter);
  owner.querySelector('input').addEventListener('keydown', (e) => { if (e.key === 'Enter') enter(); });
  document.body.appendChild(el);
}

/** True when the game must not start (maintenance is on and this is not the owner). */
export async function checkMaintenance() {
  if (isOwner()) return false;
  const info = await readSwitch();
  if (info.on) { showScreen(info); return true; }
  // keep checking while the game is open
  const again = async () => { const i = await readSwitch(); if (i.on && !isOwner()) showScreen(i); };
  setInterval(again, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) again(); });
  return false;
}
