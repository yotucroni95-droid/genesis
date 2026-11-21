// Threat Director: game-controlled enemies (never players). Runs only on the
// host phone (lowest connected seat); the others draw the snapshots it sends.
// Deterministic state machine + BFS distance fields, no AI service.
// States: patrol → investigate (noise) → chase (sees someone) → search (lost
// the target) → patrol; cooldown after a capture. Chases are capped so an
// enemy never just follows players forever.

import { rng } from './map.js';

export const KINDS = {
  serpente: { name: 'Serpente', patrol: 44, chase: 67, sight: 150, lose: 4, chaseMax: 10, feel: 90, smell: 260 },
  anjo: { name: 'Anjo caído', patrol: 48, chase: 70, sight: 160, lose: 4, chaseMax: 11, feel: 90, smell: 260 },
  lucifer: { name: 'Lúcifer', patrol: 52, chase: 74, sight: 180, lose: 4.4, chaseMax: 12, feel: 100, smell: 300 },
};
export const STAGES = ['Calmaria', 'Primeiros sinais', 'Perseguição', 'Grande provação', 'Confronto final'];
const DIFF = [{ speed: 0.85, sight: 0.85 }, { speed: 1, sight: 1 }, { speed: 1.1, sight: 1.15 }];

/** Stage 1–5 from time, tasks and survivors (same formula on every phone). */
export function stageOf({ t, limit, done, total, alive, players }) {
  if (total && done >= total) return 5;
  const p = Math.max(t / limit, (done / Math.max(1, total)) * 0.95) - 0.12 * (1 - alive / Math.max(1, players));
  return p < 0.12 ? 1 : p < 0.35 ? 2 : p < 0.6 ? 3 : 4;
}

export class Director {
  constructor(map, seed, { difficulty = 1, kind = 'serpente' } = {}) {
    this.map = map;
    this.R = rng(seed * 13 + 1);
    this.kind = kind;
    this.diff = DIFF[difficulty] || DIFF[1];
    this.enemies = [];
    this.warnings = []; // {x, y, t}: where something is about to appear
    this.block = null; // {i, t, warn}: corridor shut for a moment
    this.fog = 0; // seconds left of the "temptation" fog
    this.fields = new Map();
    this.nextId = 1;
    this.eventT = 30;
    this.time = 0;
  }

  fieldTo(x, y) {
    const tx = Math.floor(x / 16), ty = Math.floor(y / 16), key = ty * this.map.cols + tx;
    let f = this.fields.get(key);
    if (!f) {
      f = this.map.field(tx, ty);
      this.fields.set(key, f);
      if (this.fields.size > 12) this.fields.delete(this.fields.keys().next().value);
    }
    return f;
  }

