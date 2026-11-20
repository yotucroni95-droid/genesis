// "Ligue os pares": tap a person, then the thing from their story.
// config: { count (pairs, default 5), maxErrors (default 3) }

import { h } from '../ui/dom.js';
import { shuffle, characterPicture, characterName } from './shared.js';
import { resultScreen } from './result.js';

export const PAIRS = [
  { who: 'noe', icon: '🚢', thing: 'A arca e o dilúvio', ref: 'Gênesis 6–8' },
  { who: 'abraao', icon: '✨', thing: 'Descendência como as estrelas', ref: 'Gênesis 15:5' },
  { who: 'jaco', icon: '🪜', thing: 'A escada até o céu', ref: 'Gênesis 28:12' },
  { who: 'jose', icon: '🧥', thing: 'A túnica colorida', ref: 'Gênesis 37:3' },
  { who: 'moises', icon: '🔥', thing: 'A sarça que não se queimava', ref: 'Êxodo 3:2' },
  { who: 'miria', icon: '🪘', thing: 'O tamborim depois do mar', ref: 'Êxodo 15:20' },
  { who: 'gideao', icon: '🐑', thing: 'A lã molhada de orvalho', ref: 'Juízes 6:37' },
  { who: 'sansao', icon: '💪', thing: 'A força ligada aos cabelos', ref: 'Juízes 16:17' },
  { who: 'rute', icon: '🌾', thing: 'Recolher espigas no campo', ref: 'Rute 2:2' },
  { who: 'davi', icon: '🪨', thing: 'A funda e as cinco pedras', ref: '1 Samuel 17:40' },
  { who: 'salomao', icon: '📜', thing: 'Pediu sabedoria a Deus', ref: '1 Reis 3:9' },
  { who: 'elias', icon: '🐦', thing: 'Corvos levando comida', ref: '1 Reis 17:6' },
  { who: 'daniel', icon: '🦁', thing: 'A cova dos leões', ref: 'Daniel 6:16' },
  { who: 'jonas', icon: '🐋', thing: 'O grande peixe', ref: 'Jonas 1:17' },
  { who: 'zaqueu', icon: '🌳', thing: 'Subiu numa figueira', ref: 'Lucas 19:4' },
  { who: 'pedro', icon: '🎣', thing: 'Pescador chamado por Jesus', ref: 'Mateus 4:18-19' },
];

export function start(config, env) {
  const wrap = h('div', { class: 'quiz pares' });
  env.root.appendChild(wrap);
  const count = config.count || 5;
  const maxErrors = config.maxErrors ?? 3;
  return new Promise((resolve) => {
    const play = () => {
      const set = shuffle(PAIRS).slice(0, count);
      let errors = 0; let done = 0; let chosen = null;
      const count$ = h('div', { class: 'quiz__count' });
      const note = h('p', { class: 'screen__note', text: 'Toque numa pessoa e depois na história dela.' });
      const paint = () => { count$.textContent = `Pares: ${done} de ${set.length} · erros: ${errors} de ${maxErrors}`; };
      const people = set.map((p) => {
        const b = h('button', { class: 'pares__who', onClick: () => {
          if (b.disabled) return;
          people.forEach((x) => x.classList.remove('is-on'));
          b.classList.add('is-on');
          chosen = { p, b };
          env.sfx && env.sfx('click');
        } }, h('img', { class: 'pixel', src: characterPicture(env.assets, p.who), alt: '' }), h('span', { text: characterName(env.assets, p.who) }));
        return b;
      });
      const things = shuffle(set).map((p) => {
        const b = h('button', { class: 'pares__thing', onClick: () => {
          if (!chosen || b.disabled) return;
          if (chosen.p === p) {
            b.disabled = true; chosen.b.disabled = true;
            b.classList.add('is-right'); chosen.b.classList.remove('is-on'); chosen.b.classList.add('is-right');
            note.textContent = `✔ ${characterName(env.assets, p.who)}: ${p.thing} (${p.ref})`;
            done += 1; chosen = null;
            env.sfx && env.sfx('correct');
            paint();
            if (done === set.length) setTimeout(() => finish(true), 800);
          } else {
            errors += 1;
            env.sfx && env.sfx('wrong');
            b.classList.remove('is-shake'); void b.offsetWidth; b.classList.add('is-shake');
            note.textContent = 'Não é dessa história. Tente outra!';
            paint();
            if (errors > maxErrors) setTimeout(() => finish(false), 500);
          }
        } }, h('span', { class: 'pares__icon', text: p.icon }), h('span', { text: p.thing }));
        return b;
      });
      wrap.replaceChildren(count$, h('div', { class: 'pares__board' }, h('div', { class: 'pares__col' }, ...people), h('div', { class: 'pares__col' }, ...things)), note);
      paint();
      const finish = (won) => {
        resultScreen(wrap, {
          passed: won,
          big: `${done}/${set.length}`,
          title: won ? 'Todas as histórias no lugar!' : 'Muitas histórias trocadas',
          note: won ? 'Escolha um desses nomes e leia a história dele hoje!' : `Você pode errar no máximo ${maxErrors}. Tente de novo!`,
          onContinue: () => resolve({ success: true, score: Math.max(60, 100 - errors * 12), correct: done }),
          onRetry: play,
        });
      };
    };
    play();
  });
}
