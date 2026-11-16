// Tile map loaded from a Tiled-style JSON file (layers: ground, objects,
// collision, triggers). A map may also use one painted background image
// instead of ground tiles; extra Gênesis data lives under `genesis`.

export class TileMap {
  constructor(json, assets) {
    this.cols = json.width;
    this.rows = json.height;
    this.tileW = json.tilewidth;
    this.tileH = json.tileheight;
    this.pixelW = this.cols * this.tileW;
    this.pixelH = this.rows * this.tileH;
    this.layers = {};
    for (const layer of json.layers || []) this.layers[layer.name] = layer;

    const ext = json.genesis || {};
    this.name = ext.name || '';
    this.id = (ext.background || '').replace('map.', '');
    this.background = ext.background ? assets.image(ext.background) : null;
    this.tileset = ext.tileset ? assets.entry(ext.tileset) : null;
    this.spawn = ext.spawn || { x: 1, y: 1 };
    this.ambient = ext.ambient || {};
    const collision = this.layers.collision;
    this.solid = collision ? collision.data : new Array(this.cols * this.rows).fill(0);
    this.triggers = (this.layers.triggers && this.layers.triggers.objects) || [];
    this.bridges = ext.bridges || [];
    this.waterCell = 4;
    this.waterMask = null;
    if (this.background && ext.waterSolid !== false) this.waterMask = this.buildWaterMask();
    this.roadMask = null; // 4x4 px cells of painted road inside blocked tiles
    if (this.background && ext.roadColor) this.roadMask = this.buildRoadMask(ext.roadColor, ext.roadTolerance || 48);
  }

