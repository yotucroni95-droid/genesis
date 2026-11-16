// Glowing story stops on the map and the decorative characters (NPCs).

const NEAR = 30; // pixels: how close the player must be to enter

export class Stops {
  constructor(chapter, map, assets, save, { hero = false, visible = () => true } = {}) {
    this.hero = hero;
    this.visible = visible; // events: only the next stop of the trail is shown // Modo Herói: red lights until beaten as a hero
    this.assets = assets;
    this.save = save;
    this.marker = assets.entry('ui.stop_marker');
    this.time = 0;
    this.stops = chapter.stops.map((s) => ({
      ...s,
      px: (s.x + 0.5) * map.tileW,
      py: (s.y + 0.5) * map.tileH,
    }));
    this.npcs = (chapter.npcs || []).map((n) => {
      const sheet = assets.entry(`sheet.${n.sheet}`);
      return { ...n, sheetId: n.sheet, sheet, px: (n.x + 0.5) * map.tileW, py: (n.y + 1) * map.tileH - 4, seed: Math.random() * 10 };
    });
    // NPCs are solid: the block covers the feet and lower body, so the player
    // can never walk over a character, only stand in front of or behind it.
    map.extraSolids = this.npcs.map((n) => {
      const f = (n.sheet && n.sheet.frame) || 32;
      const w = Math.round(f * 0.55);
      const h = Math.round(f * 0.55);
      return { x: n.px - w / 2, y: n.py - h, w, h };
    });
  }

  update(dt) { this.time += dt; }

  /** The stop the player is standing at, if any. */
  nearest(px, py) {
    let best = null;
    let bestD = NEAR;
    for (const s of this.stops) {
      if (!this.visible(s.id)) continue;
      const d = Math.hypot(s.px - px, s.py - py);
      if (d < bestD) { best = s; bestD = d; }
    }
    return best;
  }

  /** Things drawn on the ground (under characters). */
  drawGround(ctx) {
    for (const s of this.stops) {
      if (!this.visible(s.id)) continue;
      const key = this.hero ? `${s.id}#heroi` : s.id;
      const done = this.hero ? Boolean((this.save.state.stars || {})[key]) : this.save.isStopDone(s.id);
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 3 + s.x);
      // light pillar
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const r = done ? 14 : 20 + pulse * 6;
      const g = ctx.createRadialGradient(s.px, s.py, 0, s.px, s.py, r);
      const col = done ? '124,240,166' : this.hero ? '255,90,70' : '255,214,110';
      g.addColorStop(0, `rgba(${col},${done ? 0.35 : 0.75})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(s.px - r, s.py - r, r * 2, r * 2);
      if (!done) {
        ctx.fillStyle = `rgba(255,236,170,${0.25 + pulse * 0.25})`;
        ctx.fillRect(Math.round(s.px - 2), Math.round(s.py - 34 - pulse * 4), 4, 30);
      }
      ctx.restore();
      const st = done ? ((this.save.state.stars || {})[key] || 0) : 0;
      for (let k = 0; k < 3; k++) {
        if (!done) break;
        ctx.fillStyle = k < st ? '#ffd36e' : 'rgba(255,255,255,.25)';
        const sx = Math.round(s.px - 10 + k * 8);
        const sy = Math.round(s.py - 26);
        ctx.fillRect(sx + 1, sy, 2, 5); ctx.fillRect(sx, sy + 1, 4, 3);
      }
      if (this.marker && this.marker.image) {
        const size = 24;
        ctx.globalAlpha = done ? 0.5 : 0.9;
        ctx.drawImage(this.marker.image, Math.round(s.px - size / 2), Math.round(s.py - size / 2), size, size);
        ctx.globalAlpha = 1;
      }
    }
  }

  /** NPCs to be sorted together with the player by y. */
  drawables() {
    return this.npcs.map((n) => ({
      y: n.py,
      draw: (ctx) => {
        const sh = n.sheet;
        if (!sh || !sh.image) return;
        const f = sh.frame || 32;
        const cols = sh.cols || 3;
        const idle = (sh.anim && sh.anim.idle) || [0];
        let col = n.variant != null ? n.variant % cols : idle[Math.floor((this.time + n.seed) * 2) % idle.length];
        const row = Math.min(n.dir || 0, (sh.rows || 1) - 1);
        const bob = Math.round(Math.sin(this.time * 2 + n.seed) * 1);
        ctx.fillStyle = 'rgba(0,0,0,.22)';
        ctx.fillRect(Math.round(n.px - f * 0.2), Math.round(n.py - 2), Math.round(f * 0.4), 3);
        ctx.drawImage(sh.image, col * f, row * f, f, f, Math.round(n.px - f / 2), Math.round(n.py - f + 1 + bob), f, f);
      },
    }));
  }
}
