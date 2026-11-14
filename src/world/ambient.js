// Ambient life for painted maps: shimmering water, flickering fire and holy
// light, butterflies, pollen, dust, leaves, smoke, sparkles, clouds and birds.
// Everything is described in the map JSON under genesis.ambient, so new
// maps get effects without code changes.

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// ---------- water shimmer ----------

const WATER_FRAMES = 6;

/** Builds a few half-resolution overlay frames with moving light ripples on water pixels. */
function buildWater(image, opts) {
  if (!image || !image.width) return null;
  const W = Math.floor(image.width / 2);
  const H = Math.floor(image.height / 2);
  const src = document.createElement('canvas');
  src.width = W;
  src.height = H;
  const sctx = src.getContext('2d', { willReadFrequently: true });
  sctx.imageSmoothingEnabled = true;
  sctx.drawImage(image, 0, 0, W, H);
  let px;
  try { px = sctx.getImageData(0, 0, W, H).data; } catch { return null; }

  const regions = (opts.regions || []).map(([x, y, w, h]) => [x / 2, y / 2, (x + w) / 2, (y + h) / 2]);
  const inRegion = (x, y) => !regions.length || regions.some((r) => x >= r[0] && y >= r[1] && x < r[2] && y < r[3]);
  const mask = new Uint8Array(W * H);
  let count = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const r = px[i], g = px[i + 1], b = px[i + 2];
      const blue = b > 110 && b > r + 45 && b >= g - 10;
      const foam = regions.length && r > 200 && g > 215 && b > 225; // waterfalls / fountains
      if ((blue || foam) && inRegion(x, y)) { mask[y * W + x] = 1; count++; }
    }
  }
  if (!count) return null;

  const frames = [];
  for (let f = 0; f < WATER_FRAMES; f++) {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(W, H);
    const d = img.data;
    const phase = (f / WATER_FRAMES) * TAU;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!mask[y * W + x]) continue;
        const v = Math.sin(x * 0.42 + y * 0.16 + phase) + Math.sin(y * 0.55 - x * 0.08 - phase * 2 + Math.sin(x * 0.07) * 2);
        const i = (y * W + x) * 4;
        if (v > 1.3) { d[i] = 235; d[i + 1] = 250; d[i + 2] = 255; d[i + 3] = 150; }
        else if (v > 0.8) { d[i] = 170; d[i + 1] = 225; d[i + 2] = 255; d[i + 3] = 70; }
        else if (v < -1.3) { d[i] = 10; d[i + 1] = 40; d[i + 2] = 90; d[i + 3] = 55; }
      }
    }
    ctx.putImageData(img, 0, 0);
    frames.push(c);
  }
  return { frames, W, H };
}

// ---------- small pixel helpers ----------

function dot(ctx, x, y, size, color, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), size, size);
}

