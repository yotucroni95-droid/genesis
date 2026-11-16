// "Jornada": the list of chapters. A chapter opens when the previous one is done.

import { h } from '../ui/dom.js';
import { iconButton } from '../ui/icon-button.js';
import { toast } from '../ui/toast.js';
import { Starfield } from './starfield.js';
import { loadChapter, chapterProgress, chapterDone, isChapterOpen } from '../content/progression.js';
import { eventWindow, eventProgress, shortDate } from '../game/event.js';

export function createExploreScene(game) {
  const stars = new Starfield(80);
  return {
    async enter(_p, ui) {
      const save = game.save;
      const index = game.assets.json('chapters/index.json').chapters;
      const loaded = await Promise.all(index.map((e) => loadChapter(game.assets, e)));
      const grid = h('div', { class: 'maps' });
      index.forEach((entry, i) => {
        const chapter = loaded[i];
        const waiting = Boolean(entry.waitingMap); // story written, map still being drawn
        const afterGenesis = chapter && !waiting && isChapterOpen(save, i, loaded, index);
        const win = entry.event ? eventWindow(entry) : { open: true };
        const open = afterGenesis && win.open;
        const prog = chapter ? chapterProgress(save, chapter) : { done: 0, total: 0 };
        const done = chapter && chapterDone(save, chapter);
        const mapId = chapter ? chapter.map : null;
        let status = 'Em breve';
        if (chapter && !open) status = waiting ? 'Em breve: o mapa está sendo desenhado' : 'Complete o capítulo anterior';
        const st = chapter ? chapter.stops.reduce((n, sp) => n + ((save.state.stars || {})[sp.id] || 0), 0) : 0;
        if (open) status = `${done ? 'Concluído ✓ · ' : `${prog.done}/${prog.total} paradas · `}⭐ ${st}/${prog.total * 3}`;
        if (entry.event && chapter) {
          if (!win.open) status = win.before ? `Evento: abre em ${shortDate(win.start)}` : 'Evento encerrado. Aguarde o próximo!';
          else if (!afterGenesis) status = 'Conclua Gênesis para entrar no Acampamento';
          else status = `${eventProgress(save, chapter)}/${prog.total} desafios com ⭐⭐⭐${win.end ? ` · até ${shortDate(win.end)}` : ''}`;
        }
        const card = (
          h('button', {
            class: `map-card${open ? '' : ' is-locked'}${done ? ' is-done' : ''}`,
            onClick: () => (open ? game.scenes.go('world', { chapterId: entry.id }) : toast(status)),
          },
            h('div', { class: 'map-card__img', style: mapId ? { backgroundImage: `url("${game.assets.url(`map.${mapId}`)}")` } : {} },
              open ? null : h('img', { class: 'pixel map-card__lock', src: game.assets.url('icon.cadeado'), alt: 'Bloqueado' }),
              done && chapter.medal ? h('img', { class: 'pixel map-card__medal', src: game.assets.url(`medal.${chapter.medal}`), alt: '' }) : null,
            ),
            h('div', { class: 'map-card__name' },
              h('small', { text: entry.event ? '⛺ Evento especial' : `Capítulo ${entry.number}` }),
              h('span', { text: entry.title }),
              h('em', { text: status }),
            ),
          )
        );
        if (done && !entry.event) {
          const heroStars = chapter.stops.reduce((n, sp) => n + ((save.state.stars || {})[`${sp.id}#heroi`] || 0), 0);
          const heroDone = (save.state.heroDone || {})[chapter.id];
          grid.appendChild(h('div', { class: 'map-card__wrap' }, card,
            h('button', { class: `btn btn--small map-card__hero${heroDone ? ' is-done' : ''}`, onClick: () => game.scenes.go('world', { chapterId: entry.id, hero: true }) },
              `⚔️ Modo Herói ${heroDone ? '✓' : ''} · ⭐ ${heroStars}/${chapter.stops.length * 3}`)));
        } else grid.appendChild(card);
      });
      const st = save.state;
      const totalStops = loaded.filter((c, i) => c && !index[i].waitingMap && !index[i].event).reduce((n, c) => n + c.stops.length, 0);
      const doneStops = Object.keys(st.progress).filter((id) => !id.startsWith('acamp_')).length; // the event is counted on its own card
      const medals = Object.keys(st.achievements).length;
      const chars = Object.keys(st.unlocked).length;
      const profile = h('div', { class: 'profile' },
        h('div', { class: 'profile__lvl' }, h('small', { text: 'Nível' }), h('b', { text: String(st.level) })),
        h('div', { class: 'profile__xp' },
          h('div', { class: 'profile__xpline' }, h('img', { class: 'pixel', src: game.assets.url('icon.estrela'), alt: '' }), h('span', { text: `${st.xp || 0} de experiência · ${doneStops} de ${totalStops} paradas` })),
          h('div', { class: 'bar' }, h('div', { class: 'bar__fill', style: { width: `${totalStops ? Math.round((doneStops / totalStops) * 100) : 0}%` } })),
        ),
        h('button', { class: 'profile__btn', onClick: () => game.scenes.go('album') }, h('img', { class: 'pixel', src: game.assets.url('icon.album'), alt: '' }), h('span', { text: `Álbum ${chars}` })),
        h('button', { class: 'profile__btn', onClick: () => game.scenes.go('medals') }, h('img', { class: 'pixel', src: game.assets.url('icon.medalha'), alt: '' }), h('span', { text: `Medalhas ${medals}` })),
      );
      ui.appendChild(
        h('section', { class: 'screen' },
          h('header', { class: 'screen__head' },
            iconButton(game.assets, 'icon.voltar', 'Voltar ao lobby', () => game.scenes.go('lobby'), '←'),
            h('h1', { text: 'Jornada' }),
            h('button', { class: 'player-chip', title: 'Trocar apelido', onClick: () => game.scenes.go('profile') },
              h('img', { class: 'pixel', src: game.assets.url(`portrait.${save.state.avatarId}`), alt: '' }),
              h('span', { text: `@${save.state.nick}` }),
              h('b', { class: 'player-chip__lvl', text: `Nv ${save.state.level}` }),
            ),
          ),
          h('div', { class: 'screen__body' },
            profile,
            grid,
            // the art gallery is a tool for the leader/artist: only with ?debug=1
            new URLSearchParams(location.search).has('debug')
              ? h('div', { style: { marginTop: '18px', display: 'flex', justifyContent: 'center' } },
                h('button', { class: 'btn btn--ghost', onClick: () => game.scenes.go('gallery'), text: 'Artes do jogo' }))
              : null,
          ),
        ),
      );
    },
    update(dt) { stars.update(dt); },
    render(ctx, d) { stars.render(ctx, d.width, d.height); },
  };
}
