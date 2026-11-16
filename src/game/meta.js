// Season 2 systems: denários (rare coin), character fragments and powers,
// the lamp streak (ofensiva), weekly missions, the "Passe da Fé" and the
// daily shop offers. Everything lives in the save on this phone.

import { addBox, addCoins } from './economy.js';

const DAY = 864e5;
const EPOCH = Date.UTC(2026, 10, 16); // Monday 16 Nov 2026: season 1, week 1 starts
export const today = () => new Date().toLocaleDateString('sv-SE');
const dayIndex = (d = new Date()) => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH) / DAY);
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DAY);
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

/** Small seeded random generator, so everybody gets the same offers on the same day. */
export function seeded(seed) {
  let x = (seed * 2654435761) >>> 0 || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}

// ---------- events (toasts and celebrations are shown by main.js) ----------

let listener = () => {};
export function onMetaEvent(fn) { listener = fn; }
const emit = (e) => { try { listener(e); } catch { /* never break the game */ } };

// ---------- denários ----------

export function addDenarios(save, n) {
  save.update((s) => { s.denarios = Math.max(0, (s.denarios || 0) + n); });
}

// ---------- characters, fragments and powers ----------

export const FRAGMENTS_NEEDED = 10;
export const RARITY_ORDER = ['comum', 'raro', 'épico', 'lendário', 'único'];
let CHARS = [];
export function setCharacters(list) { CHARS = list; }
export const collectible = () => CHARS.filter((c) => c.rarity && c.rarity !== 'único');
export const charById = (id) => CHARS.find((c) => c.id === id);

/** Sum of a power of the character the player is using (e.g. 'coins' = +% talentos). */
export function power(save, key) {
  const c = charById(save.state.avatarId);
  return (c && c.power && c.power[key]) || 0;
}

export const POWER_TEXT = {
  coins: (v) => `+${v}% de talentos nas paradas`,
  fe: (v) => `+${v}% de pontos no Passe da Fé`,
  arenaCoins: (v) => `+${v}% de talentos na Arena`,
  arenaLife: (v) => `+${v} vida na Arena`,
  arenaTime: (v) => `+${v} segundos por pergunta na Arena`,
  trophies: (v) => `+${v}% de troféus`,
  hint: () => 'Uma dica por partida: tira uma resposta errada',
};
export function powerLines(c) {
  return Object.entries((c && c.power) || {}).map(([k, v]) => (POWER_TEXT[k] ? POWER_TEXT[k](v) : ''));
}

/** Gives fragments; unlocks the character at 10. Returns { id, amount, unlocked }. */
export function addFragments(save, id, amount) {
  if (save.isUnlocked(id)) {
    const comp = { comum: 2, raro: 4, 'épico': 8, 'lendário': 15 }[(charById(id) || {}).rarity] || 2;
    addDenarios(save, comp);
    return { id, amount, unlocked: false, converted: comp };
  }
  let unlocked = false;
  save.update((s) => {
    s.fragments = { ...(s.fragments || {}) };
    s.fragments[id] = (s.fragments[id] || 0) + amount;
    if (s.fragments[id] >= FRAGMENTS_NEEDED) {
      s.unlocked[id] = new Date().toISOString();
      delete s.fragments[id];
      unlocked = true;
    }
  });
  if (unlocked) { emit({ type: 'unlockChar', id }); checkJesus(save); }
  return { id, amount, unlocked };
}

/** Picks a character of a rarity, preferring the ones the player still lacks. */
export function pickCharacter(save, rarity, rnd = Math.random) {
  const pool = collectible().filter((c) => c.rarity === rarity);
  const missing = pool.filter((c) => !save.isUnlocked(c.id));
  const list = missing.length ? missing : pool;
  return list.length ? list[Math.floor(rnd() * list.length)] : null;
}

function weighted(weights, rnd = Math.random) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = rnd() * total;
  for (const [k, w] of Object.entries(weights)) { r -= w; if (r <= 0) return k; }
  return Object.keys(weights)[0];
}

