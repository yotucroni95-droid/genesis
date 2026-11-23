// Art of the Fuga garden (lote M1–M15). The ground is painted once into a
// canvas; tall things (trees, tower, gate) become props drawn by depth with
// the players. Without the art, map.bake() keeps the provisional colours.
import { T, rng } from './map.js';

export const FUGA_ART = ['fuga.tiles', 'fuga.macieira', 'fuga.oliveira', 'fuga.parreira', 'fuga.praca', 'fuga.altar', 'fuga.lago',
  'fuga.portao', 'fuga.torre', 'fuga.canteiros', 'fuga.portal', 'fuga.moita', 'fuga.espinhos', 'fuga.placa', 'fuga.fonte',
  'fuga.serpente', 'fuga.serpente_fx', 'fuga.objetos', 'fuga.fx', 'fuga.minimapa'];

const ok = (assets, id) => { const e = assets.entry(id); return e && e.image && !e.placeholder; };

/** {ground, props} or null when the tileset has not arrived. */
export function paintMap(map, assets) {
  if (!ok(assets, 'fuga.tiles')) return null;
  const img = (id) => (ok(assets, id) ? assets.image(id) : null);
  const tiles = img('fuga.tiles');
  const c = document.createElement('canvas');
  c.width = map.pixelW; c.height = map.pixelH;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const R = rng(7);
  const pick = (list) => list[(R() * list.length) | 0];
  const tile = (col, row, x, y) => g.drawImage(tiles, col * 16, row * 16, 16, 16, x * 16, y * 16, 16, 16);
  const plazaRoom = map.rooms.findIndex((r) => r.deco === 'plaza');
  const fountRoom = map.rooms.findIndex((r) => r.deco === 'fountain');
  const fr = map.rooms[fountRoom], fcx = (fr.x + fr.w / 2) * 16, fcy = (fr.y + fr.h / 2) * 16;
  const props = [];
  const lakeFish = [];
  const roomOf = (x, y) => map.rooms.findIndex((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  // ---- painted ground (pixel by pixel): grass patches, dirt paths with ragged
  // edges, paved square, forest floor; boundaries are slightly warped so
  // nothing looks cut with a ruler (collision still uses the tiles).
  const W = map.pixelW, H = map.pixelH;
  const hash = (x, y) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const noise = (x, y) => { // smooth value noise 0..1
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c2 = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c2 - a) * v + (a - b - c2 + d) * u * v;
  };
  const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  const PAL = {
    grass: ['#3f7d2b', '#4c8f31', '#5aa037', '#69b03f', '#7cc04a'].map(hex),
    dirt: ['#8a5a32', '#9c6a3b', '#ad7b46', '#bd8c53', '#cba066'].map(hex),
    pave: ['#9d8862', '#b19c74', '#c2ad83', '#d2bf96'].map(hex),
    forest: ['#0f2413', '#132c17', '#17341b'].map(hex),
    shore: ['#b9a26a', '#c9b27a', '#d8c28c', '#e3d09c'].map(hex),
  };
  const MAT = { GRASS: 0, DIRT: 1, PAVE: 2, FOREST: 3, WATER: 4, SHORE: 5 };
  const nearWater = (tx, ty) => [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([a, b]) => map.get(tx + a, ty + b) === T.WATER);
  const matAt = (px, py) => {
    const tx = Math.max(0, Math.min(map.cols - 1, px >> 4)), ty = Math.max(0, Math.min(map.rows - 1, py >> 4));
    const t = map.get(tx, ty);
    if (t === T.WALL) return MAT.FOREST;
    if (roomOf(tx, ty) === fountRoom && Math.hypot(px - fcx, py - fcy + 4) < 46) return MAT.PAVE; // round stone floor under the fountain
    if (t === T.WATER) return MAT.WATER;
    if (roomOf(tx, ty) === plazaRoom) return MAT.PAVE;
    if (t === T.PATH || t === T.GATE) return MAT.DIRT;
    if (nearWater(tx, ty) && roomOf(tx, ty) !== fountRoom) return MAT.SHORE;
    return MAT.GRASS;
  };
  const im = g.createImageData(W, H), D = im.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // warp the lookup a few pixels: organic borders between materials
    const wx = (noise(x / 7, y / 7) - 0.5) * 9, wy = (noise(x / 7 + 40, y / 7 + 40) - 0.5) * 9;
    let m = matAt((x + wx) | 0, (y + wy) | 0);
    const real = matAt(x, y);
    if (real === MAT.WATER || m === MAT.WATER) m = real; // water keeps its exact shape (tiles drawn later)
    const patch = noise(x / 46, y / 46) * 0.7 + noise(x / 13, y / 13) * 0.3, dith = hash(x, y) - 0.5;
    let col;
    if (m === MAT.GRASS) { const p = PAL.grass; col = p[Math.max(0, Math.min(p.length - 1, Math.floor(patch * p.length + dith * 1.1)))]; }
    else if (m === MAT.DIRT) { const p = PAL.dirt; col = p[Math.max(0, Math.min(p.length - 1, Math.floor(patch * p.length + dith * 1.3)))]; }
    else if (m === MAT.PAVE) {
      const row = y >> 3, off = (row & 1) * 8, edge = (y & 7) === 0 || ((x + off) & 15) === 0;
      const p = PAL.pave; col = edge ? [128, 106, 72] : p[Math.max(0, Math.min(p.length - 1, Math.floor(hash(((x + off) >> 4), row) * 2 + 1 + dith * 0.8)))];
    } else if (m === MAT.FOREST) { const p = PAL.forest; col = p[Math.max(0, Math.min(2, Math.floor(patch * 3 + dith)))]; }
    else if (m === MAT.SHORE) { const p = PAL.shore; col = p[Math.max(0, Math.min(p.length - 1, Math.floor(patch * p.length + dith * 1.2)))]; }
    else { // painted water, like the Eden river: deep in the middle, foam at the shore, light streaks
      const isW = (ax, ay) => matAt(ax, ay) === MAT.WATER;
      const edge = !isW(x - 2, y) || !isW(x + 2, y) || !isW(x, y - 2) || !isW(x, y + 2);
      const near = edge || !isW(x - 6, y) || !isW(x + 6, y) || !isW(x, y - 6) || !isW(x, y + 6);
      const mid = near || !isW(x - 12, y) || !isW(x + 12, y) || !isW(x, y - 12) || !isW(x, y + 12);
      const wave = Math.sin(x * 0.16 + y * 0.05 + noise(x / 16, y / 16) * 7);
      if (edge && hash(x, y) < 0.75) col = hash(x + 1, y) < 0.5 ? [232, 248, 255] : [190, 232, 250];
      else if (wave > 0.93 && noise(x / 6, y / 6) > 0.55) col = [178, 228, 252];
      else if (wave > 0.82 && noise(x / 6, y / 6) > 0.35) col = near ? [110, 196, 236] : [84, 162, 222];
      else col = near ? [64, 160, 220] : mid ? [44, 128, 200] : [32, 98, 172];
      if (hash(x * 3, y * 7) > 0.996) col = [255, 255, 255]; // sparkle
    }
    const i = (y * W + x) * 4;
    D[i] = col[0]; D[i + 1] = col[1]; D[i + 2] = col[2]; D[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  // small details on grass: tufts, pebbles, flowers
  const PETAL = ['#ffffff', '#ffd84a', '#ff8fbf', '#ff6a6a', '#9fd0ff'];
  for (let y = 0; y < map.rows; y++) for (let x = 0; x < map.cols; x++) {
    const t = map.get(x, y);
    if (t === T.WATER && roomOf(x, y) === fountRoom) continue; // the fountain sprite covers it
    if (t === T.WATER) continue; // painted per pixel above
    if (t !== T.FLOOR && t !== T.FLOWER && t !== T.TREE && t !== T.BUSH) continue;
    if (roomOf(x, y) === plazaRoom) continue;
    const n = t === T.FLOWER ? 4 : 2;
    for (let k = 0; k < n; k++) {
      const px = x * 16 + ((R() * 14) | 0), py = y * 16 + ((R() * 14) | 0), r = R();
      if (t === T.FLOWER || r < 0.12) { // flower
        g.fillStyle = '#2b5e1c'; g.fillRect(px + 1, py + 2, 1, 2);
        g.fillStyle = PETAL[(R() * PETAL.length) | 0]; g.fillRect(px, py, 3, 1); g.fillRect(px + 1, py - 1, 1, 3);
        g.fillStyle = '#f2b72a'; g.fillRect(px + 1, py, 1, 1);
      } else if (r < 0.75) { // tuft
        g.fillStyle = '#2f6a22'; g.fillRect(px, py + 1, 1, 2); g.fillRect(px + 2, py, 1, 3); g.fillRect(px + 4, py + 1, 1, 2);
        g.fillStyle = '#8fd05a'; g.fillRect(px + 2, py, 1, 1);
      } else if (r < 0.85) { // pebble
        g.fillStyle = '#8d8a7a'; g.fillRect(px, py, 2, 1); g.fillStyle = '#c9c4ae'; g.fillRect(px, py - 1, 1, 1);
      }
    }
  }
  // soft shade along the forest edge, then the forest canopy (dense round trees)
  for (let y = 0; y < map.rows; y++) for (let x = 0; x < map.cols; x++) {
    if (map.get(x, y) === T.WALL || map.get(x, y) === T.WATER) continue;
    if (map.get(x, y - 1) === T.WALL) { g.fillStyle = 'rgba(8,20,10,.32)'; g.fillRect(x * 16, y * 16, 16, 7); g.fillStyle = 'rgba(8,20,10,.18)'; g.fillRect(x * 16, y * 16 + 7, 16, 5); }
    if (map.get(x - 1, y) === T.WALL) { g.fillStyle = 'rgba(8,20,10,.22)'; g.fillRect(x * 16, y * 16, 5, 16); }
  }
  const disc = (cx, cy, r, col) => { g.fillStyle = col; for (let dy = -r; dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy)); g.fillRect(cx - w, cy + dy, w * 2 + 1, 1); } };
  const crowns = [];
  for (let y = 0; y < H; y += 11) for (let x = 0; x < W; x += 11) {
    const jx = x + ((hash(x, y + 7) - 0.5) * 8) | 0, jy = y + ((hash(x + 3, y) - 0.5) * 8) | 0;
    if (matAt(jx, jy) !== MAT.FOREST) continue;
    crowns.push([jx, jy, 8 + ((hash(jx, jy) * 6) | 0), hash(jy, jx)]);
  }
  crowns.sort((p, q) => p[1] - q[1]);
  const SH = [['#0c1f10', '#1f4a22', '#2c6029', '#3f7a32', '#5c9a3e'], ['#0c1f10', '#1d4526', '#28582f', '#3a7038', '#548c45'], ['#0c1f10', '#244d1e', '#336624', '#4a822c', '#6aa23c']];
  for (const [x, y, r, k] of crowns) {
    const s = SH[(k * 3) | 0];
    g.fillStyle = 'rgba(0,0,0,.25)'; disc(x + 2, y + 4, r, 'rgba(0,0,0,.22)');
    disc(x, y, r, s[0]); disc(x, y, r - 1, s[1]); disc(x - 1, y - 1, r - 3, s[2]); disc(x - 2, y - 3, Math.max(2, r - 6), s[3]);
    disc(x - 3, y - 4, Math.max(1, r - 9), s[4]);
  }
  for (let y = 0; y < map.rows; y++) for (let x = 0; x < map.cols; x++) {
    if (map.get(x, y) === T.GATE) tile(1, 3, x, y);
  }
  // flat decorations baked into the ground
  map.rooms.forEach((r, i) => {
    const cx = (r.x + r.w / 2) * 16, cy = (r.y + r.h / 2) * 16;
    if (r.deco === 'plaza' && img('fuga.praca')) g.drawImage(img('fuga.praca'), (cx - 48) | 0, (cy - 48) | 0);
    if (r.deco === 'lake' && img('fuga.lago')) {
      for (let n = 0; n < 7; n++) {
        const x = r.x + 5 + ((R() * (r.w - 10)) | 0), y = r.y + 5 + ((R() * (r.h - 10)) | 0);
        if ([[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].every(([a, b]) => map.get(x + a, y + b) === T.WATER)) {
          const cell = (R() * 4) | 0; // same random sequence as before, so every phone draws the same lake
          if (cell === 3) lakeFish.push({ x: x * 16 + 8, y: y * 16 + 8 }); // the leaping fish is animated, not painted
          else g.drawImage(img('fuga.lago'), cell * 32, 0, 32, 32, x * 16 - 8, y * 16 - 8, 32, 32);
        }
      }
    }
    if (r.deco === 'flowers' && img('fuga.canteiros')) {
      [[r.x + 1, r.y + 1], [r.x + r.w - 3, r.y + 1], [r.x + 1, r.y + r.h - 3], [r.x + r.w - 3, r.y + r.h - 3]].forEach(([x, y], k) => g.drawImage(img('fuga.canteiros'), k * 32, 0, 32, 32, x * 16, y * 16, 32, 32));
    }
    // name sign at the top of each area
    if (img('fuga.placa')) {
      g.font = 'bold 7px sans-serif';
      const sw = Math.max(64, Math.ceil(g.measureText(r.name).width / 0.5 + 8)), sx = (cx - sw / 2) | 0, sy = r.y * 16 + 2;
      g.drawImage(img('fuga.placa'), 0, 0, 96, 32, sx, sy, sw, Math.round(sw / 3));
      g.textAlign = 'center'; g.fillStyle = '#3a2208';
      g.fillText(r.name, cx, sy + Math.round(sw / 3) * 0.47);
    }
    // tall landmarks (drawn by depth with the players)
    const land = { 'Torre de Vigia': 'fuga.torre', 'Portão do Éden': 'fuga.portao', 'Altar de Pedras': 'fuga.altar' }[r.name];
    if (land && img(land)) { const im = img(land); props.push({ im, sx: 0, sy: 0, w: im.width, h: im.height, x: cx - im.width / 2, y: (r.name === 'Portão do Éden' ? r.y + r.h - 1 : r.y + r.h / 2 + 1) * 16 - im.height, fire: r.name === 'Altar de Pedras' }); }
    if (r.deco === 'fountain' && img('fuga.fonte')) props.push({ im: img('fuga.fonte'), sx: 0, sy: 0, w: 64, h: 64, x: cx - 32, y: cy - 36 });
  });
  // trees and bushes as props
  const treeArt = { Pomar: 'fuga.macieira', Oliveiras: 'fuga.oliveira', Vinha: 'fuga.parreira' };
  for (let y = 0; y < map.rows; y++) for (let x = 0; x < map.cols; x++) {
    const t = map.get(x, y);
    if (t === T.TREE) {
      const r = map.rooms[roomOf(x, y)];
      const id = r && treeArt[r.name];
      if (id && img(id)) { const im = img(id); props.push({ im, sx: 0, sy: 0, w: im.width, h: im.height, x: x * 16 + 8 - im.width / 2, y: y * 16 + 16 - im.height }); }
      else if (r && r.deco === 'maze') { g.fillStyle = '#1f3d16'; g.fillRect(x * 16, y * 16, 16, 16); tile(map.get(x, y + 1) === T.TREE ? 0 : 1, 1, x, y); }
      else tile(6, 2, x, y); // rock
    }
    if (t === T.BUSH && map.get(x - 1, y) !== T.BUSH && map.get(x, y - 1) !== T.BUSH && img('fuga.moita')) {
      props.push({ im: img("fuga.moita"), sx: 0, sy: 0, w: 32, h: 32, x: x * 16, y: y * 16 });
    }
  }
  const fish = lakeFish.map((f, i) => ({ ...f, period: 4 + (i * 3) % 4, phase: i * 1.7, dir: i % 2 ? -1 : 1 }));
  for (let y = 1; y < map.rows - 1 && fish.length < 5; y++) for (let x = 1; x < map.cols - 1 && fish.length < 5; x++) {
    let ok = map.get(x, y) === T.WATER;
    for (let dy = -1; ok && dy <= 1; dy++) for (let dx = -1; ok && dx <= 1; dx++) ok = map.get(x + dx, y + dy) === T.WATER;
    if (ok && !fish.some((f) => Math.abs(f.x - (x * 16 + 8)) < 64 && Math.abs(f.y - (y * 16 + 8)) < 64)) fish.push({ x: x * 16 + 8, y: y * 16 + 8, period: 5 + (x + y) % 4, phase: (x * 7 + y) % 5, dir: (x + y) % 2 ? 1 : -1 });
  }
  return { ground: c, props, fish, lago: img('fuga.lago'), portal: img('fuga.portal'), thorns: img('fuga.espinhos'), snake: img('fuga.serpente'), snakeFx: img('fuga.serpente_fx'), objs: img('fuga.objetos'), fx: img('fuga.fx'), frame: img('fuga.minimapa') };
}

/** Draws one prop (fountain animates). */
export function drawProp(ctx, p, time) {
  const f = p.frames ? Math.floor(time * 5) % p.frames : 0;
  ctx.drawImage(p.im, p.sx + f * p.w, p.sy, p.w, p.h, Math.round(p.x), Math.round(p.y), p.w, p.h);
  if (p.fire) drawFlame(ctx, Math.round(p.x + p.w / 2), Math.round(p.y + 24), time);
}

/** Living fire on the altar embers: flickering tongues, a soft glow and rising sparks (pixel style). */
function drawFlame(ctx, x, y, t) {
  const n = (k) => 0.5 + 0.5 * Math.sin(t * (7 + k * 1.7) + k * 2.1) * Math.sin(t * (3.1 + k) + k);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y - 8, 1, x, y - 8, 22 + 3 * n(9));
  g.addColorStop(0, 'rgba(255,170,60,.35)'); g.addColorStop(1, 'rgba(255,120,30,0)');
  ctx.fillStyle = g; ctx.fillRect(x - 26, y - 34, 52, 44);
  ctx.globalCompositeOperation = 'source-over';
  const cols = ['#d8401c', '#ff8a1e', '#ffd04a', '#fff3b0'];
  for (let k = 0; k < 5; k++) {
    const ox = (k - 2) * 4 + Math.round(Math.sin(t * 5 + k) * 1), hgt = Math.round(7 + 9 * n(k) - Math.abs(k - 2) * 2);
    for (let j = 0; j < hgt; j++) {
      const w = Math.max(1, Math.round(4 * (1 - j / hgt)));
      const sway = Math.round(Math.sin(t * 9 + k + j * 0.5) * (j / hgt) * 1.5);
      ctx.fillStyle = cols[Math.min(3, Math.floor((1 - j / hgt) * 1.2 + (k === 2 ? 1.6 : 0.8) * (1 - j / hgt)))];
      ctx.fillRect(x + ox - (w >> 1) + sway, y - j, w, 1);
    }
  }
  for (let k = 0; k < 4; k++) { // sparks
    const life = ((t * 0.9 + k * 0.27) % 1);
    ctx.fillStyle = life < 0.6 ? '#ffe28a' : '#ff9a3a';
    ctx.globalAlpha = 1 - life;
    ctx.fillRect(Math.round(x + Math.sin(k * 5 + t * 2) * 6), Math.round(y - 10 - life * 22), 1, 1);
  }
  ctx.restore();
}