  /** One step along the distance field toward (gx, gy). Returns true when there. */
  walk(e, gx, gy, speed, dt) {
    if (Math.hypot(gx - e.x, gy - e.y) < 6) return true;
    const f = this.fieldTo(gx, gy), m = this.map;
    const tx = Math.floor(e.x / 16), ty = Math.floor(e.y / 16);
    let best = f[m.idx(tx, ty)], nx = tx, ny = ty;
    if (best < 0) { e.x = gx; e.y = gy; return true; } // unreachable (shouldn't happen): don't get stuck
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const d = f[m.idx(tx + dx, ty + dy)];
      if (!m.isSolidTile(tx + dx, ty + dy) && d >= 0 && d < best) { best = d; nx = tx + dx; ny = ty + dy; }
    }
    const cx = best === 0 ? gx : (nx + 0.5) * 16, cy = best === 0 ? gy : (ny + 0.5) * 16;
    const dist = Math.hypot(cx - e.x, cy - e.y) || 1;
    const step = Math.min(dist, speed * dt);
    e.dir = Math.abs(cx - e.x) > Math.abs(cy - e.y) ? (cx < e.x ? 1 : 2) : (cy < e.y ? 3 : 0);
    e.x += ((cx - e.x) / dist) * step;
    e.y += ((cy - e.y) / dist) * step;
    return false;
  }

  pickRoom(avoid = []) {
    const rooms = this.map.rooms.map((_, i) => i).filter((i) => i !== this.map.spawnRoom);
    for (let k = 0; k < 10; k++) {
      const r = rooms[Math.floor(this.R() * rooms.length)];
      const c = this.map.center(r);
      if (avoid.every((p) => Math.hypot(p.x - c.x, p.y - c.y) > 200)) return { r, ...this.freeNear(c) };
    }
    return { r: rooms[0], ...this.freeNear(this.map.center(rooms[0])) };
  }
  freeNear(c) {
    const ri = this.map.roomAt(c.x, c.y);
    if (ri < 0) return { x: c.x, y: c.y }; // in a corridor: the spot itself is walkable
    const s = this.map.spots(ri, 1);
    const p = s.sort((a, b) => Math.hypot(a.x * 16 - c.x, a.y * 16 - c.y) - Math.hypot(b.x * 16 - c.x, b.y * 16 - c.y))[0];
    return p ? { x: (p.x + 0.5) * 16, y: (p.y + 0.5) * 16 } : c;
  }

  /** Signalled appearance: a warning first, the enemy 1.6 s later, far from everyone. */
  spawn(players) {
    const at = this.pickRoom(players.filter((p) => p.alive));
    this.warnings.push({ x: at.x, y: at.y, t: 1.6 });
  }

  /** noises: [{x, y}] (a task just finished, a plate pressed). Returns [{type:'caught', seat}]. */
  update(dt, { players, stage, noises = [] }) {
    this.time += dt;
    const out = [];
    const K = KINDS[this.kind];
    const want = [0, 1, 1, 2, 2, 3][stage] - (this.time < 18 ? 1 : 0); // a calm start
    const pending = this.warnings.length;
    if (this.enemies.length + pending < want) this.spawn(players);
    for (const w of this.warnings) {
      w.t -= dt;
      if (w.t <= 0) this.enemies.push({ id: this.nextId++, kind: this.kind, x: w.x, y: w.y, dir: 0, state: 'patrol', goal: null, t: 0, chaseT: 0, seat: -1 });
    }
    this.warnings = this.warnings.filter((w) => w.t > 0);

    const speedK = this.diff.speed * (1 + (stage - 1) * 0.04);
    const sight = K.sight * this.diff.sight * (stage >= 4 ? 1.15 : 1);
    const live = players.filter((p) => p.alive && !p.escaped);
    // who is moving: the snake feels footsteps nearby, even around corners
    this.prev = this.prev || new Map();
    for (const p of live) { const q = this.prev.get(p.seat); p.moving = Boolean(q && Math.hypot(q.x - p.x, q.y - p.y) > 0.4); this.prev.set(p.seat, { x: p.x, y: p.y }); }
    for (const e of this.enemies) {
      e.t += dt;
      // who can this enemy see? (hidden in a bush = invisible unless very close)
      const seen = live.filter((p) => {
        if (p.protected || p.busy) return false;
        const d = Math.hypot(p.x - e.x, p.y - e.y);
        if (p.hidden) return d < 22;
        if (p.moving && d < (K.feel || 0) * this.diff.sight) return true; // feels the steps
        return d < sight * (p.moving ? 1 : 0.8) && this.map.sees(e.x, e.y - 6, p.x, p.y - 8);
      })
        .sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y));
      if (e.state === 'cooldown') {
        if (!e.goal) e.goal = this.pickRoom(live);
        if (this.walk(e, e.goal.x, e.goal.y, K.patrol * speedK, dt) || e.t > 7) { e.state = 'patrol'; e.goal = null; e.t = 0; }
        continue;
      }
      if (e.state === 'tired') { if (e.t > 2.5) { e.state = 'patrol'; e.t = 0; } continue; }
      if (seen.length && e.state !== 'chase') { e.state = 'chase'; e.seat = seen[0].seat; e.chaseT = 0; e.lost = 0; }
      if (e.state === 'chase') {
        const p = live.find((q) => q.seat === e.seat);
        const sees = p && seen.includes(p);
        e.chaseT += dt;
        if (sees) { e.last = { x: p.x, y: p.y }; e.lost = 0; } else e.lost += dt;
        if (!p || e.lost > K.lose) { e.state = 'search'; e.goal = e.last || { x: e.x, y: e.y }; e.t = 0; }
        else if (e.chaseT > K.chaseMax + stage) { e.state = 'tired'; e.t = 0; } // gives the player a break
        else this.walk(e, e.last.x, e.last.y, K.chase * speedK, dt);
        if (p && sees && Math.hypot(p.x - e.x, p.y - e.y) < 11) {
          out.push({ type: 'caught', seat: p.seat });
          e.state = 'cooldown'; e.goal = null; e.t = 0;
        }
        continue;
      }
      if (e.state === 'search') {
        if (this.walk(e, e.goal.x, e.goal.y, K.patrol * speedK * 1.15, dt) && e.t > 3.5) { e.state = 'patrol'; e.goal = null; }
        continue;
      }
      // patrol / investigate: noises from stage 2 on pull the nearest enemy
      const noise = noises.length ? noises[0] : null;
      if (noise && e.state !== 'investigate' && this.enemies.indexOf(e) === 0) { e.state = 'investigate'; e.goal = { x: noise.x, y: noise.y }; e.t = 0; }
      // instinct: on patrol it smells the nearest player who is out of a bush and heads that way
      const prey = live.filter((p) => !p.protected && !p.busy && !p.hidden && Math.hypot(p.x - e.x, p.y - e.y) < (K.smell || 0))
        .sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y))[0];
      e.sniffT = (e.sniffT || 0) + dt;
      if (prey && e.state !== 'investigate' && e.sniffT > 1.5) { e.sniffT = 0; e.goal = { r: -1, ...this.freeNear({ x: prey.x, y: prey.y }) }; }
      if (!e.goal) e.goal = this.pickRoom([]);
      if (this.walk(e, e.goal.x, e.goal.y, K.patrol * speedK * (e.state === 'investigate' ? 1.25 : 1), dt)) {
        if (e.state === 'investigate') { e.state = 'search'; e.t = 0; } else e.goal = null;
      }
    }

    // temporary blockade (stage ≥ 4): warned 2 s before; never shuts on a player
    this.eventT -= dt;
    if (this.block) {
      this.block.t -= dt;
      if (this.block.warn > 0) {
        this.block.warn -= dt;
        if (this.block.warn <= 0) {
          const cells = this.map.blockers[this.block.i].cells;
          const onIt = live.some((p) => cells.includes(this.map.idx(Math.floor(p.x / 16), Math.floor((p.y - 4) / 16))));
          if (onIt) this.block = null; else this.setBlock(this.block.i, true);
        }
      } else if (this.block.t <= 0) { this.setBlock(this.block.i, false); this.block = null; }
    }
    if (this.fog > 0) this.fog -= dt;
    if (stage >= 4 && this.eventT <= 0) {
      this.eventT = 22 + this.R() * 12;
      if (this.R() < 0.55 && !this.block && this.map.blockers.length) this.block = { i: Math.floor(this.R() * this.map.blockers.length), warn: 2, t: 10 };
      else this.fog = 8;
    }
    return out;
  }

  setBlock(i, on) {
    for (const c of this.map.blockers[i].cells) this.map.blocked[c] = on ? 1 : 0;
    this.fields.clear();
  }

  /** Compact state for the network (≈ 10 times per second). */
  snapshot() {
    return {
      e: this.enemies.map((e) => [e.id, e.kind, Math.round(e.x), Math.round(e.y), e.dir, e.state === 'chase' ? 1 : 0]),
      w: this.warnings.map((w) => [Math.round(w.x), Math.round(w.y)]),
      b: this.block ? [this.block.i, this.block.warn > 0 ? 1 : 0] : null,
      f: this.fog > 0 ? 1 : 0,
    };
  }

  /** Non-host phones: take the host's picture (keeps local copies for a host hand-over). */
  apply(s) {
    const prev = new Map(this.enemies.map((e) => [e.id, e]));
    this.enemies = s.e.map(([id, kind, x, y, dir, ch]) => {
      const e = prev.get(id) || { id, kind, x, y, state: 'patrol', t: 0, chaseT: 0, seat: -1 };
      Object.assign(e, { kind, tx: x, ty: y, dir, state: ch ? 'chase' : e.state === 'chase' ? 'patrol' : e.state });
      if (!prev.has(id)) { e.x = x; e.y = y; }
      return e;
    });
    this.nextId = Math.max(this.nextId, ...this.enemies.map((e) => e.id + 1));
    this.warnings = s.w.map(([x, y]) => ({ x, y, t: 1 }));
    const want = s.b ? s.b[0] : -1;
    if (this.block && this.block.i !== want) { this.setBlock(this.block.i, false); this.block = null; }
    if (s.b) { if (!s.b[1] && !(this.block && this.block.on)) this.setBlock(s.b[0], true); this.block = { i: s.b[0], warn: s.b[1] ? 1 : 0, t: 10, on: !s.b[1] }; }
    this.fog = s.f ? 1 : 0;
  }

  /** Smooths remote enemies toward the last snapshot. */
  interpolate(dt) {
    for (const e of this.enemies) if (e.tx != null) { const k = Math.min(1, dt * 10); e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; }
  }
}
