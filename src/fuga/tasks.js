// Cooperative tasks of a Fuga round. A map has 26 stations; each round draws a
// balanced subset from the room seed (same on every phone) and places them on
// different spots. Mini-games REUSE the existing challenges (src/challenges).
//   kind 'challenge' → opens a challenge; 'colher' → walk over 3 fragments;
//   'ativar' → two plates that must be held at the same time (coop).

import { rng } from './map.js';

// [name, kind, challenge type]
const CATALOG = [
  ['Pergunta da Árvore', 'challenge', 'quiz'], ['Pergunta da Fonte', 'challenge', 'quiz'], ['Pergunta do Altar', 'challenge', 'quiz'],
  ['Ordenar a história', 'challenge', 'ordem'], ['Linha do tempo', 'challenge', 'ordem'],
  ['Versículo partido', 'challenge', 'versiculo'], ['Rolo das Escrituras', 'challenge', 'versiculo'],
  ['Verdadeiro ou falso', 'challenge', 'vf'], ['Palavras que faltam', 'challenge', 'lacunas'], ['Lacunas do profeta', 'challenge', 'lacunas'],
  ['Memória das Escrituras', 'challenge', 'memory'], ['Combinar símbolos', 'challenge', 'pares'],
  ['Sequência de símbolos', 'challenge', 'sequencia'], ['Sinais da coluna', 'challenge', 'sequencia'],
  ['Caça-palavras', 'challenge', 'cacapalavras'], ['Jogo da velha da luz', 'challenge', 'tictactoe'], ['Quem disse?', 'challenge', 'quemdisse'],
  ['Colher o maná', 'challenge', 'mana'], ['Cesto de frutos', 'challenge', 'cesto'],
  ['Fragmentos do pergaminho', 'colher'], ['Pedras do memorial', 'colher'], ['Sementes perdidas', 'colher'],
  ['Alavancas do portão', 'ativar'], ['Pedras de apoio', 'ativar'], ['Lâmpadas gêmeas', 'ativar'], ['Selos da aliança', 'ativar'],
];
const LIGHT = { quiz: { count: 3, minScore: 2 }, ordem: { count: 4 }, versiculo: { count: 2 }, vf: { count: 4 }, lacunas: { count: 2 }, cacapalavras: { count: 3 }, sequencia: { goal: 4 }, tictactoe: { difficulty: 0.2 }, mana: { goal: 8, seconds: 20 }, cesto: { seconds: 18 } };

export const catalogSize = () => CATALOG.length;

/** How many tasks a round needs: grows with players, so 5 people don't finish in a minute. */
export function taskCount(players, difficulty = 1) {
  const base = [0, 7, 9, 11, 12, 14][Math.max(1, Math.min(5, players))];
  return Math.round(base * [0.85, 1, 1.15][difficulty] || base);
}

/** Every challenge config used in the chapters, by type (the pool tasks draw from). */
export async function loadPool(assets) {
  const pool = {};
  const index = assets.json('chapters/index.json').chapters;
  const chapters = await Promise.all(index.map((e) => assets.loadJSON(e.file).catch(() => null)));
  for (const c of chapters) for (const s of (c && c.stops) || []) {
    const ch = s.challenge;
    if (ch && ch.type && ch.config) (pool[ch.type] = pool[ch.type] || []).push(ch.config);
  }
  return pool;
}

/**
 * Picks the round's tasks and places them. Stations go to every area except
 * the spawn and the exit; the order and spots change with the seed.
 * Coop tasks become one-plate tasks when only one player is left.
 */
export function roundTasks(map, seed, total, pool, players) {
  const R = rng(seed * 31 + 7);
  const types = new Set(Object.keys(pool));
  let list = CATALOG.map((c, i) => ({ id: i, name: c[0], kind: c[1], type: c[2] }))
    .filter((t) => t.kind !== 'challenge' || types.has(t.type));
  if (players < 2) list = list.filter((t) => t.kind !== 'ativar');
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  // at most 3 coop tasks, and a mix of kinds
  let coop = 0;
  list = list.filter((t) => (t.kind === 'ativar' ? ++coop <= 3 : true)).slice(0, total);
  const rooms = map.rooms.map((_, i) => i).filter((i) => i !== map.spawnRoom && i !== map.exitRoom);
  const used = new Set();
  return list.map((t, n) => {
    const room = rooms[(n + Math.floor(R() * rooms.length)) % rooms.length];
    const spots = map.spots(room).filter((s) => !used.has(`${s.x},${s.y}`));
    const at = spots[Math.floor(R() * spots.length)] || map.spots(room, 1)[0];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) used.add(`${at.x + dx},${at.y + dy}`);
    const task = { n, ...t, room, x: (at.x + 0.5) * 16, y: (at.y + 0.5) * 16 };
    if (t.kind === 'challenge') {
      const configs = pool[t.type];
      task.config = { ...configs[Math.floor(R() * configs.length)], ...(LIGHT[t.type] || {}) };
    }
    if (t.kind === 'colher') {
      task.bits = [0, 1, 2].map(() => { const s = spots[Math.floor(R() * spots.length)] || at; return { x: (s.x + 0.5) * 16, y: (s.y + 0.5) * 16, got: false }; });
    }
    if (t.kind === 'ativar') {
      const far = spots.filter((s) => Math.hypot(s.x - at.x, s.y - at.y) >= 5);
      const b = far[Math.floor(R() * far.length)] || at;
      task.plates = [{ x: task.x, y: task.y }, { x: (b.x + 0.5) * 16, y: (b.y + 0.5) * 16 }];
    }
    return task;
  });
}