  /**
   * The collision grid is made of 32 px tiles, but the painted roads curve.
   * Where a blocked tile touches a walkable one, every 4x4 px cell painted in
   * the road's colour is opened, so the player can follow the road exactly
   * (corners, curves, diagonals) without walking into houses or trees.
   */
  buildRoadMask(color, tol) {
    const c = 4;
    const W = Math.floor(this.pixelW / c);
    const H = Math.floor(this.pixelH / c);
    const canvas = document.createElement('canvas');
    canvas.width = this.pixelW;
    canvas.height = this.pixelH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(this.background, 0, 0, this.pixelW, this.pixelH);
    let px;
    try { px = ctx.getImageData(0, 0, this.pixelW, this.pixelH).data; } catch { return null; }
    const [r0, g0, b0] = color;
    const tol2 = tol * tol;
    const mask = new Uint8Array(W * H);
    const per = this.tileW / c;
    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        if (!this.isSolidTile(tx, ty)) continue;
        let nearFree = false;
        for (let dy = -1; dy <= 1 && !nearFree; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = tx + dx, ny = ty + dy;
            if (nx >= 0 && ny >= 0 && nx < this.cols && ny < this.rows && !this.solid[ny * this.cols + nx]) { nearFree = true; break; }
          }
        }
        if (!nearFree) continue;
        for (let cy = ty * per; cy < (ty + 1) * per; cy++) {
          for (let cx = tx * per; cx < (tx + 1) * per; cx++) {
            let n = 0;
            for (let y = cy * c; y < cy * c + c; y++) {
              for (let x = cx * c; x < cx * c + c; x++) {
                const i = (y * this.pixelW + x) * 4;
                const dr = px[i] - r0, dg = px[i + 1] - g0, db = px[i + 2] - b0;
                if (dr * dr + dg * dg + db * db < tol2) n++;
              }
            }
            if (n >= 12) mask[cy * W + cx] = 1;
          }
        }
      }
    }
    this.roadW = W;
    return mask;
  }

  /** True when the whole rectangle inside a blocked tile is painted road. */
  isRoadRect(x0, y0, x1, y1) {
    if (!this.roadMask) return false;
    const c = 4;
    for (let y = Math.floor(y0 / c); y <= Math.floor((y1 - 0.001) / c); y++) {
      for (let x = Math.floor(x0 / c); x <= Math.floor((x1 - 0.001) / c); x++) {
        if (!this.roadMask[y * this.roadW + x]) return false;
      }
    }
    return true;
  }

  /**
   * Fine collision for water, read from the painted map itself: every 4x4 px
   * cell that is blue water is solid, except where a bridge was marked.
   */
  buildWaterMask() {
    const c = this.waterCell;
    const W = Math.floor(this.pixelW / c);
    const H = Math.floor(this.pixelH / c);
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.background, 0, 0, W, H);
    let px;
    try { px = ctx.getImageData(0, 0, W, H).data; } catch { return null; }
    let mask = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
      if (b > 100 && b > r + 40 && b >= g - 12) mask[i] = 1;
    }
    // fill small holes (water lilies, ripples) so they are not stepping stones
    for (let pass = 0; pass < 2; pass++) {
      const next = mask.slice();
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          if (mask[y * W + x]) continue;
          let n = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) n += mask[(y + dy) * W + x + dx];
          if (n >= 5) next[y * W + x] = 1;
        }
      }
      mask = next;
    }
    for (const [bx, by, bw, bh] of this.bridges) {
      for (let y = Math.floor(by / c); y < Math.ceil((by + bh) / c); y++) {
        for (let x = Math.floor(bx / c); x < Math.ceil((bx + bw) / c); x++) {
          if (x >= 0 && y >= 0 && x < W && y < H) mask[y * W + x] = 0;
        }
      }
    }
    this.waterW = W;
    this.waterH = H;
    return mask;
  }

  isWaterAt(px, py) {
    if (!this.waterMask) return false;
    const x = Math.floor(px / this.waterCell);
    const y = Math.floor(py / this.waterCell);
    if (x < 0 || y < 0 || x >= this.waterW || y >= this.waterH) return true;
    return this.waterMask[y * this.waterW + x] === 1;
  }

  isSolidTile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return true;
    return this.solid[ty * this.cols + tx] > 0;
  }

  /** Draws the visible part of the ground. ctx is already translated by -camera. */
  drawGround(ctx, cam) {
    const x0 = Math.max(0, Math.floor(cam.x));
    const y0 = Math.max(0, Math.floor(cam.y));
    const w = Math.min(this.pixelW - x0, Math.ceil(cam.w) + 1);
    const h = Math.min(this.pixelH - y0, Math.ceil(cam.h) + 1);
    if (this.background) {
      if (w > 0 && h > 0) ctx.drawImage(this.background, x0, y0, w, h, x0, y0, w, h);
    }
    if (this.tileset && this.tileset.image) {
      for (const name of ['ground', 'objects']) this.drawTileLayer(ctx, this.layers[name], x0, y0, w, h);
    }
  }

  drawTileLayer(ctx, layer, x0, y0, w, h) {
    if (!layer || !layer.data) return;
    const ts = this.tileset;
    const cols = ts.cols || Math.floor(ts.w / this.tileW);
    const tx0 = Math.floor(x0 / this.tileW), ty0 = Math.floor(y0 / this.tileH);
    const tx1 = Math.min(this.cols - 1, Math.floor((x0 + w) / this.tileW));
    const ty1 = Math.min(this.rows - 1, Math.floor((y0 + h) / this.tileH));
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const gid = layer.data[ty * this.cols + tx];
        if (!gid) continue;
        const i = gid - 1;
        ctx.drawImage(ts.image, (i % cols) * this.tileW, Math.floor(i / cols) * this.tileH, this.tileW, this.tileH,
          tx * this.tileW, ty * this.tileH, this.tileW, this.tileH);
      }
    }
  }

  drawDebug(ctx) {
    if (this.waterMask) {
      ctx.fillStyle = 'rgba(0,120,255,.45)';
      for (let y = 0; y < this.waterH; y++) {
        for (let x = 0; x < this.waterW; x++) {
          if (this.waterMask[y * this.waterW + x]) ctx.fillRect(x * this.waterCell, y * this.waterCell, this.waterCell, this.waterCell);
        }
      }
      ctx.fillStyle = 'rgba(255,220,0,.35)';
      for (const [bx, by, bw, bh] of this.bridges) ctx.fillRect(bx, by, bw, bh);
    }
    if (this.roadMask) {
      ctx.fillStyle = 'rgba(0,255,90,.5)';
      for (let i = 0; i < this.roadMask.length; i++) if (this.roadMask[i]) ctx.fillRect((i % this.roadW) * 4, Math.floor(i / this.roadW) * 4, 4, 4);
    }
    ctx.fillStyle = 'rgba(255,0,60,.35)';
    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        if (this.isSolidTile(tx, ty)) ctx.fillRect(tx * this.tileW, ty * this.tileH, this.tileW, this.tileH);
      }
    }
  }
}
