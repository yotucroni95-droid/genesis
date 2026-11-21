// A pet that follows its owner: walks behind, rests when the owner stops,
// celebrates on a win. It never collides with anything (no blocking, no
// advantage). Uses the sheet `pet.<id>` (4 cols × 5 rows of 32 px: walk down,
// walk side, walk up, rest, celebrate) when the art exists; until then a
// PROVISIONAL emoji is drawn.

import { addCoins } from '../game/economy.js';

export const petState = (save) => save.state.pets || { owned: { ovelhinha: true }, on: '' };

export function equipPet(save, id) { save.update((s) => { s.pets = { ...petState(save), on: id }; }); }

/** Buys with talents or unlocks by Fuga wins. Returns an error text or ''. */
export function unlockPet(save, pet) {
  const st = petState(save);
  if (st.owned[pet.id]) return '';
  if (pet.wins) { if ((save.state.fugaWins || 0) < pet.wins) return `Vença ${pet.wins} partidas da Fuga (você tem ${save.state.fugaWins || 0}).`; }
  else if ((save.state.coins || 0) < pet.price) return `Faltam ${pet.price - (save.state.coins || 0)} talentos.`;
  if (pet.price) addCoins(save, -pet.price);
  save.update((s) => { s.pets = { ...petState(save), owned: { ...st.owned, [pet.id]: true }, on: pet.id }; });
  return '';
}

export class Pet {
  constructor(assets, def, x, y) {
    this.def = def;
    this.sheet = assets.entry(`pet.${def.id}`);
    if (this.sheet && this.sheet.lazy) assets.ensure(`pet.${def.id}`).then(() => { this.sheet = assets.entry(`pet.${def.id}`); }).catch(() => {});
    this.x = x; this.y = y; this.dir = 0; this.t = 0; this.still = 0; this.party = 0; this.moving = false;
  }

  celebrate() { this.party = 1.4; }

  /** owner: {x, y, dir} — the pet aims for a spot just behind the owner. */
  update(dt, owner) {
    const back = [[16, 2], [16, 1], [-16, 1], [-14, 10]][owner.dir || 0]; // beside and a bit behind, never hidden under the owner
    const gx = owner.x + back[0], gy = owner.y + back[1];
    const dx = gx - this.x, dy = gy - this.y, d = Math.hypot(dx, dy);
    if (d > 160) { this.x = gx; this.y = gy; } // teleported owner: don't run across the map
    this.moving = d > 6;
    if (this.moving) {
      const sp = Math.min(d, Math.max(40, d * 4) * dt);
      this.x += (dx / d) * sp; this.y += (dy / d) * sp;
      this.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0;
      this.still = 0;
    } else this.still += dt;
    this.t += dt;
    if (this.party > 0) this.party -= dt;
  }

  draw(c) {
    const hop = this.party > 0 ? -Math.abs(Math.sin(this.t * 12)) * 6 : this.moving ? -Math.abs(Math.sin(this.t * 10)) * 1.5 : 0;
    c.fillStyle = 'rgba(0,0,0,.2)';
    c.fillRect(Math.round(this.x - 4), Math.round(this.y - 1), 8, 2);
    const img = this.sheet && this.sheet.image && !this.sheet.placeholder ? this.sheet.image : null;
    if (img) {
      const f = 32, frame = Math.floor(this.t * 8) % 4;
      const row = this.party > 0 ? 4 : this.moving ? (this.dir === 3 ? 2 : this.dir === 0 ? 0 : 1) : 3;
      c.save();
      c.translate(Math.round(this.x), Math.round(this.y + hop));
      if (this.moving && this.dir === 1) c.scale(-1, 1); // the side row faces right
      const s = 22; // drawn smaller than the 32 px frame: a pet is about half the owner's height
      // a non-integer shrink of pixel art looks jagged without smoothing
      c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
      c.drawImage(img, frame * f, row * f, f, f, -s / 2, -s + 1, s, s);
      c.restore();
      return;
    }
    c.font = '13px serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = '#fff'; // emoji take the fill alpha
    c.fillText(this.def.emoji || '🐾', Math.round(this.x), Math.round(this.y + hop));
    if (this.still > 3 && this.party <= 0) { c.fillStyle = '#fff'; c.font = '6px sans-serif'; c.fillText('z', this.x + 7, this.y - 10 - (this.t % 1) * 3); }
  }
}