const DROPS = {
  comum: [[3, { comum: 80, raro: 20 }]],
  raro: [[4, { comum: 50, raro: 40, 'épico': 10 }]],
  'épico': [[5, { raro: 50, 'épico': 45, 'lendário': 5 }], [3, { comum: 60, raro: 40 }]],
  'lendário': [[6, { 'épico': 50, 'lendário': 50 }], [4, { raro: 50, 'épico': 50 }]],
};
const JESUS_CHANCE = 1 / 500; // only in legendary boxes

/** Fragments (and sometimes Jesus) inside a box. Returns loot items. */
export function boxFragments(save, boxRarity) {
  const items = [];
  if (boxRarity === 'lendário' && !save.isUnlocked('jesus') && Math.random() < JESUS_CHANCE) {
    save.unlock('jesus');
    items.push({ type: 'jesus' });
    emit({ type: 'unlockChar', id: 'jesus', jesus: true });
  }
  for (const [amount, weights] of DROPS[boxRarity] || []) {
    const c = pickCharacter(save, weighted(weights));
    if (!c) continue;
    const r = addFragments(save, c.id, amount);
    items.push({ type: 'fragments', character: c, ...r, have: (save.state.fragments || {})[c.id] || 0 });
  }
  const den = { comum: 0, raro: 1, 'épico': rand(3, 6), 'lendário': rand(8, 15) }[boxRarity] || 0;
  if (den) { addDenarios(save, den); items.push({ type: 'denarios', amount: den }); }
  return items;
}

/** Whoever collects every other character receives Jesus. */
export function checkJesus(save) {
  if (save.isUnlocked('jesus')) return false;
  if (!collectible().every((c) => save.isUnlocked(c.id))) return false;
  save.unlock('jesus');
  emit({ type: 'unlockChar', id: 'jesus', jesus: true });
  return true;
}

// ---------- lamp streak (ofensiva) ----------

export function lamp(save) {
  const l = save.state.lamp || { count: 0, last: '', best: 0 };
  return { ...l, litToday: l.last === today() };
}

/** Lamp colour stage: 0 off, 1 gold, 2 blue (30+), 3 white (100+). */
export function lampStage(count, lit = true) {
  if (!lit && !count) return 0;
  return count >= 100 ? 3 : count >= 30 ? 2 : 1;
}

/** On opening the game: if days were missed, olive oil saves the lamp, else it goes out. */
export function checkLamp(save) {
  const s = save.state;
  if (!s.lamp) {
    const old = s.streak || { count: 0, last: '' }; // migrate the old login streak
    save.update((st) => { st.lamp = { count: old.count || 0, last: old.last || '', best: old.count || 0 }; });
  }
  const l = save.state.lamp;
  if (!l.last || !l.count) return null;
  const gap = daysBetween(l.last, today());
  if (gap <= 1) return null;
  const missed = gap - 1;
  if ((s.oil || 0) >= missed) {
    const yesterday = new Date(Date.now() - DAY).toLocaleDateString('sv-SE');
    save.update((st) => { st.oil -= missed; st.lamp = { ...st.lamp, last: yesterday }; });
    return { type: 'oilUsed', missed, count: l.count };
  }
  save.update((st) => { st.lamp = { ...st.lamp, count: 0 }; });
  return { type: 'lampOut', was: l.count };
}

