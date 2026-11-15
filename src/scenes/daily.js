// Versículo do dia: read it in your Bible, answer a quick fill-in question,
// win talentos and the card for your collection. Once per day.

import { h } from '../ui/dom.js';
import { gameScreen } from '../ui/screen.js';
import { loadExtras } from '../ui/game-ui.js';
import { addCoins } from '../game/economy.js';
import { shuffle } from '../challenges/shared.js';
import { sfx } from '../audio/audio.js';
import { speak } from '../audio/narrator.js';
import { RARITY_LABEL, RARITY_COLOR } from '../game/economy.js';
import { Starfield } from './starfield.js';

export function todayVerse(extras) {
  const d = new Date();
  const n = Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 864e5);
  return extras.verses[n % extras.verses.length];
}

export function dailyDone(save) {
  return (save.state.dailyVerse || '') === new Date().toLocaleDateString('sv-SE');
}

const STOP = new Set(['para', 'como', 'todo', 'toda', 'todas', 'todos', 'mais', 'você', 'vocês', 'seus', 'suas', 'nele', 'dele', 'dela', 'pela', 'pelo', 'onde', 'quem', 'mesmo', 'nunca', 'cada', 'está', 'estou', 'foram', 'deus', 'senhor']);

function blankWord(text) {
  const words = text.replace(/[.,;:!?"“”]/g, '').split(/\s+/).filter((w) => w.length > 4 && !STOP.has(w.toLowerCase()));
  return words.sort((a, b) => b.length - a.length)[0] || text.split(' ')[0];
}

export function createDailyScene(game) {
  const stars = new Starfield(100);
  return {
    async enter(_p, ui) {
      game.extras = game.extras || await loadExtras(game.assets);
      const save = game.save;
      const v = todayVerse(game.extras);
      const area = h('div', { class: 'daily' });
      ui.appendChild(gameScreen(game, 'Versículo do dia 📖', area));
      const card = h('div', { class: 'verse-card daily__card', style: { '--r': RARITY_COLOR[v.rarity] } },
        h('small', { class: 'verse-card__rarity', text: RARITY_LABEL[v.rarity] }),
        h('p', { class: 'verse-card__text', text: v.text }),
        h('b', { class: 'verse-card__ref', text: v.ref }),
      );
      if (dailyDone(save)) {
        area.replaceChildren(card, h('p', { class: 'screen__note', text: 'Você já fez o versículo de hoje. Volte amanhã para um novo!' }),
          h('button', { class: 'btn btn--ghost', text: '🔊 Ouvir', onClick: () => speak(`${v.text} ${v.ref}`) }));
        return;
      }
      const ask = () => {
        const answer = blankWord(v.text);
        const others = shuffle(game.extras.verses.filter((x) => x.id !== v.id).map((x) => blankWord(x.text)).filter((w) => w.toLowerCase() !== answer.toLowerCase())).slice(0, 2);
        const opts = shuffle([answer, ...others]);
        const masked = v.text.replace(answer, '_____');
        area.replaceChildren(
          h('div', { class: 'verse-card daily__card', style: { '--r': RARITY_COLOR[v.rarity] } }, h('p', { class: 'verse-card__text', text: masked }), h('b', { class: 'verse-card__ref', text: v.ref })),
          h('h2', { class: 'quiz__q', text: 'Qual palavra completa o versículo?' }),
          h('div', { class: 'quiz__opts' }, ...opts.map((o) => h('button', { class: 'quiz__opt', onClick: (e) => {
            if (o === answer) {
              sfx('correct');
              e.currentTarget.classList.add('is-right');
              save.update((s) => { s.dailyVerse = new Date().toLocaleDateString('sv-SE'); s.verses[v.id] = (s.verses[v.id] || 0) + 1; });
              addCoins(save, 25);
              setTimeout(() => { sfx('coin'); area.replaceChildren(card, h('h2', { class: 'quiz__q', text: 'Muito bem! +25 talentos 🪙' }), h('p', { class: 'screen__note', text: 'A carta deste versículo entrou na sua coleção.' }), h('button', { class: 'btn', text: 'Voltar ao lobby', onClick: () => game.scenes.go('lobby') })); }, 600);
            } else {
              sfx('wrong');
              e.currentTarget.classList.add('is-wrong');
              e.currentTarget.disabled = true;
            }
          } }, o))),
        );
      };
      const readBtn = h('button', { class: 'btn', disabled: true, text: '📖 Li na minha Bíblia (10)', onClick: ask });
      let secs = 10;
      const t = setInterval(() => {
        secs -= 1;
        readBtn.textContent = secs > 0 ? `📖 Li na minha Bíblia (${secs})` : '📖 Li na minha Bíblia';
        if (secs <= 0) { readBtn.disabled = false; clearInterval(t); }
      }, 1000);
      area.replaceChildren(card,
        h('p', { class: 'screen__note', text: `Abra a sua Bíblia em ${v.ref} e leia o versículo. Depois responda uma perguntinha para ganhar talentos!` }),
        h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' } },
          h('button', { class: 'btn btn--ghost', text: '🔊 Ouvir', onClick: () => speak(`${v.text} ${v.ref}`) }),
          readBtn,
        ),
      );
    },
    update(dt) { stars.update(dt); },
    render(ctx, d) { stars.render(ctx, d.width, d.height); },
  };
}
