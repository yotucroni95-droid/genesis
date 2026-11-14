// Axis-aligned box against the tile grid. Moves one axis at a time so the
// player slides along walls instead of sticking to them.

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
  return false;
}

/** box = {x, y, w, h} (top-left). Returns the moved box position. */
export function moveBox(map, box, dx, dy) {
  let { x, y } = box;
  const { w, h } = box;
  if (dx) {
    const nx = x + dx;
    if (!boxHitsMap(map, nx, y, w, h)) x = nx;
    else if (dx > 0) x = Math.floor((nx + w) / map.tileW) * map.tileW - w - 0.001;
    else x = (Math.floor(nx / map.tileW) + 1) * map.tileW + 0.001;
    // corner help: if still blocked a hair, nudge around small corners
    if (boxHitsMap(map, x, y, w, h)) x = box.x;
  }
  if (dy) {
    const ny = y + dy;
    if (!boxHitsMap(map, x, ny, w, h)) y = ny;
    else if (dy > 0) y = Math.floor((ny + h) / map.tileH) * map.tileH - h - 0.001;
    else y = (Math.floor(ny / map.tileH) + 1) * map.tileH + 0.001;
    if (boxHitsMap(map, x, y, w, h)) y = box.y;
  }
  return { x, y };
}
