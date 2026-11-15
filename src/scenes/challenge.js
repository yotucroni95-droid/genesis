// Runs the stop's challenge, saves the result and celebrates the rewards.

import { h } from '../ui/dom.js';
import { iconButton } from '../ui/icon-button.js';
import { getChallenge } from '../challenges/index.js';
import { completeStop } from '../content/progression.js';
import { findStop } from './story.js';
import { Starfield } from './starfield.js';
import { rewardStop, rewardChapter, RARITY_LABEL } from '../game/economy.js';
import { vibrate, rankBadge } from '../ui/game-ui.js';
import { celebrate } from '../ui/celebrate.js';
import { sfx } from '../audio/audio.js';

const TITLES = { quiz: 'Quiz', memory: 'Jogo da memória', tictactoe: 'Jogo da velha', puzzle: 'Quebra-cabeça' };

export function createChallengeScene(game) {
  const stars = new Starfield(70);
  return {
    async enter(params, ui) {
      this.params = params;
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
        .start(stop.challenge.config || {}, { root: area, assets: game.assets, verse: stop.verse, sfx })
        .then((result) => this.finish(result, { chapter, stop, area, back }));
    },

    finish(result, { chapter, stop, area, back }) {
      if (game.scenes.currentName !== 'challenge') return; // player already left
      if (!result.success) { back(); return; }

      const wasDone = game.save.isStopDone(stop.id);
      const events = completeStop(game.save, chapter, stop, result.score);
      const loot = rewardStop(game.save, chapter, stop, result, !wasDone);
      const chapterBox = events.some((e) => e.type === 'chapter') ? rewardChapter(game.save, chapter) : null;
      const starInfo = loot.find((x) => x.type === 'stars');
      vibrate(starInfo.stars === 3 ? [60, 40, 60, 40, 120] : 80);
      [0, 1, 2].slice(0, starInfo.stars).forEach((k) => setTimeout(() => sfx('star'), 300 + k * 250));
      setTimeout(() => sfx('coin'), 1100);
      const names0 = Object.fromEntries(game.assets.json('characters.json').characters.map((c) => [c.id, c.name]));
      setTimeout(() => {
        for (const e of events) {
          if (e.type === 'unlock') celebrate({ title: 'Personagem liberado!', subtitle: `${names0[e.id] || e.id} agora está no seu álbum. Jogue com ele!`, image: game.assets.url(`portrait.${e.id}`) });
          if (e.type === 'chapter') celebrate({ title: `Capítulo ${chapter.number} concluído!`, subtitle: chapter.title, image: game.assets.url(`medal.${chapter.medal}`) });
        }
        for (const x of loot) if (x.type === 'rank') celebrate({ title: 'Nova patente!', subtitle: `Você chegou a ${x.rank.name} e ganhou um baú!`, badge: rankBadge(x.rank.min, { big: true }) });
      }, 1600);
      if (!wasDone && stop.rewards && stop.rewards.xp) game.save.addXp(stop.rewards.xp);
      const names = Object.fromEntries(game.assets.json('characters.json').characters.map((c) => [c.id, c.name]));
      const medalName = (id) => (game.assets.entry(`medal.${id}`) || {}).label || id;

      const items = [];
      for (const x of loot) {
        if (x.type === 'coins') items.push(h('div', { class: 'reward' }, h('span', { class: 'chip__emoji', text: '🪙' }), h('span', { text: `+${x.amount} talentos` })));
        if (x.type === 'trophies') items.push(h('div', { class: 'reward' }, h('span', { class: 'chip__emoji', text: '🏆' }), h('span', { text: `+${x.amount} troféus` })));
        if (x.type === 'rank') items.push(h('div', { class: 'reward reward--big' }, h('span', { class: 'chip__emoji', text: '⬆️' }), h('span', { text: `Nova patente: ${x.rank.name}! Ganhou um baú.` })));
      }
      if (chapterBox) items.push(h('div', { class: 'reward reward--big' }, h('span', { class: 'chip__emoji', text: '🎁' }), h('span', { text: `Baú ${RARITY_LABEL[chapterBox]} pelo capítulo! Abra no lobby.` })));
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
        h('div', { class: 'stars' }, ...[1, 2, 3].map((n) => h('span', { class: `stars__s${n <= starInfo.stars ? ' is-on' : ''}`, style: { animationDelay: `${n * 0.25}s` }, text: '★' }))),
        starInfo.stars < 3 ? h('small', { class: 'screen__note', text: 'Jogue de novo para tentar 3 estrelas!' }) : null,
        h('h2', { class: 'quiz__q', text: chapterDone ? `Capítulo ${chapter.number} concluído!` : wasDone ? 'Você jogou de novo!' : 'Parada concluída!' }),
        h('p', { class: 'screen__note', text: `Não esqueça de ler ${stop.verse} na sua Bíblia.` }),
        h('div', { class: 'rewards' }, ...items),
        h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' } },
          h('button', { class: 'btn', text: chapterDone ? 'Ver capítulos' : 'Voltar ao mapa', onClick: () => (chapterDone ? game.scenes.go('explore') : back()) }),
          starInfo.stars < 3 ? h('button', { class: 'btn btn--ghost', text: 'Tentar de novo', onClick: () => game.scenes.go('challenge', this.params) }) : null,
        ),
      ));
    },
    update(dt) { stars.update(dt); },
    render(ctx, d) { stars.render(ctx, d.width, d.height); },
  };
}
