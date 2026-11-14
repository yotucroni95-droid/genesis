// Virtual joystick for touch screens (pointer events).
// It rests at the bottom left; a touch anywhere on the left half of the
// lower screen moves it under the thumb, so it is always comfortable.

import { h } from '../ui/dom.js';

export class Joystick {
  constructor(parent, assets, { radius = 46, deadZone = 0.18 } = {}) {
    this.radius = radius;
    this.deadZone = deadZone;
    this.pointerId = null;
    this.value = { x: 0, y: 0 };
    this.center = { x: 0, y: 0 };

    const baseImg = assets.entry('ui.joystick_base');
    const knobImg = assets.entry('ui.joystick_knob');
    this.knob = h('img', { class: 'joy__knob pixel', src: knobImg ? assets.url('ui.joystick_knob') : '', alt: '' });
    this.base = h('div', { class: 'joy__base' },
      baseImg ? h('img', { class: 'pixel', src: assets.url('ui.joystick_base'), alt: '' }) : null,
      this.knob);
    this.zone = h('div', { class: 'joy__zone', 'aria-hidden': 'true' });
    this.el = h('div', { class: 'joy' }, this.zone, this.base);
    parent.appendChild(this.el);

    this.onDown = this.onDown.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onUp = this.onUp.bind(this);
    this.zone.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove, { passive: false });
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
  }

  onDown(e) {
    if (this.pointerId !== null) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    const zr = this.zone.getBoundingClientRect();
    // centre the base exactly under the thumb; only keep it from leaving the screen
    const r = this.radius + 14;
    const cx = Math.min(window.innerWidth - r, Math.max(zr.left + r, e.clientX));
    const cy = Math.min(zr.bottom - r, Math.max(r, e.clientY));
    this.center = { x: cx, y: cy };
    // The base is positioned inside the whole joystick layer, not the touch zone.
    const er = this.el.getBoundingClientRect();
    this.base.style.left = `${cx - er.left}px`;
    this.base.style.top = `${cy - er.top}px`;
    this.base.style.bottom = 'auto';
    this.el.classList.add('is-active');
    this.update(e.clientX, e.clientY);
  }

  onMove(e) {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    this.update(e.clientX, e.clientY);
  }

  onUp(e) {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.value = { x: 0, y: 0 };
    this.knob.style.transform = 'translate(-50%, -50%)';
    this.base.style.left = '';
    this.base.style.top = '';
    this.base.style.bottom = '';
    this.el.classList.remove('is-active');
  }

  update(px, py) {
    const dx = px - this.center.x;
    const dy = py - this.center.y;
    const len = Math.hypot(dx, dy);
    const clamped = Math.min(len, this.radius);
    const ux = len ? dx / len : 0;
    const uy = len ? dy / len : 0;
    this.knob.style.transform = `translate(calc(-50% + ${ux * clamped}px), calc(-50% + ${uy * clamped}px))`;
    const n = clamped / this.radius;
    if (n < this.deadZone) { this.value = { x: 0, y: 0 }; return; }
    const strength = (n - this.deadZone) / (1 - this.deadZone); // analog, max length 1
    this.value = { x: ux * strength, y: uy * strength };
  }

  vector() {
    return this.value;
  }

  destroy() {
    this.zone.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    this.el.remove();
  }
}
