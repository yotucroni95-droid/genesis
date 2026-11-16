import { moveBox } from './collision.js';

const DIR = { down: 0, left: 1, right: 2, up: 3 };

/** The walking character. (x, y) is the point between the feet. */
export class Player {
  constructor(assets, characterId, x, y) {
    this.assets = assets;
    this.x = x;
    this.y = y;
    this.speed = 78; // pixels per second (~2.4 tiles)
    this.dir = DIR.down;
    this.moving = false;
    this.animTime = 0;
    this.box = { w: 14, h: 8 }; // feet hitbox (small, so narrow roads are easy)
    this.setCharacter(characterId);
  }

  setCharacter(id) {
    this.characterId = id;
    this.sheet = this.assets.entry(`sheet.${id}`);
    const anim = (this.sheet && this.sheet.anim) || {};
    this.walk = anim.walk || [0, 1, 2, 1];
    this.idle = anim.idle || [1];
  }

  update(dt, vec, map) {
    const mag = Math.hypot(vec.x, vec.y);
    this.moving = mag > 0.01;
    if (!this.moving) { this.animTime = 0; return; }
    if (Math.abs(vec.x) > Math.abs(vec.y)) this.dir = vec.x < 0 ? DIR.left : DIR.right;
    else this.dir = vec.y < 0 ? DIR.up : DIR.down;
    const dx = vec.x * this.speed * dt;
    const dy = vec.y * this.speed * dt;
    const box = { x: this.x - this.box.w / 2, y: this.y - this.box.h, w: this.box.w, h: this.box.h };
    const moved = moveBox(map, box, dx, dy);
    this.x = moved.x + this.box.w / 2;
    this.y = moved.y + this.box.h;
    this.animTime += dt * (0.5 + mag);
  }

  draw(ctx) {
    const sheet = this.sheet;
    if (!sheet || !sheet.image) return;
    const frames = this.moving ? this.walk : this.idle;
    const frame = frames[Math.floor(this.animTime * 8) % frames.length];
    const f = sheet.frame || 32;
    const row = Math.min(this.dir, (sheet.rows || 4) - 1);
    // soft shadow so the character sits on the ground
    const sw = Math.round(f * 0.4);
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.fillRect(Math.round(this.x - sw / 2), Math.round(this.y - 2), sw, 3);
    ctx.drawImage(sheet.image, frame * f, row * f, f, f, Math.round(this.x - f / 2), Math.round(this.y - f + 1), f, f);
  }
}
