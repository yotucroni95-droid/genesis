// WASD and arrow keys, for testing on a computer.

const KEYS = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

export class Keyboard {
  constructor() {
    this.down = new Set();
    this.onDown = (e) => {
      const k = KEYS[e.code];
      if (!k) return;
      this.down.add(k);
      e.preventDefault();
    };
    this.onUp = (e) => {
      const k = KEYS[e.code];
      if (k) this.down.delete(k);
    };
    this.onBlur = () => this.down.clear();
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', this.onBlur);
  }

  vector() {
    let x = 0, y = 0;
    if (this.down.has('left')) x -= 1;
    if (this.down.has('right')) x += 1;
    if (this.down.has('up')) y -= 1;
    if (this.down.has('down')) y += 1;
    const len = Math.hypot(x, y);
    return len ? { x: x / len, y: y / len } : { x: 0, y: 0 }; // same speed on diagonals
  }

  destroy() {
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
    window.removeEventListener('blur', this.onBlur);
  }
}
