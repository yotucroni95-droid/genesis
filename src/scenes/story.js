// Story scene: dialog box with a typewriter effect, speaker portrait,
// the Bible reference and a "Próximo" button. Then goes to the challenge.

import { h } from '../ui/dom.js';
import { iconButton } from '../ui/icon-button.js';
import { speak, stopSpeaking, narratorOn, setNarrator, loadRecorded } from '../audio/narrator.js';
import { sfx } from '../audio/audio.js';

const CHARS_PER_SECOND = 40;
// Minimum reading time per sentence, so nobody skips the Bible text in a
// hurry: about 65 ms per letter, between 2.5 and 9 seconds.
const MS_PER_CHAR = 65;
const MIN_READ = 2500;
const MAX_READ = 9000;
let lockTimer = 0;

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
      let readyAt = 0;
      let lockMs = 0;
      const reread = game.save.isStopDone(stop.id); // already read once: wait a bit less

      const portrait = h('div', { class: 'talk__face' });
      const name = h('div', { class: 'talk__name' });
      const text = h('p', { class: 'talk__text' });
      const next = h('button', { class: 'btn talk__next', text: 'Próximo' });
      const counter = h('div', { class: 'talk__count' });
      const hint = h('small', { class: 'talk__hint', hidden: true, text: 'Leia com calma 🙂' });
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
        lockMs = Math.min(MAX_READ, Math.max(MIN_READ, l.text.length * MS_PER_CHAR)) * (reread ? 0.5 : 1);
        readyAt = performance.now() + lockMs;
        next.classList.add('is-locked');
        clearInterval(lockTimer);
        lockTimer = setInterval(() => {
          const left = readyAt - performance.now();
          next.style.setProperty('--p', `${Math.min(100, Math.round((1 - left / lockMs) * 100))}%`);
          if (left <= 0) { clearInterval(lockTimer); next.classList.remove('is-locked'); }
        }, 80);
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
        if (performance.now() < readyAt) { // still reading time: gentle reminder
          next.classList.remove('is-nudge');
          void next.offsetWidth;
          next.classList.add('is-nudge');
          hint.hidden = false;
          return;
        }
        hint.hidden = true;
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
            hint,
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
            h('div', { class: 'story__chapter', text: chapter.event ? `⛺ ${chapter.title}` : `Capítulo ${chapter.number} · ${chapter.title}` }),
            h('h1', { class: 'story__title', text: stop.title }),
          ),
        ),
        box,
      ));
      render();
    },
    exit() { clearInterval(timer); clearInterval(lockTimer); stopSpeaking(); },
    render(ctx, d) { ctx.fillStyle = '#05071a'; ctx.fillRect(0, 0, d.width, d.height); },
  };
}
