// Five hidden scrolls per map. Their places are drawn at random every day
// (among spots the player can actually reach), so nobody can memorise them.
// Each scroll gives a random prize; finding all 5 gives a box.

import { boxHitsMap } from './collision.js';
import { sfx } from '../audio/audio.js';
import { toast } from '../ui/toast.js';
import { addCoins, addBox, rollUpgrade } from '../game/economy.js';

const COUNT = 5;

function seeded(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export class Scrolls {
  constructor(map, chapter, player, stops, save, extras, onAll) {
    this.save = save;
    this.chapterId = chapter.id;
    this.extras = extras;
    this.onAll = onAll;
    this.time = 0;
    this.today = new Date().toLocaleDateString('sv-SE');
    if (!save.state.scrolls || save.state.scrolls.date !== this.today) save.update((s) => { s.scrolls = { date: this.today, found: {} }; });
    this.items = this.place(map, player, stops);
  }

  get found() { return this.save.state.scrolls.found[this.chapterId] || []; }

  place(map, player, stops) {
    // every spot reachable on foot from where the player starts
    const S = 8;
    const W = Math.floor(map.pixelW / S);
    const H = Math.floor(map.pixelH / S);
    const free = (x, y) => !boxHitsMap(map, x * S - 7, y * S - 8, 14, 8);
    const seen = new Uint8Array(W * H);
    const sx = Math.round(player.x / S);
    const sy = Math.round(player.y / S);
    const queue = [[sx, sy]];
    const spots = [];
    seen[sy * W + sx] = 1;
    while (queue.length) {
      const [x, y] = queue.pop();
      spots.push([x * S, y * S]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 2 || ny < 2 || nx >= W - 1 || ny >= H - 1 || seen[ny * W + nx]) continue;
        seen[ny * W + nx] = 1;
        if (free(nx, ny)) queue.push([nx, ny]);
      }
    }
    const rnd = seeded(`${this.today}|${this.chapterId}`);
    const avoid = [[player.x, player.y, 110], ...stops.stops.map((s) => [s.px, s.py, 60]), ...stops.npcs.map((n) => [n.px, n.py, 40])];
    const chosen = [];
    for (let tries = 0; tries < 4000 && chosen.length < COUNT; tries++) {
      const [x, y] = spots[Math.floor(rnd() * spots.length)];
      if (avoid.some(([ax, ay, r]) => Math.hypot(ax - x, ay - y) < r)) continue;
      if (chosen.some((c) => Math.hypot(c.x - x, c.y - y) < 140)) continue;
      chosen.push({ x, y, phase: rnd() * 6 });
    }
    return chosen.map((c, i) => ({ ...c, i }));
  }

  update(dt, player) {
    this.time += dt;
    for (const s of this.items) {
      if (this.found.includes(s.i)) continue;
      if (Math.hypot(s.x - player.x, s.y - player.y) < 16) this.collect(s);
    }
  }

  collect(s) {
    this.save.update((st) => { st.scrolls.found[this.chapterId] = [...(st.scrolls.found[this.chapterId] || []), s.i]; });
    sfx('scroll');
    const n = this.found.length;
    const r = Math.random();
    let prize;
    if (r < 0.1 && this.extras) {
      const pool = this.extras.verses.filter((v) => v.rarity === 'comum' || v.rarity === 'raro');
      const card = pool[Math.floor(Math.random() * pool.length)];
      this.save.update((st) => { st.verses[card.id] = (st.verses[card.id] || 0) + 1; });
      prize = `carta "${card.ref}"`;
    } else {
      const coins = r < 0.35 ? 20 + Math.floor(Math.random() * 21) : 5 + Math.floor(Math.random() * 11);
      addCoins(this.save, coins);
      prize = `+${coins} talentos`;
    }
    toast(`📜 Pergaminho ${n}/${COUNT} encontrado! ${prize}`, { ms: 2600 });
    if (n === COUNT) {
      const rarity = rollUpgrade(this.save, 'raro');
      addBox(this.save, rarity, 'pergaminhos');
      this.onAll && this.onAll(rarity);
    }
  }

  draw(ctx) {
    for (const s of this.items) {
      if (this.found.includes(s.i)) continue;
      const x = Math.round(s.x);
      const y = Math.round(s.y - 6 + Math.sin(this.time * 2 + s.phase) * 1.5);
      // little parchment roll
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.fillRect(x - 5, Math.round(s.y) - 1, 10, 2);
      ctx.fillStyle = '#e9d3a0';
      ctx.fillRect(x - 5, y - 3, 10, 6);
      ctx.fillStyle = '#b58a4c';
      ctx.fillRect(x - 6, y - 4, 2, 8);
      ctx.fillRect(x + 4, y - 4, 2, 8);
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(x - 1, y - 3, 2, 6);
      // a glint now and then, so a sharp eye can spot it
      const g = (this.time * 0.6 + s.phase) % 3;
      if (g < 0.35) {
        const a = Math.sin((g / 0.35) * Math.PI);
        ctx.globalAlpha = a;
        ctx.fillStyle = '#fffbe0';
        ctx.fillRect(x + 3, y - 9, 1, 5);
        ctx.fillRect(x + 1, y - 7, 5, 1);
        ctx.globalAlpha = 1;
      }
    }
  }
}
