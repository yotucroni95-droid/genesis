// "Quem disse?": a famous line from the Bible and three faces. Tap who said it.
// config: { count (default 6), maxErrors (default 2), only: [character ids] }

import { h } from '../ui/dom.js';
import { shuffle, characterPicture, characterName } from './shared.js';
import { resultScreen } from './result.js';

export const LINES = [
  { who: 'adao', text: 'Esta, afinal, é osso dos meus ossos e carne da minha carne!', ref: 'Gênesis 2:23' },
  { who: 'eva', text: 'A serpente me enganou, e eu comi.', ref: 'Gênesis 3:13' },
  { who: 'serpente', text: 'Certamente não morrerão!', ref: 'Gênesis 3:4' },
  { who: 'caim', text: 'Sou eu o responsável por meu irmão?', ref: 'Gênesis 4:9' },
  { who: 'abraao', text: 'Deus mesmo há de prover o cordeiro.', ref: 'Gênesis 22:8' },
  { who: 'sara', text: 'Deus me encheu de riso, e todos os que souberem disso rirão comigo.', ref: 'Gênesis 21:6' },
  { who: 'isaque', text: 'A voz é de Jacó, mas os braços são de Esaú.', ref: 'Gênesis 27:22' },
  { who: 'rebeca', text: 'Beba, meu senhor. Vou tirar água também para os seus camelos.', ref: 'Gênesis 24:18-19' },
  { who: 'jaco', text: 'Não te deixarei ir, a não ser que me abençoes.', ref: 'Gênesis 32:26' },
  { who: 'jose', text: 'Vocês planejaram o mal contra mim, mas Deus o tornou em bem.', ref: 'Gênesis 50:20' },
  { who: 'moises', text: 'Quem sou eu para ir ao faraó?', ref: 'Êxodo 3:11' },
  { who: 'miria', text: 'Cantem ao Senhor, pois triunfou gloriosamente!', ref: 'Êxodo 15:21' },
  { who: 'josue', text: 'Eu e a minha família serviremos ao Senhor.', ref: 'Josué 24:15' },
  { who: 'gideao', text: 'Se o Senhor está conosco, por que nos aconteceu tudo isso?', ref: 'Juízes 6:13' },
  { who: 'rute', text: 'O teu povo será o meu povo, e o teu Deus será o meu Deus.', ref: 'Rute 1:16' },
  { who: 'samuel', text: 'Fala, pois o teu servo está ouvindo.', ref: '1 Samuel 3:10' },
  { who: 'davi', text: 'O Senhor é o meu pastor; de nada terei falta.', ref: 'Salmos 23:1' },
  { who: 'elias', text: 'Até quando vocês vão oscilar entre duas opiniões?', ref: '1 Reis 18:21' },
  { who: 'ester', text: 'Se eu tiver que morrer, morrerei.', ref: 'Ester 4:16' },
  { who: 'jonas', text: 'Sou hebreu, e temo o Senhor, o Deus do céu, que fez o mar e a terra.', ref: 'Jonas 1:9' },
  { who: 'maria', text: 'Sou serva do Senhor; que aconteça comigo conforme a tua palavra.', ref: 'Lucas 1:38' },
  { who: 'joao_batista', text: 'Vejam! É o Cordeiro de Deus, que tira o pecado do mundo!', ref: 'João 1:29' },
  { who: 'pedro', text: 'Tu és o Cristo, o Filho do Deus vivo.', ref: 'Mateus 16:16' },
  { who: 'zaqueu', text: 'Olha, Senhor! Estou dando a metade dos meus bens aos pobres.', ref: 'Lucas 19:8' },
  { who: 'jesus', text: 'Eu sou o caminho, a verdade e a vida.', ref: 'João 14:6' },
  { who: 'paulo', text: 'Tudo posso naquele que me fortalece.', ref: 'Filipenses 4:13' },
];

export function start(config, env) {
  const wrap = h('div', { class: 'quiz qd' });
  env.root.appendChild(wrap);
  const count = config.count || 6;
  const maxErrors = config.maxErrors ?? 2;
  const pool = config.only ? LINES.filter((l) => config.only.includes(l.who)) : LINES;
  const people = [...new Set(LINES.map((l) => l.who))];
  return new Promise((resolve) => {
    const play = () => {
      const deck = shuffle(pool).slice(0, Math.min(count, pool.length));
      let i = 0; let errors = 0; let right = 0;
      const ask = () => {
        if (i >= deck.length || errors > maxErrors) { finish(); return; }
        const line = deck[i];
        const faces = shuffle([line.who, ...shuffle(people.filter((p) => p !== line.who)).slice(0, 2)]);
        const note = h('p', { class: 'screen__note qd__note', text: ' ' });
        let locked = false;
        const buttons = faces.map((id) => h('button', { class: 'qd__face', onClick: () => {
          if (locked) return;
          locked = true;
          const ok = id === line.who;
          buttons.forEach((b, k) => { b.disabled = true; if (faces[k] === line.who) b.classList.add('is-right'); });
          if (ok) { right += 1; env.sfx && env.sfx('correct'); note.textContent = `✔ ${characterName(env.assets, line.who)} (${line.ref})`; }
          else { errors += 1; env.sfx && env.sfx('wrong'); buttons[faces.indexOf(id)].classList.add('is-wrong'); note.textContent = `Foi ${characterName(env.assets, line.who)} (${line.ref})`; }
          i += 1;
          setTimeout(ask, ok ? 1100 : 1900);
        } }, h('img', { class: 'pixel', src: characterPicture(env.assets, id), alt: '' }), h('small', { text: characterName(env.assets, id) })));
        wrap.replaceChildren(
          h('div', { class: 'quiz__count', text: `${i + 1} de ${deck.length} · erros: ${errors} de ${maxErrors}` }),
          h('h2', { class: 'quiz__q qd__line', text: `“${line.text}”` }),
          h('div', { class: 'qd__faces' }, ...buttons),
          note,
        );
      };
      const finish = () => {
        const won = errors <= maxErrors;
        resultScreen(wrap, {
          passed: won,
          big: `${right}/${deck.length}`,
          title: won ? 'Você conhece bem essas vozes!' : 'Muitas vozes trocadas',
          note: won ? 'Cada frase está na Bíblia: procure a referência e leia a história toda!' : `Você pode errar no máximo ${maxErrors}. Tente de novo!`,
          onContinue: () => resolve({ success: true, score: Math.max(60, 100 - errors * 15), correct: right }),
          onRetry: play,
        });
      };
      ask();
    };
    play();
  });
}