let cloudSprite = null;
function getCloudSprite() {
  if (cloudSprite) return cloudSprite;
  const c = document.createElement('canvas');
  c.width = 48;
  c.height = 20;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  for (const [x, y, r] of [[12, 12, 7], [22, 9, 9], [33, 11, 8], [40, 14, 6], [26, 14, 8]]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  cloudSprite = c;
  return c;
}

const BUTTERFLY_COLORS = ['#ffd84a', '#ff8fd0', '#ffffff', '#8fd8ff', '#ffa94a'];

// ---------- the ambient system ----------

export class Ambient {
  constructor(map) {
    this.map = map;
    this.time = 0;
    const cfg = map.ambient || {};
    this.water = cfg.water ? buildWater(map.background, cfg.water) : null;
    this.glows = (cfg.glows || []).map((g) => ({ strength: 0.5, ...g, seed: Math.random() * 100 }));
    this.systems = (cfg.particles || []).map((p) => this.makeSystem(p));
  }

  makeSystem(p) {
    const W = this.map.pixelW;
    const H = this.map.pixelH;
    const sys = { ...p, items: [], timer: 0 };
    const n = p.count || 0;
    switch (p.type) {
      case 'butterflies':
        for (let i = 0; i < n; i++) sys.items.push({ x: rand(0, W), y: rand(0, H), a: rand(0, TAU), turn: 0, color: pick(BUTTERFLY_COLORS), flap: rand(0, 1) });
        break;
      case 'pollen':
        for (let i = 0; i < n; i++) sys.items.push({ x: rand(0, W), y: rand(0, H), ph: rand(0, TAU), sp: rand(4, 9), gold: Math.random() < 0.6 });
        break;
      case 'dust':
        for (let i = 0; i < n; i++) sys.items.push({ x: rand(0, W), y: rand(0, H), sp: rand(14, 30), ph: rand(0, TAU) });
        break;
      case 'leaves':
        for (let i = 0; i < n; i++) sys.items.push({ x: rand(0, W), y: rand(0, H), sp: rand(18, 34), ph: rand(0, TAU), c: pick(['#8a5a2b', '#a5722f', '#6b4423']) });
        break;
      case 'sparkles':
        for (let i = 0; i < n; i++) sys.items.push({ x: rand(0, W), y: rand(0, H), t: rand(0, 2), life: rand(1.2, 2.4) });
        break;
      case 'clouds':
        for (let i = 0; i < n; i++) sys.items.push({ x: rand(-60, W), y: rand(0, H), sp: rand(4, 9), s: rand(1, 2) });
        break;
      default:
        break;
    }
    return sys;
  }

  update(dt) {
    this.time += dt;
    const W = this.map.pixelW;
    const H = this.map.pixelH;
    for (const sys of this.systems) {
      switch (sys.type) {
        case 'butterflies':
          for (const b of sys.items) {
            b.turn += rand(-3, 3) * dt;
            b.turn *= 0.96;
            b.a += b.turn * dt * 4;
            b.x += Math.cos(b.a) * 16 * dt;
            b.y += Math.sin(b.a) * 12 * dt;
            b.flap += dt * 9;
            if (b.x < 8 || b.x > W - 8 || b.y < 8 || b.y > H - 8) b.a += Math.PI;
          }
          break;
        case 'pollen':
          for (const p of sys.items) {
            p.ph += dt;
            p.x += Math.sin(p.ph * 0.7) * p.sp * dt + 3 * dt;
            p.y += Math.cos(p.ph) * p.sp * 0.5 * dt - 2 * dt;
            if (p.x > W) p.x = 0;
            if (p.y < 0) p.y = H;
          }
          break;
        case 'dust':
        case 'leaves': {
          const gust = 1 + 0.6 * Math.sin(this.time * 0.6);
          for (const p of sys.items) {
            p.ph += dt * 3;
            p.x += p.sp * gust * dt;
            p.y += Math.sin(p.ph) * (sys.type === 'leaves' ? 10 : 4) * dt;
            if (p.x > W + 4) { p.x = -4; p.y = rand(0, H); }
          }
          break;
        }
        case 'sparkles':
          for (const s of sys.items) {
            s.t += dt;
            if (s.t > s.life) { s.t = 0; s.x = rand(0, W); s.y = rand(0, H); }
          }
          break;
        case 'clouds':
          for (const c of sys.items) {
            c.x += c.sp * dt;
            if (c.x > W + 10) { c.x = -100; c.y = rand(0, H); }
          }
          break;
        case 'embers':
        case 'smoke': {
          const rate = sys.type === 'smoke' ? 3 : 6;
          sys.timer += dt;
          while (sys.timer > 1 / rate) {
            sys.timer -= 1 / rate;
            sys.items.push({ x: sys.x + rand(-3, 3), y: sys.y + rand(-2, 2), vx: rand(-4, 4), vy: sys.type === 'smoke' ? rand(-10, -6) : rand(-22, -12), t: 0, life: sys.type === 'smoke' ? rand(2.2, 3.4) : rand(0.7, 1.4) });
          }
          for (const p of sys.items) {
            p.t += dt;
            p.x += (p.vx + Math.sin(this.time * 2 + p.life * 9) * 3) * dt;
            p.y += p.vy * dt;
          }
          sys.items = sys.items.filter((p) => p.t < p.life);
          break;
        }
        case 'birds':
          sys.timer -= dt;
          if (sys.timer <= 0 && !sys.items.length) {
            const fromLeft = Math.random() < 0.5;
            const y = rand(20, H - 40);
            for (let i = 0; i < 3; i++) {
              sys.items.push({ x: fromLeft ? -20 - i * 12 : W + 20 + i * 12, y: y + (i === 1 ? -6 : i * 5), vx: fromLeft ? 42 : -42, ph: rand(0, TAU) });
            }
            sys.timer = sys.every || 10;
          }
          for (const b of sys.items) { b.x += b.vx * dt; b.ph += dt * 10; }
          sys.items = sys.items.filter((b) => b.x > -60 && b.x < W + 60);
          break;
        default:
          break;
      }
    }
  }

  /** Under the characters: water ripples and glows on the ground. */
  drawBelow(ctx, cam) {
    if (this.water) {
      const f = this.water.frames[Math.floor(this.time * 5) % this.water.frames.length];
      const x0 = Math.max(0, Math.floor(cam.x / 2));
      const y0 = Math.max(0, Math.floor(cam.y / 2));
      const w = Math.min(this.water.W - x0, Math.ceil(cam.w / 2) + 2);
      const h = Math.min(this.water.H - y0, Math.ceil(cam.h / 2) + 2);
      if (w > 0 && h > 0) ctx.drawImage(f, x0, y0, w, h, x0 * 2, y0 * 2, w * 2, h * 2);
    }
    if (this.glows.length) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const g of this.glows) {
        let k;
        let color;
        if (g.type === 'fire') {
          k = 0.75 + 0.15 * Math.sin(this.time * 13 + g.seed) + 0.1 * Math.sin(this.time * 23 + g.seed * 2);
          color = '255,150,50';
        } else {
          k = 0.7 + 0.3 * Math.sin(this.time * 1.6 + g.seed);
          color = '255,226,140';
        }
        const r = g.r * (0.9 + 0.1 * k);
        const grad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, r);
        grad.addColorStop(0, `rgba(${color},${(g.strength * k).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${color},0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(g.x - r, g.y - r, r * 2, r * 2);
      }
      ctx.restore();
    }
  }

  /** Over the characters: things in the air. */
  drawAbove(ctx, cam) {
    const inView = (x, y, m = 16) => x > cam.x - m && x < cam.x + cam.w + m && y > cam.y - m && y < cam.y + cam.h + m;
    ctx.save();
    for (const sys of this.systems) {
      switch (sys.type) {
        case 'butterflies':
          for (const b of sys.items) {
            if (!inView(b.x, b.y)) continue;
            const open = Math.sin(b.flap * TAU) > 0;
            dot(ctx, b.x, b.y, 1, '#3a2a1a');
            if (open) { dot(ctx, b.x - 2, b.y - 1, 2, b.color); dot(ctx, b.x + 1, b.y - 1, 2, b.color); }
            else { dot(ctx, b.x - 1, b.y - 2, 1, b.color); dot(ctx, b.x + 1, b.y - 2, 1, b.color); }
          }
          break;
        case 'pollen':
          for (const p of sys.items) {
            if (!inView(p.x, p.y)) continue;
            dot(ctx, p.x, p.y, 1, p.gold ? '#fff0a0' : '#ffffff', 0.45 + 0.45 * Math.sin(p.ph * 3));
          }
          break;
        case 'dust':
          for (const p of sys.items) if (inView(p.x, p.y)) dot(ctx, p.x, p.y, 1, '#f3d79a', 0.55);
          break;
        case 'leaves':
          for (const p of sys.items) {
            if (!inView(p.x, p.y)) continue;
            const flat = Math.sin(p.ph) > 0;
            ctx.globalAlpha = 0.95;
            ctx.fillStyle = p.c;
            ctx.fillRect(Math.round(p.x), Math.round(p.y), flat ? 3 : 1, flat ? 1 : 2);
          }
          break;
        case 'sparkles':
          for (const s of sys.items) {
            if (!inView(s.x, s.y)) continue;
            const a = Math.sin((s.t / s.life) * Math.PI);
            dot(ctx, s.x, s.y, 1, '#fffbe0', a);
            if (a > 0.6) {
              dot(ctx, s.x - 1, s.y, 1, '#ffe27a', a * 0.7);
              dot(ctx, s.x + 1, s.y, 1, '#ffe27a', a * 0.7);
              dot(ctx, s.x, s.y - 1, 1, '#ffe27a', a * 0.7);
              dot(ctx, s.x, s.y + 1, 1, '#ffe27a', a * 0.7);
            }
          }
          break;
        case 'clouds': {
          const spr = getCloudSprite();
          for (const c of sys.items) {
            if (!inView(c.x + 24 * c.s, c.y, 60 * c.s)) continue;
            ctx.globalAlpha = 0.28;
            ctx.drawImage(spr, Math.round(c.x), Math.round(c.y), Math.round(48 * c.s), Math.round(20 * c.s));
          }
          break;
        }
        case 'embers':
          for (const p of sys.items) {
            const k = 1 - p.t / p.life;
            dot(ctx, p.x, p.y, 1, k > 0.5 ? '#ffd27a' : '#ff6a2a', k);
          }
          break;
        case 'smoke':
          for (const p of sys.items) {
            const k = p.t / p.life;
            const size = 2 + Math.floor(k * 3);
            dot(ctx, p.x - size / 2, p.y, size, '#d8d0c8', 0.35 * (1 - k));
          }
          break;
        case 'birds':
          for (const b of sys.items) {
            if (!inView(b.x, b.y)) continue;
            const up = Math.sin(b.ph) > 0;
            const col = sys.color || '#2a2a2a';
            dot(ctx, b.x, b.y, 1, col, 0.9);
            dot(ctx, b.x - 1, b.y + (up ? -1 : 1), 1, col, 0.9);
            dot(ctx, b.x + 1, b.y + (up ? -1 : 1), 1, col, 0.9);
            dot(ctx, b.x - 2, b.y + (up ? -2 : 1), 1, col, 0.9);
            dot(ctx, b.x + 2, b.y + (up ? -2 : 1), 1, col, 0.9);
          }
          break;
        default:
          break;
      }
    }
    ctx.restore();
  }
}
