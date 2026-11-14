// Responsive, crisp canvas.
// The backing store uses real device pixels; the game draws in "logical"
// pixels that are scaled by a whole number so pixel art never blurs.

export class Display {
  constructor(canvas, { targetWidth = 256 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.targetWidth = targetWidth; // ~8 tiles of 32 px across
    this.scale = 1;
    this.width = 0;  // logical pixels
    this.height = 0;
    this.dpr = 1;
    this.listeners = new Set();
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', this.resize);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', this.resize);
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const pxW = Math.max(1, Math.round(rect.width * dpr));
    const pxH = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== pxW) this.canvas.width = pxW;
    if (this.canvas.height !== pxH) this.canvas.height = pxH;
    this.dpr = dpr;
    this.scale = Math.max(1, Math.floor(pxW / this.targetWidth));
    this.width = Math.ceil(pxW / this.scale);
    this.height = Math.ceil(pxH / this.scale);
    // Changing the canvas size resets context state.
    this.ctx.imageSmoothingEnabled = false;
    for (const fn of this.listeners) fn(this);
  }

  onResize(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Call at the start of each frame. Leaves the context in logical pixels. */
  begin(clearColor = '#070a1c') {
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = clearColor;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    return ctx;
  }

  /** Convert a CSS-pixel point (e.g. from a pointer event) to logical pixels. */
  toLogical(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) * this.dpr) / this.scale;
    const y = ((clientY - rect.top) * this.dpr) / this.scale;
    return { x, y };
  }
}
