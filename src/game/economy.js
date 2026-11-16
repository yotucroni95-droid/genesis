import { checkLamp, lightLamp, trackWeekly, addFe, boxFragments, power, addDenarios } from './meta.js';

// Game economy: stars, coins ("talentos"), trophies, ranks, boxes, daily
// missions and login streak. Only game currency — no real money anywhere.

export const RARITIES = ['comum', 'raro', 'épico', 'lendário'];
export const RARITY_LABEL = { comum: 'Comum', raro: 'Raro', 'épico': 'Épico', 'lendário': 'Lendário' };
export const RARITY_COLOR = { comum: '#9fb3c8', raro: '#4fa3ff', 'épico': '#b56dff', 'lendário': '#ffc93c' };

export const RANKS = [
  { id: 'bronze1', name: 'Bronze I', min: 0, color: '#c07a3c' },
  { id: 'bronze2', name: 'Bronze II', min: 30, color: '#c07a3c' },
  { id: 'bronze3', name: 'Bronze III', min: 60, color: '#c07a3c' },
  { id: 'prata1', name: 'Prata I', min: 100, color: '#c6d2e0' },
  { id: 'prata2', name: 'Prata II', min: 150, color: '#c6d2e0' },
  { id: 'prata3', name: 'Prata III', min: 200, color: '#c6d2e0' },
  { id: 'ouro1', name: 'Ouro I', min: 280, color: '#ffd36e' },
  { id: 'ouro2', name: 'Ouro II', min: 360, color: '#ffd36e' },
  { id: 'ouro3', name: 'Ouro III', min: 450, color: '#ffd36e' },
  { id: 'diamante', name: 'Diamante', min: 560, color: '#6fe7ff' },
  { id: 'lendario', name: 'Lendário', min: 700, color: '#ff8fd0' },
];

export const SHOP = [
  { rarity: 'comum', price: 60 },
  { rarity: 'raro', price: 150 },
  { rarity: 'épico', price: 350 },
  { rarity: 'lendário', price: 800 },
];

export const FREE_BOX_MS = 4 * 60 * 60 * 1000; // a free box every 4 hours

const today = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD in local time
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// ---------- ranks ----------

export function rankFor(trophies) {
  let r = RANKS[0];
  for (const x of RANKS) if (trophies >= x.min) r = x;
  return r;
}

export function nextRank(trophies) {
  return RANKS.find((r) => r.min > trophies) || null;
}

/** Adds trophies; returns the new rank if the player just went up. */
export function addTrophies(save, n) {
  const before = rankFor(save.state.trophies || 0);
  save.update((s) => { s.trophies = Math.max(0, (s.trophies || 0) + n); });
  const after = rankFor(save.state.trophies);
  if (after.id !== before.id && after.min > before.min) {
    // every new rank gives a box: better ranks, better boxes
    const idx = RANKS.indexOf(after);
    addBox(save, idx >= 9 ? 'lendário' : idx >= 6 ? 'épico' : idx >= 3 ? 'raro' : 'comum', 'patente');
    return after;
  }
  return null;
}

export function addCoins(save, n) {
  save.update((s) => { s.coins = Math.max(0, (s.coins || 0) + n); });
}

// ---------- stars ----------

export function starsFor(score) {
  if (score >= 90) return 3;
  if (score >= 60) return 2;
  return 1;
}

export function totalStars(save) {
  return Object.entries(save.state.stars || {}).reduce((a, [k, b]) => a + (k.includes('#') ? 0 : b), 0);
}

// ---------- boxes ----------

let uidSeq = 0;
export function addBox(save, rarity, from = '') {
  save.update((s) => { s.boxes = [...(s.boxes || []), { uid: `${Date.now()}-${uidSeq++}`, rarity, from }]; });
}

/** More trophies = more chance the box upgrades to a rarer one. */
export function rollUpgrade(save, rarity) {
  const t = save.state.trophies || 0;
  let i = RARITIES.indexOf(rarity);
  const chance = Math.min(0.45, 0.08 + t / 1600); // 8% at the start, up to 45%
  while (i < RARITIES.length - 1 && Math.random() < chance) i += 1;
  return RARITIES[i];
}

export function freeBoxReadyIn(save) {
  return Math.max(0, (save.state.freeBoxAt || 0) + FREE_BOX_MS - Date.now());
}

export function claimFreeBox(save) {
  if (freeBoxReadyIn(save) > 0) return null;
  const rarity = rollUpgrade(save, 'comum');
  save.update((s) => { s.freeBoxAt = Date.now(); });
  addBox(save, rarity, 'grátis');
  return rarity;
}

