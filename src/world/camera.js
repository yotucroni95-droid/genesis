// Follows a target smoothly and never shows outside the map.

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.w = 0;
    this.h = 0;
  }

  clampTo(map) {
    const clampAxis = (pos, view, size) => (size <= view ? (size - view) / 2 : Math.max(0, Math.min(size - view, pos)));
    this.x = clampAxis(this.x, this.w, map.pixelW);
    this.y = clampAxis(this.y, this.h, map.pixelH);
  }

  follow(tx, ty, map, viewW, viewH, dt, snap = false) {
    this.w = viewW;
    this.h = viewH;
    const goalX = tx - viewW / 2;
    const goalY = ty - viewH / 2;
    const k = snap ? 1 : Math.min(1, dt * 8);
    this.x += (goalX - this.x) * k;
    this.y += (goalY - this.y) * k;
    this.clampTo(map);
  }

  /** Whole-pixel offset used for drawing, so pixel art never shimmers. */
  get ix() { return Math.round(this.x); }
  get iy() { return Math.round(this.y); }
}
