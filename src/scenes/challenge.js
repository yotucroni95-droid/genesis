// Runs the stop's challenge, saves the result and celebrates the rewards.

import { h } from '../ui/dom.js';
import { iconButton } from '../ui/icon-button.js';
import { getChallenge } from '../challenges/index.js';
import { completeStop } from '../content/progression.js';
import { findStop } from './story.js';
import { Starfield } from './starfield.js';

const TITLES = { quiz: 'Quiz', memory: 'Jogo da memória', tictactoe: 'Jogo da velha', puzzle: 'Quebra-cabeça' };

export function createChallengeScene(game) {
  const stars = new Starfield(70);
  return {
    async enter(params, ui) {
      const { chapter, stop } = await findStop(game, params.chapterId, params.stopId);
      const back = () => game.scenes.go('world', params.back);
      const area = h('div', { class: 'challenge__area' });
      ui.appendChild(h('section', { class: 'screen challenge' },
        h('header', { class: 'screen__head' },
          iconButton(game.assets, 'icon.voltar', 'Voltar ao mapa', back, '←'),
          h('h1', { text: `${TITLES[stop.challenge.type] || 'Desafio'} · ${stop.title}` }),
        ),
        h('div', { class: 'screen__body' }, area),
      ));

      // Do not wait here: the scene must finish entering so buttons (like
      // "Voltar") keep working while the challenge is being played.
      getChallenge(stop.challenge.type)
        .start(stop.challenge.config || {}, { root: area, assets: game.assets, verse: stop.verse })
        .then((result) => this.finish(result, { chapter, stop, area, back }));
    },

    finish(result, { chapter, stop, area, back }) {
      if (game.scenes.currentName !== 'challenge') return; // player already left
      if (!result.success) { back(); return; }

      const wasDone = game.save.isStopDone(stop.id);
      const events = completeStop(game.save, chapter, stop, result.score);
      if (!wasDone && stop.rewards && stop.rewards.xp) game.save.addXp(stop.rewards.xp);
      const names = Object.fromEntries(game.assets.json('characters.json').characters.map((c) => [c.id, c.name]));
      const medalName = (id) => (game.assets.entry(`medal.${id}`) || {}).label || id;

      const items = [];
      if (!wasDone && stop.rewards && stop.rewards.xp) {
        items.push(h('div', { class: 'reward' }, h('img', { class: 'pixel', src: game.assets.url('icon.estrela'), alt: '' }), h('span', { text: `+${stop.rewards.xp} de experiência` })));
      }
      for (const e of events) {
        if (e.type === 'medal') items.push(h('div', { class: 'reward reward--big' }, h('img', { class: 'pixel', src: game.assets.url(`medal.${e.id}`), alt: '' }), h('span', { text: `Nova medalha: ${medalName(e.id)}` })));
        if (e.type === 'unlock') items.push(h('div', { class: 'reward reward--big' }, h('img', { class: 'pixel reward__face', src: game.assets.url(`portrait.${e.id}`), alt: '' }), h('span', { text: `Personagem liberado: ${names[e.id] || e.id}` })));
        if (e.type === 'level') items.push(h('div', { class: 'reward' }, h('img', { class: 'pixel', src: game.assets.url('icon.trofeu'), alt: '' }), h('span', { text: `Você subiu para o nível ${e.level}!` })));
      }
      const chapterDone = events.some((e) => e.type === 'chapter');
      area.replaceChildren(h('div', { class: 'quiz__result' },
        h('h2', { class: 'quiz__q', text: chapterDone ? `Capítulo ${chapter.number} concluído!` : wasDone ? 'Você jogou de novo!' : 'Parada concluída!' }),
        h('p', { class: 'screen__note', text: `Não esqueça de ler ${stop.verse} na sua Bíblia.` }),
        h('div', { class: 'rewards' }, ...items),
        h('button', { class: 'btn', text: chapterDone ? 'Ver capítulos' : 'Voltar ao mapa', onClick: () => (chapterDone ? game.scenes.go('explore') : back()) }),
      ));
    },
    update(dt) { stars.update(dt); },
    render(ctx, d) { stars.render(ctx, d.width, d.height); },
  };
}
