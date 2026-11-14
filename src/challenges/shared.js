// Helpers shared by the challenges.

import { h } from '../ui/dom.js';

export function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Picture for a character: its portrait, or the first frame of its sprite sheet. */
export function characterPicture(assets, ref) {
  const id = typeof ref === 'string' ? ref : ref.id || ref.sheet;
  const portrait = assets.entry(`portrait.${id}`);
  if (portrait && portrait.image) return assets.url(`portrait.${id}`);
  const sheet = assets.entry(`sheet.${(ref && ref.sheet) || id}`);
  if (sheet && sheet.image) {
    const f = sheet.frame || 32;
    const c = document.createElement('canvas');
    c.width = f;
    c.height = f;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sheet.image, ((ref && ref.variant) || 0) * f, 0, f, f, 0, 0, f, f);
    return c.toDataURL();
  }
  return '';
}

export function characterName(assets, ref) {
  if (ref && ref.label) return ref.label;
  const id = typeof ref === 'string' ? ref : ref.id || ref.sheet;
  const c = assets.json('characters.json').characters.find((x) => x.id === id);
  return c ? c.name : id;
}

/** Result panel used by the challenges: a big message and one button. */
export function resultPanel({ big, title, note, button, onClick }) {
  return h('div', { class: 'quiz__result' },
    big ? h('div', { class: 'quiz__score', text: big }) : null,
    h('h2', { class: 'quiz__q', text: title }),
    note ? h('p', { class: 'screen__note', text: note }) : null,
    h('button', { class: 'btn', text: button, onClick }),
  );
}
