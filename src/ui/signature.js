import { h } from './dom.js';

/** The small, discreet "gerado pela Órbita" signature. */
export function signature(assets) {
  return h('div', { class: 'signature' },
    h('img', { src: assets.url('logo.orbita'), alt: '' }),
    h('span', { text: 'gerado pela Órbita' }),
  );
}
