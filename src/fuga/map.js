// Fuga da Tentação: shared top-down map built from code (same on every phone).
// 80x80 tiles of 16 px, 12 areas joined by 3-tile corridors with loops, so there
// is always another way around. Compatible with world/collision.js (moveBox).
// VISUALS ARE PROVISIONAL (flat colours) until the tileset art arrives.

export const T = { FLOOR: 0, WALL: 1, TREE: 2, BUSH: 3, WATER: 4, PATH: 5, FLOWER: 6, GATE: 7 };
const SOLID = new Set([T.WALL, T.TREE, T.WATER, T.GATE]);

/** Small seeded RNG (mulberry32): same seed → same numbers on every phone. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const JARDIM = {
  id: 'jardim', name: 'Jardim da Resistência', cols: 80, rows: 80, spawnRoom: 8, exitRoom: 11,
  rooms: [
    { name: 'Pomar', x: 5, y: 4, w: 17, h: 13, deco: 'trees' },
    { name: 'Fonte', x: 32, y: 4, w: 16, h: 13, deco: 'fountain' },
    { name: 'Vinha', x: 58, y: 4, w: 17, h: 13, deco: 'rows' },
    { name: 'Oliveiras', x: 5, y: 31, w: 17, h: 14, deco: 'trees' },
    { name: 'Praça Central', x: 32, y: 31, w: 16, h: 14, deco: 'plaza' },
    { name: 'Altar de Pedras', x: 58, y: 31, w: 17, h: 14, deco: 'stones' },
    { name: 'Labirinto de Sebes', x: 5, y: 54, w: 17, h: 16, deco: 'maze' },
    { name: 'Lago', x: 58, y: 54, w: 17, h: 16, deco: 'lake' },
    { name: 'Portão do Éden', x: 32, y: 66, w: 16, h: 11, deco: 'none' },
    { name: 'Torre de Vigia', x: 34, y: 20, w: 12, h: 7, deco: 'none' },
    { name: 'Jardim das Flores', x: 33, y: 49, w: 14, h: 11, deco: 'flowers' },
    { name: 'Portal da Promessa', x: 62, y: 20, w: 12, h: 7, deco: 'none' },
  ],
  // corridors: [roomA, roomB, blockable] (blockable = part of a loop, can be shut for a moment)
  links: [[0, 1, 1], [1, 2, 1], [3, 4, 1], [4, 5, 1], [0, 3, 1], [3, 6, 0], [2, 11, 0], [11, 5, 0], [5, 7, 1],
    [1, 9, 0], [9, 4, 1], [4, 10, 1], [10, 8, 0], [6, 8, 1], [7, 8, 1], [6, 10, 1], [10, 7, 1]],
};

export class FugaMap {
  constructor(def = JARDIM) {
    Object.assign(this, { id: def.id, name: def.name, cols: def.cols, rows: def.rows, rooms: def.rooms });
    this.tileW = 16; this.tileH = 16;
    this.pixelW = this.cols * 16; this.pixelH = this.rows * 16;
    this.walk = null; this.waterMask = null; this.roadMask = null; this.extraSolids = null; this.bridges = [];
    this.tiles = new Uint8Array(this.cols * this.rows).fill(T.WALL);
    this.blocked = new Uint8Array(this.cols * this.rows); // temporary blockades (director)
    this.blockers = []; // corridor segments that may be shut: [{cells:[i...], a, b}]
    const R = rng(7919); // fixed layout seed: every phone builds the same garden
    def.rooms.forEach((r) => this.fill(r.x, r.y, r.w, r.h, T.FLOOR));
    def.links.forEach(([a, b, can]) => this.corridor(def.rooms[a], def.rooms[b], can, a, b));
    def.rooms.forEach((r, i) => this.decorate(r, R, i === def.spawnRoom || i === def.exitRoom));
    // buildings are solid (tower, gate, altar, fountain rim): nobody walks through them
    this.solid = new Uint8Array(this.cols * this.rows);
    const base = { 'Torre de Vigia': [38, 23, 4, 2], 'Portão do Éden': [37, 74, 6, 2], 'Altar de Pedras': [65, 37, 3, 2], Fonte: [38, 9, 4, 3] };
    def.rooms.forEach((r) => { const f = base[r.name]; if (f) for (let y = f[1]; y < f[1] + f[3]; y++) for (let x = f[0]; x < f[0] + f[2]; x++) this.solid[this.idx(x, y)] = 1; });
    this.spawnRoom = def.spawnRoom;
    this.exitRoom = def.exitRoom;
    const ex = def.rooms[def.exitRoom];
    // gate on the east wall of the portal room; past it, the way out (escape zone)
    this.exit = { x: ex.x + ex.w, y: ex.y + (ex.h >> 1) };
    for (let dy = -1; dy <= 1; dy++) {
      this.set(this.exit.x, this.exit.y + dy, T.GATE);
      for (let x = this.exit.x + 1; x < this.cols - 1; x++) this.set(x, this.exit.y + dy, T.PATH);
    }
    this.exitOpen = false;
  }

  idx(x, y) { return y * this.cols + x; }
  get(x, y) { return x < 0 || y < 0 || x >= this.cols || y >= this.rows ? T.WALL : this.tiles[this.idx(x, y)]; }
  set(x, y, t) { if (x >= 0 && y >= 0 && x < this.cols && y < this.rows) this.tiles[this.idx(x, y)] = t; }
  fill(x, y, w, h, t) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, t); }

  corridor(A, B, can, a, b) {
    const ax = A.x + (A.w >> 1), ay = A.y + (A.h >> 1), bx = B.x + (B.w >> 1), by = B.y + (B.h >> 1);
    const cells = [];
    const dig = (x, y) => { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const t = this.get(x + i, y + j); if (t === T.WALL) { this.set(x + i, y + j, T.PATH); cells.push(this.idx(x + i, y + j)); } } };
    // L-shaped: horizontal first, then vertical
    for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) dig(x, ay);
    for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) dig(bx, y);
    if (can && cells.length > 6) {
      const mid = cells.slice(Math.floor(cells.length / 2) - 3, Math.floor(cells.length / 2) + 6);
      this.blockers.push({ cells: mid, a, b });
    }
  }

  decorate(r, R, keepClear) {
    const free = (x, y) => this.get(x, y) === T.FLOOR;
    const inner = (fn) => { for (let y = r.y + 2; y < r.y + r.h - 2; y++) for (let x = r.x + 2; x < r.x + r.w - 2; x++) fn(x, y); };
    if (keepClear) return;
    if (r.deco === 'trees') inner((x, y) => { if ((x + y * 3) % 7 === 0 && R() < 0.55) this.set(x, y, T.TREE); });
    if (r.deco === 'rows') inner((x, y) => { if (y % 3 === 0 && x % 6 !== 0) this.set(x, y, T.TREE); });
    if (r.deco === 'stones') inner((x, y) => { if (R() < 0.06) this.set(x, y, T.TREE); });
    if (r.deco === 'fountain') this.fill(r.x + (r.w >> 1) - 1, r.y + (r.h >> 1) - 1, 3, 3, T.WATER);
    if (r.deco === 'lake') this.fill(r.x + 4, r.y + 4, r.w - 8, r.h - 8, T.WATER);
    if (r.deco === 'plaza') { inner((x, y) => { if (free(x, y) && (x + y) % 2 === 0) this.set(x, y, T.PATH); }); }
    if (r.deco === 'flowers') inner((x, y) => { if (R() < 0.25) this.set(x, y, T.FLOWER); });
    if (r.deco === 'maze') { // hedges with gaps: several ways through
      for (let y = r.y + 3; y < r.y + r.h - 2; y += 4) for (let x = r.x + 1; x < r.x + r.w - 1; x++) if ((x + y) % 9 > 2) this.set(x, y, T.TREE);
    }
    // 2x2 bushes to hide in (not solid): every room except the lake has two
    for (let n = 0; n < 2; n++) {
      for (let tries = 0; tries < 30; tries++) {
        const x = r.x + 1 + Math.floor(R() * (r.w - 3)), y = r.y + 1 + Math.floor(R() * (r.h - 3));
        if ([0, 1].every((j) => [0, 1].every((i) => free(x + i, y + j) || this.get(x + i, y + j) === T.FLOWER))) { this.fill(x, y, 2, 2, T.BUSH); break; }
      }
    }
  }

  // ---- collision API used by world/collision.js and by the enemies ----
  isSolidTile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return true;
    const i = this.idx(tx, ty);
    if (this.blocked[i] || this.solid[i]) return true;
    const t = this.tiles[i];
    if (t === T.GATE) return !this.exitOpen;
    return SOLID.has(t);
  }
  isRoadRect() { return false; }
  isBushAt(px, py) { return this.get(Math.floor(px / 16), Math.floor(py / 16)) === T.BUSH; }
  roomAt(px, py) {
    const x = px / 16, y = py / 16;
    return this.rooms.findIndex((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  }
  inExit(px, py) { return px / 16 >= this.exit.x + 1.5 && Math.abs(py / 16 - (this.exit.y + 0.5)) < 2; }
  center(i) { const r = this.rooms[i]; return { x: (r.x + r.w / 2) * 16, y: (r.y + r.h / 2) * 16 }; }

  /** Free floor tiles of a room, away from walls (for stations, fragments, spawns). */
  spots(i, margin = 2) {
    const r = this.rooms[i], out = [];
    for (let y = r.y + margin; y < r.y + r.h - margin; y++) for (let x = r.x + margin; x < r.x + r.w - margin; x++) {
      const t = this.get(x, y);
      if ((t === T.FLOOR || t === T.PATH || t === T.FLOWER) && !this.isSolidTile(x, y) && !this.isSolidTile(x, y + 1) && !this.isSolidTile(x, y - 1)) out.push({ x, y });
    }
    return out;
  }

  /** Line of sight between two pixel points (walls and trees block it). */
  sees(ax, ay, bx, by) {
    const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 8);
    for (let s = 1; s < steps; s++) {
      const x = ax + ((bx - ax) * s) / steps, y = ay + ((by - ay) * s) / steps;
      const t = this.get(Math.floor(x / 16), Math.floor(y / 16));
      const k = this.idx(Math.floor(x / 16), Math.floor(y / 16));
      if (t === T.WALL || t === T.TREE || this.blocked[k] || this.solid[k]) return false;
    }
    return true;
  }

  /** Breadth-first distance field to a tile: enemies walk downhill on it. */
  field(tx, ty) {
    const d = new Int16Array(this.cols * this.rows).fill(-1);
    const q = new Int32Array(this.cols * this.rows);
    let h = 0, t = 0;
    if (this.isSolidTile(tx, ty)) return d;
    d[this.idx(tx, ty)] = 0; q[t++] = this.idx(tx, ty);
    while (h < t) {
      const c = q[h++], x = c % this.cols, y = (c / this.cols) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (this.isSolidTile(nx, ny)) continue;
        const n = this.idx(nx, ny);
        if (d[n] >= 0) continue;
        d[n] = d[c] + 1; q[t++] = n;
      }
    }
    return d;
  }

  /** Tiles drawn once to a canvas (1280x1280). PROVISIONAL colours. */
  bake() {
    const c = document.createElement('canvas');
    c.width = this.pixelW; c.height = this.pixelH;
    const g = c.getContext('2d');
    const R = rng(99);
    const col = { [T.FLOOR]: '#3f7a3a', [T.WALL]: '#1d3320', [T.TREE]: '#2b5a2c', [T.BUSH]: '#3a8f3f', [T.WATER]: '#2e6fb0', [T.PATH]: '#a68a5b', [T.FLOWER]: '#3f7a3a', [T.GATE]: '#c9a227' };
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
      const t = this.get(x, y);
      g.fillStyle = col[t]; g.fillRect(x * 16, y * 16, 16, 16);
      if (t === T.FLOOR || t === T.FLOWER) { g.fillStyle = 'rgba(255,255,255,.06)'; if (R() < 0.5) g.fillRect(x * 16 + ((R() * 14) | 0), y * 16 + ((R() * 14) | 0), 2, 2); }
      if (t === T.FLOWER) { g.fillStyle = ['#f5d142', '#f07aa8', '#fff'][(R() * 3) | 0]; g.fillRect(x * 16 + 5, y * 16 + 6, 3, 3); g.fillRect(x * 16 + 10, y * 16 + 10, 2, 2); }
      if (t === T.TREE) { g.fillStyle = '#5a3a1e'; g.fillRect(x * 16 + 6, y * 16 + 10, 4, 6); g.fillStyle = '#1f4d22'; g.beginPath(); g.arc(x * 16 + 8, y * 16 + 7, 7, 0, 7); g.fill(); }
      if (t === T.BUSH) { g.fillStyle = '#2f7a34'; g.beginPath(); g.arc(x * 16 + 8, y * 16 + 8, 8, 0, 7); g.fill(); }
      if (t === T.WALL && this.get(x, y + 1) !== T.WALL) { g.fillStyle = '#14251a'; g.fillRect(x * 16, y * 16 + 12, 16, 4); }
      if (t === T.WATER) { g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(x * 16 + 3, y * 16 + 5, 6, 1); }
    }
    return c;
  }
}

export const MAPS = { jardim: JARDIM };
