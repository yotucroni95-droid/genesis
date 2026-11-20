// Every challenge has the same interface:
//   start(config, env) -> Promise<{ success: boolean, score: number }>
// env = { root: DOM element to draw in, assets, verse }
// To add a new kind of challenge, write a module and register it here.

import * as quiz from './quiz.js';
import * as memory from './memory.js';
import * as tictactoe from './tictactoe.js';
import * as puzzle from './puzzle.js';
import * as soon from './coming-soon.js';
import * as ordem from './ordem.js';
import * as vf from './vf.js';
import * as versiculo from './versiculo.js';
import * as cacapalavras from './cacapalavras.js';
import * as cesto from './cesto.js';
import * as travessia from './travessia.js';
import * as mana from './mana.js';
import * as sequencia from './sequencia.js';
import * as lacunas from './lacunas.js';
import * as santuario from './santuario.js';
import * as quemdisse from './quemdisse.js';
import * as pares from './pares.js';

const REGISTRY = { quiz, memory, tictactoe, puzzle, ordem, vf, versiculo, cacapalavras, cesto, travessia, mana, sequencia, lacunas, santuario, quemdisse, pares };

export function getChallenge(type) {
  return REGISTRY[type] || soon;
}
