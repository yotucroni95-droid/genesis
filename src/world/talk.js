// Characters on the map talk when the player comes close. Tempters (Lúcifer,
// fallen angels, the serpent, angry Cain) try to convince you, and a
// "Resistir" button lets you answer with God's word.

import { h } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { sfx } from '../audio/audio.js';
import { addCoins, track } from '../game/economy.js';

const NEAR = 64;   // starts talking
const FAR = 84;    // stops talking

export class Talk {
  constructor(ui, stops, save, chapterId) {
    this.save = save;
    this.chapterId = chapterId;
    this.npcs = stops.npcs.filter((n) => n.talk && n.talk.length);
    this.active = null;
    this.turn = {};
    this.text = h('p', { class: 'talkb__text' });
    this.resistBtn = h('button', { class: 'btn btn--small talkb__resist', text: '🛡️ Resistir', onClick: (e) => { e.stopPropagation(); this.resist(); } });
    this.el = h('div', { class: 'talkb', hidden: true }, this.text, this.resistBtn);
    ui.appendChild(this.el);
  }

  key(n) { return `${this.chapterId}:${n.sheet.id}:${n.x},${n.y}`; }

  update(player) {
    let best = null;
    let bestD = NEAR;
    for (const n of this.npcs) {
      const d = Math.hypot(n.px - player.x, n.py - player.y);
      if (n === this.active ? d < FAR : d < bestD) { best = n; bestD = d; }
    }
    if (best !== this.active) {
      this.active = best;
      if (best) {
        const k = this.key(best);
        const i = this.turn[k] || 0;
        this.turn[k] = i + 1;
        this.type(best.talk[i % best.talk.length]);
        this.el.classList.toggle('is-tempter', Boolean(best.tempter));
        this.resistBtn.hidden = !best.tempter;
        this.el.hidden = false;
      } else {
        this.el.hidden = true;
        clearInterval(this.timer);
      }
    }
  }

  type(line) {
    clearInterval(this.timer);
    let n = 0;
    this.text.textContent = '';
    this.timer = setInterval(() => {
      n += 1;
      this.text.textContent = line.slice(0, n);
      if (n % 3 === 0) sfx('talk');
      if (n >= line.length) clearInterval(this.timer);
    }, 28);
  }

  resist() {
    const n = this.active;
    if (!n || !n.tempter) return;
    sfx('resist');
    const today = new Date().toLocaleDateString('sv-SE');
    const k = `${today}|${this.key(n)}`;
    const first = !(this.save.state.resisted || {})[k];
    if (first) {
      this.save.update((s) => { s.resisted = { ...(s.resisted || {}), [k]: true }; });
      addCoins(this.save, 10);
      track(this.save, 'resist', 1);
    }
    clearInterval(this.timer);
    this.text.textContent = `"${n.resist.text}" (${n.resist.verse})`;
    this.resistBtn.hidden = true;
    toast(`🛡️ Você resistiu à tentação!${first ? ' +10 talentos' : ''}`, { ms: 2500 });
  }

  /** Keeps the bubble above the character's head. */
  place(cam, display) {
    if (!this.active || this.el.hidden) return;
    const k = display.scale / display.dpr;
    const f = (this.active.sheet && this.active.sheet.frame) || 32;
    const x = (this.active.px - cam.ix) * k;
    const y = (this.active.py - f - cam.iy) * k;
    // keep the whole bubble on screen
    const bw = this.el.offsetWidth;
    const bh = this.el.offsetHeight;
    const W = display.canvas.clientWidth;
    const H = display.canvas.clientHeight;
    const cx = Math.min(W - bw / 2 - 8, Math.max(bw / 2 + 8, x));
    let top = y;
    let below = false;
    if (top - bh < 56) { top = (this.active.py - cam.iy) * k + bh + 12; below = true; }
    top = Math.min(H - 8, top);
    this.el.style.left = `${Math.round(cx)}px`;
    this.el.style.top = `${Math.round(top)}px`;
    this.el.classList.toggle('is-below', below);
  }

  destroy() { clearInterval(this.timer); this.el.remove(); }
}