/** The first thing done each day lights the lamp. */
export function lightLamp(save) {
  const l = save.state.lamp || { count: 0, last: '', best: 0 };
  const d = today();
  if (l.last === d) return null;
  const count = (daysBetween(l.last || d, d) === 1 ? l.count : 0) + 1;
  save.update((s) => { s.lamp = { count, last: d, best: Math.max(l.best || 0, count) }; s.streak = { count, last: d }; });
  const coins = 20 * (((count - 1) % 7) + 1);
  addCoins(save, coins);
  const prizes = [];
  if (count % 7 === 0) { addBox(save, 'épico', 'lamparina'); prizes.push('um baú Épico'); }
  if (count === 30) { addDenarios(save, 20); grantCosmetic(save, 'frames', 'estrela_belem'); prizes.push('20 denários e a moldura Estrela de Belém'); }
  if (count === 100) { addBox(save, 'lendário', 'lamparina'); grantCosmetic(save, 'titles', 'lampada_acesa'); prizes.push('um baú Lendário e o título A Lâmpada Acesa'); }
  addFe(save, 10);
  emit({ type: 'lampLit', count, coins, prizes });
  return { count, coins, prizes };
}

export function grantCosmetic(save, kind, id) {
  if ((save.state[kind] || {})[id]) return false;
  save.update((s) => { s[kind] = { ...(s[kind] || {}), [id]: new Date().toISOString() }; });
  return true;
}

// ---------- weekly missions ----------

const WEEKLY_POOL = [
  { type: 'stops', target: 12, text: 'Conclua 12 paradas' },
  { type: 'correct', target: 60, text: 'Acerte 60 perguntas' },
  { type: 'arenaPlay', target: 8, text: 'Jogue 8 partidas na Arena' },
  { type: 'arenaScore', target: 400, text: 'Faça 400 pontos numa partida da Arena' },
  { type: 'threeStars', target: 6, text: 'Consiga 3 estrelas em 6 paradas' },
  { type: 'openBox', target: 4, text: 'Abra 4 baús' },
  { type: 'lampDays', target: 5, text: 'Acenda a lamparina em 5 dias' },
  { type: 'dailyMissions', target: 9, text: 'Resgate 9 missões do dia' },
  { type: 'hero', target: 3, text: 'Vença 3 desafios no Modo Herói' },
  { type: 'newGames', target: 6, text: 'Jogue 6 vezes os jogos novos (ordem, versículo, V ou F, caça-palavras)' },
  { type: 'resist', target: 3, text: 'Resista 3 vezes às tentações no mapa' },
];

export const weekKey = () => Math.floor(dayIndex() / 7);
export function weekEndsIn() { return (7 - (((dayIndex() % 7) + 7) % 7)) * DAY - (Date.now() % DAY); }

export function weekly(save) {
  const w = weekKey();
  if (!save.state.weekly || save.state.weekly.week !== w) {
    const rnd = seeded(w + 7);
    const pool = WEEKLY_POOL.slice();
    const missions = [];
    while (missions.length < 4) missions.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    save.update((s) => { s.weekly = { week: w, missions: missions.map((m) => ({ ...m, progress: 0, reward: 6 + Math.floor(rnd() * 5), claimed: false })), bonusClaimed: false }; });
  }
  return save.state.weekly;
}

export function trackWeekly(save, type, amount) {
  const wk = weekly(save);
  let changed = false;
  for (const m of wk.missions) {
    if (m.type !== type || m.claimed) continue;
    const next = type === 'arenaScore' ? Math.max(m.progress, amount) : m.progress + amount;
    if (next !== m.progress) { m.progress = Math.min(m.target, next); changed = true; }
  }
  if (changed) save.update(() => {});
}

export function claimWeekly(save, i) {
  const wk = weekly(save);
  const m = wk.missions[i];
  if (!m || m.claimed || m.progress < m.target) return null;
  m.claimed = true;
  save.update(() => {});
  addDenarios(save, m.reward);
  addFe(save, 60);
  let bonus = false;
  if (wk.missions.every((x) => x.claimed) && !wk.bonusClaimed) {
    save.update((s) => { s.weekly.bonusClaimed = true; });
    addBox(save, 'épico', 'missões da semana');
    bonus = true;
  }
  return { denarios: m.reward, fe: 60, bonus };
}

export const pendingWeekly = (save) => weekly(save).missions.filter((m) => !m.claimed && m.progress >= m.target).length;

// ---------- Passe da Fé ----------

