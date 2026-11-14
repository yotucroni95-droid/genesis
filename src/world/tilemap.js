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
    this.background = ext.background ? assets.image(ext.background) : null;
    this.tileset = ext.tileset ? assets.entry(ext.tileset) : null;
    this.spawn = ext.spawn || { x: 1, y: 1 };
    this.ambient = ext.ambient || {};
    const collision = this.layers.collision;
    this.solid = collision ? collision.data : new Array(this.cols * this.rows).fill(0);
    this.triggers = (this.layers.triggers && this.layers.triggers.objects) || [];
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
    ctx.fillStyle = 'rgba(255,0,60,.35)';
    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        if (this.isSolidTile(tx, ty)) ctx.fillRect(tx * this.tileW, ty * this.tileH, this.tileW, this.tileH);
      }
    }
  }
}
