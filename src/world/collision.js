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
      if (map.isSolidTile(tx, ty)) return true;
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

/** box = {x, y, w, h} (top-left). Returns the moved box position. */
export function moveBox(map, box, dx, dy) {
  const x = moveAxis(map, box.x, box.y, box.w, box.h, dx, true);
  const y = moveAxis(map, x, box.y, box.w, box.h, dy, false);
  return { x, y };
}
