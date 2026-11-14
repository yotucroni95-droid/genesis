// Combines the on-screen joystick and the keyboard into one direction vector.

import { Keyboard } from './keyboard.js';
import { Joystick } from './joystick.js';

export class Input {
  constructor(uiParent, assets) {
    this.keyboard = new Keyboard();
    this.joystick = new Joystick(uiParent, assets);
  }

  vector() {
    const j = this.joystick.vector();
    if (j.x || j.y) return j;
    return this.keyboard.vector();
  }

  destroy() {
    this.keyboard.destroy();
    this.joystick.destroy();
  }
}