export function buyBox(save, rarity) {
  const item = SHOP.find((x) => x.rarity === rarity);
  if (!item || (save.state.coins || 0) < item.price) return false;
  addCoins(save, -item.price);
  addBox(save, rarity, 'loja');
  return true;
}

const CARDS_BY_RARITY = { comum: 1, raro: 2, 'épico': 3, 'lendário': 4 };
const COINS_BY_RARITY = { comum: [20, 40], raro: [50, 90], 'épico': [100, 160], 'lendário': [200, 300] };

function pickCard(verses, minRarity) {
  // weighted draw, never below the minimum rarity
  const weights = { comum: 60, raro: 28, 'épico': 9, 'lendário': 3 };
  const minI = RARITIES.indexOf(minRarity);
  const pool = verses.filter((v) => RARITIES.indexOf(v.rarity) >= minI);
  const total = pool.reduce((n, v) => n + weights[v.rarity], 0);
  let r = Math.random() * total;
  for (const v of pool) { r -= weights[v.rarity]; if (r <= 0) return v; }
  return pool[pool.length - 1];
}

/** Opens a box from the inventory and returns what was inside. */
export function openBox(save, uid, content) {
  const box = (save.state.boxes || []).find((b) => b.uid === uid);
  if (!box) return null;
  const { rarity } = box;
  const items = [];
  const [cmin, cmax] = COINS_BY_RARITY[rarity];
  const coins = rand(cmin, cmax);
  items.push({ type: 'coins', amount: coins });

  const verses = content.verses;
  const n = CARDS_BY_RARITY[rarity];
  for (let i = 0; i < n; i++) {
    const card = pickCard(verses, i === 0 ? rarity : 'comum'); // first card matches the box rarity
    const isNew = !save.state.verses[card.id];
    items.push({ type: 'verse', card, isNew });
    save.state.verses[card.id] = (save.state.verses[card.id] || 0) + 1;
  }

  const cosmeticChance = { comum: 0.05, raro: 0.15, 'épico': 0.35, 'lendário': 1 }[rarity];
  if (Math.random() < cosmeticChance) {
    const kind = pick(['titles', 'frames', 'trails']);
    const minI = Math.max(0, RARITIES.indexOf(rarity) - 1);
    const pool = content.cosmetics[kind].filter((c) => RARITIES.indexOf(c.rarity) >= minI && !(save.state[kind] || {})[c.id]);
    if (pool.length) {
      const c = pick(pool);
      save.state[kind] = { ...(save.state[kind] || {}), [c.id]: new Date().toISOString() };
      items.push({ type: { titles: 'title', frames: 'frame', trails: 'trail' }[kind], item: c });
    }
  }

  save.update((s) => {
    s.coins = (s.coins || 0) + coins;
    s.boxes = s.boxes.filter((b) => b.uid !== uid);
  });
  items.push(...boxFragments(save, rarity));
  track(save, 'openBox', 1);
  return { rarity, items };
}

// ---------- daily missions and streak ----------

const MISSION_POOL = [
  { type: 'stops', target: 2, text: 'Conclua 2 paradas (pode repetir)' },
  { type: 'stops', target: 3, text: 'Conclua 3 paradas (pode repetir)' },
  { type: 'correct', target: 10, text: 'Acerte 10 perguntas' },
  { type: 'correct', target: 15, text: 'Acerte 15 perguntas' },
  { type: 'tttWin', target: 1, text: 'Vença 1 jogo da velha' },
  { type: 'memory', target: 1, text: 'Complete 1 jogo da memória' },
  { type: 'puzzle', target: 1, text: 'Monte 1 quebra-cabeça' },
  { type: 'threeStars', target: 1, text: 'Consiga 3 estrelas numa parada' },
  { type: 'arenaScore', target: 150, text: 'Faça 150 pontos numa Arena' },
  { type: 'arenaPlay', target: 2, text: 'Jogue 2 partidas na Arena' },
  { type: 'openBox', target: 1, text: 'Abra 1 baú' },
];

function newMissions() {
  const chosen = [];
  const types = new Set();
  while (chosen.length < 3) {
    const m = pick(MISSION_POOL);
    if (types.has(m.type)) continue;
    types.add(m.type);
    chosen.push({ ...m, progress: 0, reward: rand(40, 60), claimed: false });
  }
  return chosen;
}

/** Call when the game opens: refreshes missions and the login streak. */
export function startDay(save) {
  const d = today();
  const events = [];
  if (!save.state.daily || save.state.daily.date !== d) {
    save.update((s) => { s.daily = { date: d, missions: newMissions(), bonusClaimed: false }; });
  }
  const lampEvent = checkLamp(save); // the lamp (ofensiva) goes out if days were missed
  if (lampEvent) events.push(lampEvent);
  return events;
}

