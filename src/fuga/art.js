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
  const props = [];
  const roomOf = (x, y) => map.rooms.findIndex((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  // seamless ground: flat colour + speckles (the generated grass tiles show a grid)
  const speck = (x, y, base, dots) => {
    g.fillStyle = base; g.fillRect(x * 16, y * 16, 16, 16);
    for (let k = 0; k < 5; k++) { g.fillStyle = dots[(R() * dots.length) | 0]; g.fillRect(x * 16 + ((R() * 15) | 0), y * 16 + ((R() * 15) | 0), 2, R() < 0.5 ? 1 : 2); }
  };
  const PETAL = ['#ffffff', '#ffd84a', '#ff8fbf', '#ff5a5a', '#8fc8ff'];
  const flower = (x, y, n) => {
    for (let k = 0; k < n; k++) {
      const px = x * 16 + 2 + ((R() * 11) | 0), py = y * 16 + 2 + ((R() * 11) | 0);
      g.fillStyle = '#2f6a1e'; g.fillRect(px + 1, py + 3, 1, 2);
      g.fillStyle = PETAL[(R() * PETAL.length) | 0]; g.fillRect(px, py + 1, 3, 1); g.fillRect(px + 1, py, 1, 3);
      g.fillStyle = '#f7c531'; g.fillRect(px + 1, py + 1, 1, 1);
    }
  };
  const GRASS_C = ['#6fb23c', '#4f8f2a', '#7cc246', '#5a9a30'];
  for (let y = 0; y < map.rows; y++) for (let x = 0; x < map.cols; x++) {
    const t = map.get(x, y);
    if (t === T.WALL) {
      speck(x, y, '#244a1c', ['#1b3a15', '#2f5d22', '#1f4218']);
      if (map.get(x, y + 1) !== T.WALL) tile(1, 1, x, y); // hedge face toward the walkable side
      continue;
    }
    if (roomOf(x, y) === plazaRoom && (t === T.PATH || t === T.FLOOR)) { // paved square
      speck(x, y, '#cdb88c', ['#bfa877', '#d9c79e', '#b49c6c']);
      g.fillStyle = 'rgba(90,64,30,.35)'; g.fillRect(x * 16, y * 16, 16, 1); g.fillRect(x * 16, y * 16, 1, 16);
      continue;
    }
    if (t === T.PATH) {
       speck(x, y, '#b9824a', ['#a46f3c', '#c99460', '#946234']);
      continue;
    }
    if (t === T.WATER) {
      tile(...pick([[0, 2], [1, 2]]), x, y);
      if (map.get(x, y - 1) !== T.WATER) tile(2, 2, x, y);
      continue;
    }
    speck(x, y, '#62a535', GRASS_C);
    if (t === T.FLOWER || (t === T.FLOOR && R() < 0.04)) flower(x, y, t === T.FLOWER ? 3 : 1);
    else if (t === T.GATE) tile(1, 3, x, y);
  }
  // flat decorations baked into the ground
  map.rooms.forEach((r, i) => {
    const cx = (r.x + r.w / 2) * 16, cy = (r.y + r.h / 2) * 16;
    if (r.deco === 'plaza' && img('fuga.praca')) g.drawImage(img('fuga.praca'), (cx - 48) | 0, (cy - 48) | 0);
    if (r.deco === 'lake' && img('fuga.lago')) {
      for (let n = 0; n < 7; n++) {
        const x = r.x + 5 + ((R() * (r.w - 10)) | 0), y = r.y + 5 + ((R() * (r.h - 10)) | 0);
        if (map.get(x, y) === T.WATER) g.drawImage(img('fuga.lago'), ((R() * 4) | 0) * 32, 0, 32, 32, x * 16 - 8, y * 16 - 8, 32, 32);
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
    if (land && img(land)) { const im = img(land); props.push({ im, sx: 0, sy: 0, w: im.width, h: im.height, x: cx - im.width / 2, y: (r.name === 'Portão do Éden' ? r.y + r.h - 1 : r.y + r.h / 2 + 1) * 16 - im.height }); }
    if (r.deco === 'fountain' && img('fuga.fonte')) props.push({ im: img('fuga.fonte'), sx: 0, sy: 0, w: 64, h: 64, x: cx - 32, y: cy - 36, frames: 3 });
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
  return { ground: c, props, portal: img('fuga.portal'), thorns: img('fuga.espinhos'), snake: img('fuga.serpente'), snakeFx: img('fuga.serpente_fx'), objs: img('fuga.objetos'), fx: img('fuga.fx'), frame: img('fuga.minimapa') };
}

/** Draws one prop (fountain animates). */
export function drawProp(ctx, p, time) {
  const f = p.frames ? Math.floor(time * 5) % p.frames : 0;
  ctx.drawImage(p.im, p.sx + f * p.w, p.sy, p.w, p.h, Math.round(p.x), Math.round(p.y), p.w, p.h);
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
  obj(ctx, art, ICON[t.type] || [4, 0], t.x, t.y - 16 + bob, 22); // what the task is about
}
