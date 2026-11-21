import { isSabbath } from './sabbath.js';
import { checkLamp, lightLamp, trackWeekly, addFe, boxFragments, power, addDenarios } from './meta.js';

// Game economy: stars, coins ("talentos"), trophies, ranks, boxes, daily
// missions and login streak. Only game currency — no real money anywhere.

export const RARITIES = ['comum', 'raro', 'épico', 'lendário'];
export const RARITY_LABEL = { comum: 'Comum', raro: 'Raro', 'épico': 'Épico', 'lendário': 'Lendário' };
export const RARITY_COLOR = { comum: '#9fb3c8', raro: '#4fa3ff', 'épico': '#b56dff', 'lendário': '#ffc93c' };

// Every rank has three steps; the trophies needed grow fast, so the top
// ranks take months. `art` reuses a badge picture, `tint` recolours it.
export const RANKS = [
  { id: 'bronze1', name: 'Bronze I', min: 0, color: '#c07a3c' },
  { id: 'bronze2', name: 'Bronze II', min: 60, color: '#c07a3c' },
  { id: 'bronze3', name: 'Bronze III', min: 130, color: '#c07a3c' },
  { id: 'prata1', name: 'Prata I', min: 220, color: '#c6d2e0' },
  { id: 'prata2', name: 'Prata II', min: 320, color: '#c6d2e0' },
  { id: 'prata3', name: 'Prata III', min: 440, color: '#c6d2e0' },
  { id: 'ouro1', name: 'Ouro I', min: 600, color: '#ffd36e' },
  { id: 'ouro2', name: 'Ouro II', min: 780, color: '#ffd36e' },
  { id: 'ouro3', name: 'Ouro III', min: 980, color: '#ffd36e' },
  { id: 'diamante1', name: 'Diamante I', min: 1220, color: '#6fe7ff' },
  { id: 'diamante2', name: 'Diamante II', min: 1500, color: '#6fe7ff' },
  { id: 'diamante3', name: 'Diamante III', min: 1820, color: '#6fe7ff' },
  { id: 'lendario1', name: 'Lendário I', min: 2200, color: '#ff8fd0' },
  { id: 'lendario2', name: 'Lendário II', min: 2650, color: '#ff8fd0' },
  { id: 'lendario3', name: 'Lendário III', min: 3150, color: '#ff8fd0' },
  { id: 'mestre1', name: 'Mestre I', min: 3750, color: '#b56dff', art: 'diamante', tint: 'hue-rotate(80deg) saturate(1.3)' },
  { id: 'mestre2', name: 'Mestre II', min: 4450, color: '#b56dff', art: 'diamante', tint: 'hue-rotate(80deg) saturate(1.3)' },
  { id: 'mestre3', name: 'Mestre III', min: 5250, color: '#b56dff', art: 'diamante', tint: 'hue-rotate(80deg) saturate(1.3)' },
  { id: 'campeao1', name: 'Campeão da Fé I', min: 6200, color: '#ff5a46', art: 'lendario', tint: 'hue-rotate(-40deg) saturate(1.4)' },
  { id: 'campeao2', name: 'Campeão da Fé II', min: 7300, color: '#ff5a46', art: 'lendario', tint: 'hue-rotate(-40deg) saturate(1.4)' },
  { id: 'campeao3', name: 'Campeão da Fé III', min: 8600, color: '#ff5a46', art: 'lendario', tint: 'hue-rotate(-40deg) saturate(1.4)' },
  { id: 'coroa', name: 'Coroa da Vida I', min: 10000, color: '#fff1b8', art: 'lendario', tint: 'saturate(1.6) brightness(1.15) drop-shadow(0 0 6px #ffe27a)' },
  ...tier('coroa', 'Coroa da Vida', [11600, 13400], '#fff1b8', 'lendario', 'saturate(1.6) brightness(1.15) drop-shadow(0 0 6px #ffe27a)', 2),
  ...tier('estrela', 'Estrela da Manhã', [15500, 18000, 20800], '#ffe9a8', 'diamante', 'sepia(.6) saturate(2.4) hue-rotate(5deg) brightness(1.2) drop-shadow(0 0 6px #fff3b0)'),
  ...tier('sacerdocio', 'Sacerdócio Real', [24000, 27600, 31600], '#c9a2ff', 'lendario', 'hue-rotate(200deg) saturate(1.5) drop-shadow(0 0 6px #c9a2ff)'),
  ...tier('nacao', 'Nação Santa', [36000, 41000, 46500], '#7dffc4', 'diamante', 'hue-rotate(-60deg) saturate(1.6) drop-shadow(0 0 6px #7dffc4)'),
  ...tier('siao', 'Monte Sião', [52500, 59000, 66000], '#ffb36b', 'lendario', 'hue-rotate(-90deg) saturate(1.8) drop-shadow(0 0 7px #ffb36b)'),
  ...tier('jerusalem', 'Nova Jerusalém', [74000, 83000, 93000], '#ffffff', 'lendario', 'grayscale(.4) brightness(1.5) drop-shadow(0 0 8px #ffffff)'),
  // after Nova Jerusalém the climb never ends: Glória 1, 2, 3... (each a bit further)
  ...Array.from({ length: 200 }, (_, i) => ({ id: `gloria${i + 1}`, name: `Glória ${i + 1}`, min: 105000 + i * 14000 + Math.round(i * i * 60), color: '#ffe27a', art: 'lendario', tint: `hue-rotate(${(i * 37) % 360}deg) saturate(1.8) brightness(1.2) drop-shadow(0 0 8px #ffe27a)`, gloria: true })),
];
function tier(id, name, mins, color, art, tint, from = 1) {
  return mins.map((min, i) => ({ id: `${id}${from + i}`, name: `${name} ${['I', 'II', 'III'][from + i - 1]}`, min, color, art, tint }));
}
/** The ranks worth showing in a list: all named ones up to the next few. */
export function visibleRanks(trophies) {
  const i = RANKS.indexOf(rankFor(trophies));
  return RANKS.filter((r, k) => !r.gloria || k <= i + 3);
}
/** Arena trophies lost by a weak game at high ranks (the top must be defended). */
export function arenaLoss(trophies, score) {
  const i = RANKS.indexOf(rankFor(trophies));
  if (i < 12) return 0; // below Lendário nothing is lost
  const need = i < 15 ? 80 : i < 21 ? 160 : i < 30 ? 240 : 320;
  if (score >= need) return 0;
  return i < 15 ? 4 : i < 21 ? 7 : i < 30 ? 10 : 14;
}