const LIGHTS_LAMP = new Set(['stops', 'arenaPlay', 'daily']);
const FE_FOR = { stops: 20, threeStars: 10, arenaPlay: 15, daily: 15, openBox: 5 };

/** Records progress for daily and weekly missions, the lamp and the pass. */
export function track(save, type, amount = 1) {
  if (LIGHTS_LAMP.has(type) && lightLamp(save)) trackWeekly(save, 'lampDays', 1);
  if (FE_FOR[type]) addFe(save, FE_FOR[type]);
  trackWeekly(save, type, amount);
  const daily = save.state.daily;
  if (!daily) return;
  let changed = false;
  for (const m of daily.missions) {
    if (m.type !== type || m.claimed) continue;
    const next = type === 'arenaScore' ? Math.max(m.progress, amount) : m.progress + amount;
    if (next !== m.progress) { m.progress = Math.min(m.target, next); changed = true; }
  }
  if (changed) save.update(() => {});
  // general statistics for the profile
  save.update((s) => { s.stats = { ...s.stats, [type]: (s.stats?.[type] || 0) + (type === 'arenaScore' ? 0 : amount) }; });
}

export function claimMission(save, index) {
  const m = save.state.daily && save.state.daily.missions[index];
  if (!m || m.claimed || m.progress < m.target) return null;
  m.claimed = true;
  save.update(() => {});
  addCoins(save, m.reward);
  addFe(save, 25);
  trackWeekly(save, 'dailyMissions', 1);
  const rankUp = addTrophies(save, 5);
  let bonus = null;
  if (save.state.daily.missions.every((x) => x.claimed) && !save.state.daily.bonusClaimed) {
    save.update((s) => { s.daily.bonusClaimed = true; });
    addBox(save, rollUpgrade(save, 'raro'), 'missões');
    bonus = true;
  }
  return { coins: m.reward, trophies: 5, rankUp, bonus };
}

export function pendingMissions(save) {
  const d = save.state.daily;
  return d ? d.missions.filter((m) => !m.claimed && m.progress >= m.target).length : 0;
}

// ---------- rewards after a stop ----------

export const heroKey = (stopId) => `${stopId}#heroi`;

/**
 * Gives stars, coins and trophies for a finished stop and updates missions.
 * Returns a list of things to celebrate.
 */
export function rewardStop(save, chapter, stop, result, isFirstTime) {
  const out = [];
  const stars = starsFor(result.score);
  const key = result.hero ? heroKey(stop.id) : stop.id; // Modo Herói keeps its own stars
  const prev = (save.state.stars || {})[key] || 0;
  const newStars = Math.max(0, stars - prev);
  if (newStars) save.update((s) => { s.stars = { ...s.stars, [key]: stars }; });
  out.push({ type: 'stars', stars, newStars });

  const hero = Boolean(result.hero);
  const base = ((isFirstTime ? 30 : 5) + newStars * 20) * (hero ? 2 : 1) + (hero ? 20 : 0);
  const coins = Math.round(base * (1 + power(save, 'coins') / 100));
  addCoins(save, coins);
  out.push({ type: 'coins', amount: coins });

  const trophyBase = newStars * 10 + (hero ? 5 : 0);
  if (trophyBase) {
    const t = Math.round(trophyBase * (1 + power(save, 'trophies') / 100));
    const rankUp = addTrophies(save, t);
    out.push({ type: 'trophies', amount: t });
    if (rankUp) out.push({ type: 'rank', rank: rankUp });
  }
  if (hero) {
    const den = stars === 3 ? 3 : 1;
    addDenarios(save, den);
    out.push({ type: 'denarios', amount: den });
    track(save, 'hero', 1);
  }
  if (result.newGame) track(save, 'newGames', 1);

  track(save, 'stops', 1);
  if (stars === 3) track(save, 'threeStars', 1);
  const t = result.type || stop.challenge.type;
  if (t === 'tictactoe') track(save, 'tttWin', 1);
  if (t === 'memory') track(save, 'memory', 1);
  if (t === 'puzzle') track(save, 'puzzle', 1);
  if (result.correct) track(save, 'correct', result.correct);
  return out;
}

/** A chapter finished: a guaranteed rare box (epic for the last one). */
export function rewardChapter(save, chapter) {
  if (chapter.finalReward) { // the end of Genesis: legendary box and a special title
    addBox(save, chapter.finalReward.box, 'fim de Gênesis');
    if (chapter.finalReward.title) save.update((s) => { s.titles = { ...s.titles, [chapter.finalReward.title]: new Date().toISOString() }; });
    return chapter.finalReward.box;
  }
  const rarity = rollUpgrade(save, chapter.number >= 4 ? 'épico' : 'raro');
  addBox(save, rarity, 'capítulo');
  return rarity;
}