export const PASS_LEVELS = 30;
export const FE_PER_LEVEL = 100;
export const SEASON_DAYS = 28;
export const seasonNumber = () => Math.floor(dayIndex() / SEASON_DAYS) + 1;
export function seasonEndsIn() {
  const left = SEASON_DAYS - (((dayIndex() % SEASON_DAYS) + SEASON_DAYS) % SEASON_DAYS);
  return left * DAY - (Date.now() % DAY);
}

export function pass(save) {
  const n = seasonNumber();
  if (!save.state.pass || save.state.pass.season !== n) {
    save.update((s) => { s.pass = { season: n, fe: 0, claimed: {} }; });
  }
  const p = save.state.pass;
  return { ...p, level: Math.min(PASS_LEVELS, Math.floor(p.fe / FE_PER_LEVEL)) };
}

/** What each level of the pass gives. Same every season, but fragments change. */
export function passReward(level) {
  if (level === PASS_LEVELS) return { kind: 'final', label: 'Baú Lendário + título Herói da Fé + 30 denários' };
  if (level === 20) return { kind: 'frame', id: 'luz_celestial', label: 'Moldura Luz Celestial + 15 denários' };
  if (level === 10) return { kind: 'box', rarity: 'épico', label: 'Baú Épico' };
  if (level % 5 === 0) return { kind: 'box', rarity: 'raro', label: 'Baú Raro' };
  const cycle = [
    { kind: 'coins', amount: 60, label: '60 talentos' },
    { kind: 'frag', amount: 3, rarity: 'comum', label: '3 fragmentos' },
    { kind: 'denarios', amount: 3, label: '3 denários' },
    { kind: 'oil', amount: 1, label: '1 frasco de azeite' },
    { kind: 'frag', amount: 3, rarity: 'raro', label: '3 fragmentos raros' },
    { kind: 'coins', amount: 100, label: '100 talentos' },
  ];
  return cycle[level % cycle.length];
}

export function addFe(save, n) {
  const p = pass(save);
  const bonus = 1 + power(save, 'fe') / 100;
  const before = p.level;
  save.update((s) => { s.pass.fe += Math.round(n * bonus); });
  const after = pass(save).level;
  if (after > before) emit({ type: 'passLevel', level: after });
}

export function claimPass(save, level) {
  const p = pass(save);
  if (level > p.level || p.claimed[level]) return null;
  const r = passReward(level);
  const out = { ...r };
  if (r.kind === 'coins') addCoins(save, r.amount);
  if (r.kind === 'denarios') addDenarios(save, r.amount);
  if (r.kind === 'oil') save.update((s) => { s.oil = (s.oil || 0) + r.amount; });
  if (r.kind === 'box') addBox(save, r.rarity, 'Passe da Fé');
  if (r.kind === 'frag') {
    const c = pickCharacter(save, r.rarity);
    if (c) Object.assign(out, addFragments(save, c.id, r.amount), { character: c });
  }
  if (r.kind === 'frame') { grantCosmetic(save, 'frames', r.id); addDenarios(save, 15); }
  if (r.kind === 'final') { addBox(save, 'lendário', 'Passe da Fé'); grantCosmetic(save, 'titles', 'heroi_fe'); addDenarios(save, 30); }
  save.update((s) => { s.pass.claimed = { ...s.pass.claimed, [level]: true }; });
  return out;
}

export const pendingPass = (save) => {
  const p = pass(save);
  let n = 0;
  for (let l = 1; l <= p.level; l++) if (!p.claimed[l]) n++;
  return n;
};

// ---------- shop: offers of the day and pack of the week ----------

const OIL_MAX = 5;

