// Every challenge has the same interface:
//   start(config, env) -> Promise<{ success: boolean, score: number }>
// env = { root: DOM element to draw in, assets, verse }
// To add a new kind of challenge, write a module and register it here.

import * as quiz from './quiz.js';
import * as memory from './memory.js';
import * as tictactoe from './tictactoe.js';
import * as puzzle from './puzzle.js';
import * as soon from './coming-soon.js';

const REGISTRY = { quiz, memory, tictactoe, puzzle };

export function getChallenge(type) {
  return REGISTRY[type] || soon;
}
