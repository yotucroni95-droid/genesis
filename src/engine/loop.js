// Fixed-timestep game loop driven by requestAnimationFrame.
// update() always receives the same step (1/60 s) so physics stay stable
// on fast and slow phones; render() receives the interpolation factor.

export class GameLoop {
  constructor({ update, render, step = 1 / 60, maxFrame = 0.25 }) {
    this.update = update;
    this.render = render;
    this.step = step;
    this.maxFrame = maxFrame;
    this.accumulator = 0;
    this.last = 0;
    this.running = false;
    this.rafId = 0;
    this._tick = this._tick.bind(this);
    this._onVisibility = () => {
      // Avoid a huge catch-up burst after the tab was hidden.
      if (!document.hidden) this.last = performance.now();
    };
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    document.addEventListener('visibilitychange', this._onVisibility);
    this.rafId = requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    document.removeEventListener('visibilitychange', this._onVisibility);
  }

  _tick(now) {
    if (!this.running) return;
    let frame = (now - this.last) / 1000;
    this.last = now;
    if (frame > this.maxFrame) frame = this.maxFrame;
    this.accumulator += frame;
    while (this.accumulator >= this.step) {
      this.update(this.step);
      this.accumulator -= this.step;
    }
    this.render(this.accumulator / this.step);
    this.rafId = requestAnimationFrame(this._tick);
  }
}
