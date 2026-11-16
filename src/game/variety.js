// Chooses the challenge of a stop. The first time it is the one from the
// chapter file; when played again it changes (new questions, new games) and
// gets a bit harder each time. Modo Herói is always the hardest version.

import { loadExtras } from '../ui/game-ui.js';

export const NEW_GAMES = ['ordem', 'vf', 'versiculo', 'cacapalavras'];
export const TITLES = {
  quiz: 'Quiz', memory: 'Jogo da memória', tictactoe: 'Jogo da velha', puzzle: 'Quebra-cabeça',
  ordem: 'Ordem certa', vf: 'Verdadeiro ou Falso', versiculo: 'Complete o versículo', cacapalavras: 'Caça-palavras',
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export async function planChallenge(game, chapter, stop, { hero = false } = {}) {
  const save = game.save;
  const plays = (save.state.plays || {})[stop.id] || 0;
  const done = save.isStopDone(stop.id);
  const original = stop.challenge;
  if (!done && !hero) return { type: original.type, config: original.config || {} };

  const bank = ((await game.assets.loadJSON('questions.json')).chapters || {})[chapter.id] || {};
  game.extras = game.extras || await loadExtras(game.assets);
  const verses = game.extras.verses.filter((v) => (bank.verses || []).includes(v.id));
  const level = hero ? 3 : Math.min(3, plays); // 0..3: grows with each replay

  const options = ['quiz', 'vf', 'ordem', 'cacapalavras'];
  if (verses.length >= 3) options.push('versiculo');
  if (!hero) options.push(original.type, original.type); // the original game still shows up often
  else if (original.type === 'tictactoe') options.push('tictactoe');
  let type = pick(options);
  if (type === save.state.lastType && Math.random() < 0.7) type = pick(options); // avoid repeating
  save.update((s) => { s.lastType = type; });

  switch (type) {
    case 'quiz':
      return { type, config: { pool: bank.quiz || original.config.questions || [], count: hero ? 7 : 5, minScore: hero ? 5 : 3, timer: hero ? 12 : level >= 2 ? 20 : 0 } };
    case 'vf':
      return { type, config: { items: bank.vf || [], count: hero ? 8 : 6, seconds: hero ? 4 : Math.max(5, 8 - level) } };
    case 'ordem':
      return { type, config: { ...pick(bank.ordem || [{ title: 'Ordem', items: [] }]), count: hero ? 7 : 4 + Math.min(1, level) } };
    case 'cacapalavras':
      return { type, config: { words: bank.palavras || [], count: hero ? 6 : 4 + Math.min(1, level), size: hero ? 9 : 8, hard: hero || level >= 2 } };
    case 'versiculo':
      return { type, config: { verses, count: hero ? 5 : 3 } };
    case 'tictactoe':
      return { type, config: { difficulty: hero ? 0.95 : Math.min(0.9, ((original.config && original.config.difficulty) || 0.3) + 0.15 * level) } };
    default:
      return { type: original.type, config: original.config || {} };
  }
}

export function countPlay(save, stopId) {
  save.update((s) => { s.plays = { ...(s.plays || {}), [stopId]: ((s.plays || {})[stopId] || 0) + 1 }; });
}
