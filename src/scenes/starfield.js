// Animated starry background, shared by the title and menu screens.

export class Starfield {
  constructor(count = 140) {
    this.stars = [];
    this.time = 0;
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random(),
        y: Math.random(),
        layer: 1 + Math.floor(Math.random() * 3),
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  update(dt) {
    this.time += dt;
    for (const s of this.stars) {
      s.y += dt * 0.004 * s.layer;
      if (s.y > 1) { s.y -= 1; s.x = Math.random(); }
    }
  }

  render(ctx, w, h) {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#05071a');
    sky.addColorStop(0.6, '#101a4a');
    sky.addColorStop(1, '#2a1e5a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // soft light rising from the horizon
    const glow = ctx.createRadialGradient(w / 2, h * 1.05, 4, w / 2, h * 1.05, h * 0.6);
    glow.addColorStop(0, 'rgba(255, 211, 110, 0.45)');
    glow.addColorStop(1, 'rgba(255, 211, 110, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    for (const s of this.stars) {
      const tw = 0.5 + 0.5 * Math.sin(this.time * (1 + s.layer) + s.phase);
      ctx.globalAlpha = 0.25 + 0.75 * tw * (s.layer / 3);
      ctx.fillStyle = s.layer === 3 ? '#fff6d6' : '#c9d4ff';
      const size = s.layer === 3 && tw > 0.85 ? 2 : 1;
      ctx.fillRect(Math.floor(s.x * w), Math.floor(s.y * h), size, size);
    }
    ctx.globalAlpha = 1;
  }
}
