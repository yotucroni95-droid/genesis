// Story scene: dialog box with a typewriter effect, speaker portrait,
// the Bible reference and a "Próximo" button. Then goes to the challenge.

import { h } from '../ui/dom.js';
import { iconButton } from '../ui/icon-button.js';
import { speak, stopSpeaking, narratorOn, setNarrator, loadRecorded } from '../audio/narrator.js';
import { sfx } from '../audio/audio.js';

const CHARS_PER_SECOND = 40;

export async function findStop(game, chapterId, stopId) {
  const entry = game.assets.json('chapters/index.json').chapters.find((c) => c.id === chapterId);
  const chapter = await game.assets.loadJSON(entry.file);
  return { chapter, stop: chapter.stops.find((s) => s.id === stopId) };
}

function speakerInfo(game, id) {
  if (id === 'narrador') return { name: 'Narrador', kind: 'book' };
  if (id === 'deus') return { name: 'Deus', kind: 'light' };
  const c = game.assets.json('characters.json').characters.find((x) => x.id === id);
  return { name: c ? c.name : id, kind: 'portrait', portrait: game.assets.url(`portrait.${id}`) };
}

export function createStoryScene(game) {
  let timer = 0;
  return {
    async enter(params, ui) {
      const { chapter, stop } = await findStop(game, params.chapterId, params.stopId);
      await loadRecorded(game.assets);
      const mapUrl = game.assets.url(`map.${chapter.map}`);
      let line = 0;
      let shown = 0;
      let typing = false;

      const portrait = h('div', { class: 'talk__face' });
      const name = h('div', { class: 'talk__name' });
      const text = h('p', { class: 'talk__text' });
      const next = h('button', { class: 'btn talk__next', text: 'Próximo' });
      const counter = h('div', { class: 'talk__count' });
      const narratorBtn = h('button', { class: 'talk__voice', title: 'Narrador', onClick: (e) => {
        e.stopPropagation();
        setNarrator(!narratorOn());
        narratorBtn.textContent = narratorOn() ? '🔊 Narrador' : '🔈 Narrador desligado';
        if (narratorOn()) speak(stop.story[line].text, `${stop.id}-${line}`);
      } }, narratorOn() ? '🔊 Narrador' : '🔈 Narrador desligado');

      const render = () => {
        const l = stop.story[line];
        const sp = speakerInfo(game, l.speaker);
        name.textContent = sp.name;
        portrait.className = `talk__face talk__face--${sp.kind}`;
        portrait.replaceChildren(
          sp.kind === 'portrait' ? h('img', { class: 'pixel', src: sp.portrait, alt: '' })
            : sp.kind === 'book' ? h('img', { class: 'pixel', src: game.assets.url('icon.livro'), alt: '' })
              : h('div', { class: 'talk__light' }),
        );
        counter.textContent = `${line + 1}/${stop.story.length}`;
        next.textContent = line === stop.story.length - 1 ? 'Ao desafio!' : 'Próximo';
        if (narratorOn()) speak(l.text, `${stop.id}-${line}`);
        shown = 0;
        typing = true;
        text.textContent = '';
        clearInterval(timer);
        timer = setInterval(() => {
          shown += 1;
          text.textContent = l.text.slice(0, shown);
          if (shown % 4 === 0 && !narratorOn()) sfx('talk');
          if (shown >= l.text.length) { typing = false; clearInterval(timer); }
        }, 1000 / CHARS_PER_SECOND);
      };

      const advance = () => {
        const l = stop.story[line];
        if (typing) { // first tap: show the whole sentence
          clearInterval(timer);
          typing = false;
          text.textContent = l.text;
          return;
        }
        if (line < stop.story.length - 1) { line += 1; render(); return; }
        stopSpeaking();
        game.scenes.go('challenge', params);
      };
      next.addEventListener('click', (e) => { e.stopPropagation(); advance(); });

      const box = h('div', { class: 'talk', onClick: advance },
        portrait,
        h('div', { class: 'talk__body' },
          h('div', { class: 'talk__head' }, name, counter),
          text,
          h('div', { class: 'talk__foot' },
            narratorBtn,
            h('span', { class: 'verse' }, h('img', { class: 'pixel', src: game.assets.url('icon.livro'), alt: '' }), `Leia: ${stop.verse}`),
            next,
          ),
        ),
      );

      ui.appendChild(h('section', { class: 'story', style: { backgroundImage: `url("${mapUrl}")` } },
        h('div', { class: 'story__shade' }),
        h('header', { class: 'story__head' },
          iconButton(game.assets, 'icon.voltar', 'Voltar ao mapa', () => game.scenes.go('world', params.back), '←'),
          h('div', {},
            h('div', { class: 'story__chapter', text: `Capítulo ${chapter.number} · ${chapter.title}` }),
            h('h1', { class: 'story__title', text: stop.title }),
          ),
        ),
        box,
      ));
      render();
    },
    exit() { clearInterval(timer); stopSpeaking(); },
    render(ctx, d) { ctx.fillStyle = '#05071a'; ctx.fillRect(0, 0, d.width, d.height); },
  };
}