// ---------- weekly ranking: Pontos de Temporada (resets every Monday) ----------
// Trophies and achievements are permanent; the weekly ranking counts Season
// Points (PT), earned by trophies and by playing (missions, stops, answers...).
/** The Monday that starts this week, as YYYY-MM-DD in local time. */
export function weekId(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  return d.toLocaleDateString('sv-SE');
}
function addWeekly(s, n, { trophies = n } = {}) {
  const id = weekId();
  if (s.week && s.week.id !== id) s.lastWeek = { id: s.week.id, trophies: s.week.trophies || 0, points: s.week.points || 0 };
  if (!s.week || s.week.id !== id) s.week = { id, trophies: 0, points: 0 };
  s.week.trophies += trophies;
  s.week.points = (s.week.points || 0) + n;
}
/** Season Points for playing (trophies already count by themselves). */
export const POINTS_FOR = { stops: 5, threeStars: 10, correct: 1, arenaPlay: 3, daily: 10, dailyMission: 10, onlineWin: 15, openBox: 2 };
export function addSeasonPoints(save, n) {
  if (isSabbath()) return; // Modo Sábado: no competition points
  if (n > 0) save.update((s) => addWeekly(s, n, { trophies: 0 }));
}
export const seasonPoints = (s) => (s.week && s.week.id === weekId() ? s.week.points || 0 : 0);
/** The picture of a rank's badge (ranks above Lendário reuse a recoloured one). */
export const rankArt = (r) => r.art || r.id.replace(/\d$/, '');

export const SHOP = [
  { rarity: 'comum', price: 180 },
  { rarity: 'raro', price: 450 },
  { rarity: 'épico', price: 1000 },
  { rarity: 'lendário', price: 2200 },
];

export const FREE_BOX_MS = 6 * 60 * 60 * 1000; // a free box every 6 hours

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
  if (isSabbath()) return null; // Modo Sábado: trophies rest
  const before = rankFor(save.state.trophies || 0);
  save.update((s) => { s.trophies = Math.max(0, (s.trophies || 0) + n); if (n > 0) addWeekly(s, n); });
  const after = rankFor(save.state.trophies);
  if (after.id !== before.id && after.min > before.min) {
    // a rank gives its box only the first time it is reached
    const idx = RANKS.indexOf(after);
    if (idx > (save.state.rankBest ?? RANKS.indexOf(before))) {
      save.update((s) => { s.rankBest = idx; });
      addBox(save, idx >= 15 ? 'lendário' : idx >= 9 ? 'épico' : idx >= 3 ? 'raro' : 'comum', 'patente');
    }
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
  const chance = Math.min(0.4, 0.06 + t / 6000); // 6% at the start, up to 40%
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
const COINS_BY_RARITY = { comum: [8, 15], raro: [20, 35], 'épico': [45, 70], 'lendário': [90, 140] };

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
    chosen.push({ ...m, progress: 0, reward: rand(20, 35), claimed: false });
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
  if (POINTS_FOR[type]) addSeasonPoints(save, POINTS_FOR[type] * (type === 'correct' ? Math.min(amount, 50) : 1));
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
  addSeasonPoints(save, POINTS_FOR.dailyMission);
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
  // first time pays; replays pay almost nothing unless they earn new stars
  const base = ((isFirstTime ? 20 : 2) + newStars * 10) * (hero ? 2 : 1) + (hero ? 10 : 0);
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
    const den = stars === 3 ? 2 : 1;
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
    addBox(save, chapter.finalReward.box, chapter.event ? 'Acampamento' : `fim do capítulo ${chapter.number}`);
    if (chapter.finalReward.title) save.update((s) => { s.titles = { ...s.titles, [chapter.finalReward.title]: new Date().toISOString() }; });
    return chapter.finalReward.box;
  }
  const rarity = rollUpgrade(save, chapter.number >= 4 ? 'épico' : 'raro');
  addBox(save, rarity, 'capítulo');
  return rarity;
}