/** Six offers, the same for everybody on the same day. */
export function dailyOffers(save, cosmetics) {
  const rnd = seeded(dayIndex() * 31 + 5);
  const offers = [];
  const fragOffer = (rarity, amount, price, currency) => {
    const pool = collectible().filter((c) => c.rarity === rarity);
    const c = pool[Math.floor(rnd() * pool.length)];
    if (c) offers.push({ kind: 'frag', id: c.id, amount, price, currency, label: `${amount} fragmentos de ${c.name}` });
  };
  fragOffer(rnd() < 0.6 ? 'comum' : 'raro', 5, 0, 'coins');
  offers[0].price = charById(offers[0].id).rarity === 'comum' ? 120 : 220;
  fragOffer('épico', 3, 12, 'denarios');
  fragOffer('lendário', 2, 25, 'denarios');
  offers.push({ kind: 'oil', amount: 1, price: 150, currency: 'coins', label: 'Frasco de azeite' });
  const kinds = ['frames', 'titles', 'trails'];
  const kind = kinds[Math.floor(rnd() * kinds.length)];
  const list = (cosmetics[kind] || []).filter((c) => !c.hidden);
  if (list.length) {
    const c = list[Math.floor(rnd() * list.length)];
    const price = { comum: 6, raro: 10, 'épico': 16, 'lendário': 24 }[c.rarity] || 10;
    offers.push({ kind: 'cosmetic', cosmeticKind: kind, id: c.id, price, currency: 'denarios', label: c.name, rarity: c.rarity });
  }
  offers.push({ kind: 'box', rarity: 'raro', price: 100, currency: 'coins', label: 'Baú Raro (promoção)' });
  const bought = (save.state.offers && save.state.offers.day === dayIndex()) ? save.state.offers.bought : {};
  return offers.map((o, i) => ({ ...o, i, bought: Boolean(bought[i]),
    owned: o.kind === 'cosmetic' ? Boolean((save.state[o.cosmeticKind] || {})[o.id]) : o.kind === 'frag' ? save.isUnlocked(o.id) : o.kind === 'oil' ? (save.state.oil || 0) >= OIL_MAX : false }));
}

export const WEEKLY_PACK = { price: 30, label: 'Pacote da semana', text: 'Baú Épico + 6 fragmentos épicos + 2 frascos de azeite' };

function pay(save, price, currency) {
  const have = currency === 'denarios' ? save.state.denarios || 0 : save.state.coins || 0;
  if (have < price) return false;
  if (currency === 'denarios') addDenarios(save, -price); else addCoins(save, -price);
  return true;
}

export function buyOffer(save, offer) {
  if (offer.bought || offer.owned) return { error: 'Você já tem isso.' };
  if (!pay(save, offer.price, offer.currency)) return { error: offer.currency === 'denarios' ? 'Denários insuficientes. Ganhe nas missões da semana, no Passe da Fé e em baús épicos.' : 'Talentos insuficientes.' };
  let result = {};
  if (offer.kind === 'frag') result = addFragments(save, offer.id, offer.amount);
  if (offer.kind === 'oil') save.update((s) => { s.oil = (s.oil || 0) + 1; });
  if (offer.kind === 'cosmetic') grantCosmetic(save, offer.cosmeticKind, offer.id);
  if (offer.kind === 'box') addBox(save, offer.rarity, 'loja');
  save.update((s) => {
    if (!s.offers || s.offers.day !== dayIndex()) s.offers = { day: dayIndex(), bought: {} };
    s.offers.bought[offer.i] = true;
  });
  return { ok: true, ...result };
}

export const weeklyPackBought = (save) => save.state.packWeek === weekKey();

export function buyWeeklyPack(save) {
  if (weeklyPackBought(save)) return { error: 'Você já comprou o pacote desta semana.' };
  if (!pay(save, WEEKLY_PACK.price, 'denarios')) return { error: 'Denários insuficientes.' };
  addBox(save, 'épico', 'pacote da semana');
  const c = pickCharacter(save, 'épico');
  const frag = c ? addFragments(save, c.id, 6) : null;
  save.update((s) => { s.oil = (s.oil || 0) + 2; s.packWeek = weekKey(); });
  return { ok: true, character: c, frag };
}