/** Small flickering flame over a brazier's embers (task stations). */
function emberFlame(ctx, x, y, t) {
  const cols = ['#e2501e', '#ff9a24', '#ffd85a'];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = `rgba(255,150,50,${0.12 + 0.08 * Math.sin(t * 11)})`;
  ctx.beginPath(); ctx.ellipse(x, y - 2, 11, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  for (let k = 0; k < 3; k++) {
    const hgt = Math.round(3 + 3 * (0.5 + 0.5 * Math.sin(t * (8 + k * 2.3) + k * 1.9))), ox = (k - 1) * 4;
    for (let j = 0; j < hgt; j++) {
      const w = j < hgt - 1 ? 2 : 1;
      ctx.fillStyle = cols[Math.min(2, Math.floor((1 - j / hgt) * 2.4))];
      ctx.fillRect(x + ox - (w >> 1) + Math.round(Math.sin(t * 10 + k + j) * (j / hgt)), y - j, w, 1);
    }
  }
  const life = (t * 1.1) % 1; // one spark
  ctx.globalAlpha = 1 - life; ctx.fillStyle = '#ffe28a';
  ctx.fillRect(Math.round(x + Math.sin(t * 3) * 4), Math.round(y - 5 - life * 12), 1, 1);
  ctx.restore();
}

/** Fish that leap out of the water every few seconds (the artist's leaping-fish sprite), with splash and ripples. */
export function drawFish(ctx, art, t, vx, vy, vw, vh) {
  const fish = art && art.fish;
  if (!fish) return;
  const ring = (x, y, k) => { ctx.strokeStyle = `rgba(230,250,255,${(1 - k) * 0.8})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, 3 + k * 7, 1 + k * 2.2, 0, 0, Math.PI * 2); ctx.stroke(); };
  for (const f of fish) {
    if (f.x < vx - 32 || f.x > vx + vw + 32 || f.y < vy - 40 || f.y > vy + vh + 32) continue;
    const c = (t + f.phase) % f.period, dur = 1.1;
    if (c < dur) {
      const k = c / dur, px = f.x + (k - 0.5) * 16 * f.dir, py = f.y - Math.sin(Math.PI * k) * 14;
      if (k < 0.3) ring(f.x - 8 * f.dir, f.y + 3, k / 0.3);
      ctx.save(); ctx.translate(Math.round(px), Math.round(py)); ctx.rotate((k - 0.5) * 1.6 * f.dir); if (f.dir < 0) ctx.scale(-1, 1);
      if (art.lago) { ctx.imageSmoothingEnabled = false; ctx.drawImage(art.lago, 100, 0, 25, 19, -12, -10, 25, 19); } // the fish only (its splash is drawn live)
      else { ctx.fillStyle = '#ff8a2a'; ctx.fillRect(-4, -1, 7, 3); ctx.fillStyle = '#1a1030'; ctx.fillRect(2, -1, 1, 1); }
      ctx.restore();
    } else if (c < dur + 0.7) { const k = (c - dur) / 0.7; ring(f.x + 8 * f.dir, f.y + 3, k); if (k < 0.5) ring(f.x + 8 * f.dir, f.y + 3, k * 2); }
    else if (((c * 1.3) % 2) < 0.9) ring(f.x, f.y + 3, ((c * 1.3) % 2) / 0.9); // calm ripple: there is a fish here
  }
}

// ---- serpent (S1/S2) and task objects (S3) ----
/** Serpent: walk sheet by direction; chase / tired use the effects sheet. */
export function drawSnake(ctx, art, e, time) {
  const f = Math.floor(time * 8) % 4;
  const x = Math.round(e.x - 24), y = Math.round(e.y - 40);
  if (art.snakeFx && (e.state === 'chase' || e.state === 'tired')) {
    const row = e.state === 'chase' ? 0 : 2, left = e.dir === 1;
    ctx.save();
    if (left) { ctx.translate(x + 48, y); ctx.scale(-1, 1); ctx.drawImage(art.snakeFx, f * 48, row * 48, 48, 48, 0, 0, 48, 48); }
    else ctx.drawImage(art.snakeFx, f * 48, row * 48, 48, 48, x, y, 48, 48);
    ctx.restore();
    return;
  }
  ctx.drawImage(art.snake, f * 48, (e.dir || 0) * 48, 48, 48, x, y, 48, 48);
}

/** Smoke where a serpent is about to appear (S2 row 2), by remaining time. */
export function drawSpawn(ctx, art, w) {
  const f = Math.min(3, Math.max(0, Math.floor((1 - w.t / 1.6) * 4)));
  ctx.drawImage(art.snakeFx, f * 48, 48, 48, 48, Math.round(w.x - 24), Math.round(w.y - 40), 48, 48);
}

const ICON = { quiz: [4, 0], vf: [4, 0], lacunas: [4, 0], quemdisse: [4, 0], versiculo: [4, 0], ordem: [6, 0], sequencia: [6, 0],
  memory: [6, 1], pares: [6, 1], cacapalavras: [6, 1], tictactoe: [6, 1], mana: [7, 0], cesto: [7, 0], labirinto: [5, 1], armadura: [4, 1] };
const BIT = { 'Fragmentos do pergaminho': [4, 0], 'Pedras do memorial': [6, 0], 'Sementes perdidas': [5, 0] };
const PLATE = { 'Alavancas do portão': [[0, 1], [1, 1]], 'Pedras de apoio': [[2, 0], [3, 0]], 'Lâmpadas gêmeas': [[2, 1], [3, 1]], 'Selos da aliança': [[2, 0], [4, 1]] };

const obj = (ctx, art, [c, r], x, y, size = 32) => ctx.drawImage(art.objs, c * 32, r * 32, 32, 32, Math.round(x - size / 2), Math.round(y - size + 4), size, size);

/** One task station (and its plates / bits). */
export function drawTask(ctx, art, t, time) {
  const bob = Math.round(Math.sin(time * 3 + t.n) * 1.5);
  if (t.kind === 'ativar') {
    const [off, on] = PLATE[t.name] || [[2, 0], [3, 0]];
    t.plates.forEach((p) => obj(ctx, art, t.done ? on : off, p.x, p.y + 6, 24));
    return;
  }
  if (t.done) {
    obj(ctx, art, [7, 1], t.x, t.y, 24);
    if (art.fx) ctx.drawImage(art.fx, (Math.floor(time * 8) % 8) * 32, 32, 32, 32, Math.round(t.x - 16), Math.round(t.y - 28), 32, 32); // sparkle
    return;
  }
  if (t.kind === 'colher') {
    obj(ctx, art, [0, 0], t.x, t.y, 28);
    for (const b of t.bits) if (!b.got) obj(ctx, art, BIT[t.name] || [4, 0], b.x, b.y + bob, 20);
    return;
  }
  obj(ctx, art, [1, 0], t.x, t.y + 4, 28); // lit pedestal
  emberFlame(ctx, Math.round(t.x), Math.round(t.y - 8), time + t.n * 1.37); // the embers flicker
  obj(ctx, art, ICON[t.type] || [4, 0], t.x, t.y - 16 + bob, 22); // what the task is about
}
