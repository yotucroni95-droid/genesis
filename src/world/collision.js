// Axis-aligned box against the map: the tile grid (walls, trees, houses)
// plus the fine water mask. Moves one axis at a time so the player slides
// along walls instead of sticking to them.

export function boxHitsMap(map, x, y, w, h) {
  const tx0 = Math.floor(x / map.tileW);
  const ty0 = Math.floor(y / map.tileH);
  const tx1 = Math.floor((x + w - 0.001) / map.tileW);
  const ty1 = Math.floor((y + h - 0.001) / map.tileH);
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (!map.isSolidTile(tx, ty)) continue;
      // a painted road crossing the edge of a blocked tile stays walkable
      const inside = tx >= 0 && ty >= 0 && tx < map.cols && ty < map.rows;
      if (inside && map.isRoadRect(Math.max(x, tx * map.tileW), Math.max(y, ty * map.tileH),
        Math.min(x + w, (tx + 1) * map.tileW), Math.min(y + h, (ty + 1) * map.tileH))) continue;
      return true;
    }
  }
  if (map.extraSolids) {
    for (const r of map.extraSolids) {
      if (x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y) return true;
    }
  }
  if (map.waterMask) {
    const c = map.waterCell;
    for (let py = Math.floor(y / c) * c; py < y + h; py += c) {
      for (let px = Math.floor(x / c) * c; px < x + w; px += c) {
        if (map.isWaterAt(px, py)) return true;
      }
    }
  }
  return false;
}

/** Moves as far as possible along one axis, never into anything solid. */
function moveAxis(map, x, y, w, h, d, horizontal) {
  if (!d) return horizontal ? x : y;
  const pos = horizontal ? x : y;
  const hits = (p) => (horizontal ? boxHitsMap(map, p, y, w, h) : boxHitsMap(map, x, p, w, h));
  if (!hits(pos + d)) return pos + d;
  // blocked: creep forward in half-pixel steps up to the obstacle
  const sign = Math.sign(d);
  let best = pos;
  for (let s = 0.5; s < Math.abs(d); s += 0.5) {
    if (hits(pos + sign * s)) break;
    best = pos + sign * s;
  }
  return best;
}

const ASSIST = 14; // pixels: how far around a corner the player is helped

/**
 * Corner help: when a move along one axis is blocked, look a few pixels to
 * each side. If the way is open there (the entrance of a road, a gap between
 * fences), slide toward it, so the player never snags on a corner.
 */
function cornerSlide(map, x, y, w, h, d, horizontal, step) {
  const sign = Math.sign(d);
  const probe = sign * Math.max(2, Math.abs(d));
  for (let k = 1; k <= ASSIST; k++) {
    for (const side of [-1, 1]) {
      const off = side * k;
      const ok = horizontal
        ? !boxHitsMap(map, x, y + off, w, h) && !boxHitsMap(map, x + probe, y + off, w, h)
        : !boxHitsMap(map, x + off, y, w, h) && !boxHitsMap(map, x + off, y + probe, w, h);
      if (!ok) continue;
      // free path found: move toward it (never further than one step)
      const m = side * Math.min(k, step);
      return horizontal ? { x, y: moveAxis(map, x, y, w, h, m, false) } : { x: moveAxis(map, x, y, w, h, m, true), y };
    }
  }
  return { x, y };
}

/** box = {x, y, w, h} (top-left). Returns the moved box position. */
export function moveBox(map, box, dx, dy) {
  let x = moveAxis(map, box.x, box.y, box.w, box.h, dx, true);
  let y = moveAxis(map, x, box.y, box.w, box.h, dy, false);
  const step = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
  // blocked on the main direction of travel and not moving the other way: help
  if (Math.abs(dx) >= Math.abs(dy) && Math.abs(x - box.x) < Math.abs(dx) * 0.5 && Math.abs(y - box.y) < 0.01) {
    ({ x, y } = cornerSlide(map, x, y, box.w, box.h, dx, true, step));
  } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(y - box.y) < Math.abs(dy) * 0.5 && Math.abs(x - box.x) < 0.01) {
    ({ x, y } = cornerSlide(map, x, y, box.w, box.h, dy, false, step));
  }
  return { x, y };
}
