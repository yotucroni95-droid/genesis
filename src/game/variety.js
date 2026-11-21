// Chooses the challenge of a stop. The first time it is the one from the
// chapter file; when played again it changes (new questions, new games) and
// gets a bit harder each time. Modo Herói is always the hardest version.

import { loadExtras } from '../ui/game-ui.js';

export const NEW_GAMES = ['ordem', 'vf', 'versiculo', 'cacapalavras', 'cesto', 'travessia', 'mana', 'sequencia', 'lacunas', 'santuario', 'quemdisse', 'pares'];
export const TITLES = {
  quiz: 'Quiz', memory: 'Jogo da memória', tictactoe: 'Jogo da velha', puzzle: 'Quebra-cabeça',
  ordem: 'Ordem certa', vf: 'Verdadeiro ou Falso', versiculo: 'Complete o versículo', cacapalavras: 'Caça-palavras',
  cesto: 'O cesto no Nilo', travessia: 'A travessia', mana: 'Pão do céu', sequencia: 'Siga a sequência', lacunas: 'Complete as palavras', santuario: 'Monte o santuário', quemdisse: 'Quem disse?', pares: 'Ligue os pares',
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export async function planChallenge(game, chapter, stop, { hero = false } = {}) {
  const save = game.save;
  const plays = (save.state.plays || {})[stop.id] || 0;
  const done = save.isStopDone(stop.id);
  const original = stop.challenge;
  // events always keep their own hard challenge (questions are drawn from a bank)
  if (chapter.event) return { type: original.type, config: original.config || {} };
  if (!done && !hero) return { type: original.type, config: original.config || {} };

  const bank = ((await game.assets.loadJSON('questions.json')).chapters || {})[chapter.id] || {};
  game.extras = game.extras || await loadExtras(game.assets);
  const verses = game.extras.verses.filter((v) => (bank.verses || []).includes(v.id));
  const level = hero ? 3 : Math.min(3, plays); // 0..3: grows with each replay

  const options = ['quiz', 'vf', 'ordem', 'cacapalavras', 'quemdisse', 'pares'];
  if (verses.length >= 3) options.push('versiculo');
  if (!hero) options.push(original.type, original.type); // the original game still shows up often
  else if (original.type === 'tictactoe') options.push('tictactoe');
  let type = pick(options);
  if (type === save.state.lastType && Math.random() < 0.7) type = pick(options); // avoid repeating
  save.update((s) => { s.lastType = type; });

  switch (type) {
    case 'quiz':
      return { type, config: { pool: bank.quiz || original.config.questions || [], count: hero ? 7 : 5, minScore: hero ? 5 : 3, timer: hero ? 16 : level >= 2 ? 25 : 0 } };
    case 'vf':
      return { type, config: { items: bank.vf || [], count: hero ? 8 : 6, seconds: hero ? 7 : Math.max(8, 11 - level) } };
    case 'ordem':
      return { type, config: { ...pick(bank.ordem || [{ title: 'Ordem', items: [] }]), count: hero ? 7 : 4 + Math.min(1, level) } };
    case 'cacapalavras':
      return { type, config: { words: bank.palavras || [], count: hero ? 6 : 4 + Math.min(1, level), size: hero ? 9 : 8, hard: hero || level >= 2 } };
    case 'quemdisse':
      return { type, config: { count: hero ? 8 : 5 + Math.min(1, level), maxErrors: hero ? 1 : 2 } };
    case 'pares':
      return { type, config: { count: hero ? 6 : 4 + Math.min(1, level), maxErrors: hero ? 1 : 3 } };
    case 'versiculo':
      return { type, config: { verses, count: hero ? 5 : 3 } };
    case 'tictactoe':
      return { type, config: { difficulty: hero ? 0.8 : Math.min(0.6, ((original.config && original.config.difficulty) || 0.3) + 0.1 * level) } };
    default: // the action games keep their own setup; Modo Herói makes them harder
      return { type: original.type, config: { ...(original.config || {}), hard: hero || level >= 2 } };
  }
}

export function countPlay(save, stopId) {
  save.update((s) => { s.plays = { ...(s.plays || {}), [stopId]: ((s.plays || {})[stopId] || 0) + 1 }; });
}
