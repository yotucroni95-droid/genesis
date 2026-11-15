// Walking around a chapter's map: joystick/keyboard, camera, collision,
// ambient life, glowing story stops and the "Entrar" button.

import { h } from '../ui/dom.js';
import { iconButton } from '../ui/icon-button.js';
import { toast } from '../ui/toast.js';
import { TileMap } from '../world/tilemap.js';
import { Camera } from '../world/camera.js';
import { Player } from '../world/player.js';
import { Ambient } from '../world/ambient.js';
import { Stops } from '../world/stops.js';
import { Talk } from '../world/talk.js';
import { loadRecorded, stopSpeaking } from '../audio/narrator.js';
import { Scrolls } from '../world/scrolls.js';
import { celebrate } from '../ui/celebrate.js';
import { loadExtras, ico } from '../ui/game-ui.js';
import { RARITY_LABEL } from '../game/economy.js';
import { Input } from '../input/input.js';
import { muteButton } from '../ui/mute-button.js';
import { sfx } from '../audio/audio.js';

const DEBUG = new URLSearchParams(location.search).has('debug');

export function createWorldScene(game) {
  let map = null;
  let player = null;
  let ambient = null;
  let stops = null;
  let chapter = null;
  let input = null;
  const camera = new Camera();
  let firstFrame = true;
  let charButton = null;
  let enterBox = null;
  let currentStop = null;
  let leaving = false;
  let onKey = null;
  let joyHint = null;
  let talk = null;
  let scrolls = null;
  let scrollChip = null;
  let stepT = 0;

  function refreshCharButton() {
    charButton.querySelector('img').src = game.assets.url(`portrait.${player.characterId}`);
  }

  function chooseAvatar() {
    if (leaving) return;
    leaving = true;
    game.scenes.go('avatar', { backScene: 'world', back: { chapterId: chapter && chapter.id, mapId: map && map.id, at: { x: player.x, y: player.y } } });
  }

  function enterStop() {
    if (!currentStop || leaving) return;
    leaving = true;
    sfx('enter');
    game.scenes.go('story', {
      chapterId: chapter.id,
      stopId: currentStop.id,
      back: { chapterId: chapter.id, at: { x: player.x, y: player.y } },
    });
  }

  return {
    async enter(params, ui) {
      leaving = false;
      if (params.chapterId) {
        const entry = game.assets.json('chapters/index.json').chapters.find((c) => c.id === params.chapterId);
        chapter = await game.assets.loadJSON(entry.file);
      } else {
        chapter = null;
      }
      const mapId = chapter ? chapter.map : params.mapId || 'eden';
      const json = await game.assets.loadJSON(`maps/${mapId}.json`);
      map = new TileMap(json, game.assets);
      const at = params.at || { x: (map.spawn.x + 0.5) * map.tileW, y: (map.spawn.y + 1) * map.tileH - 4 };
      player = new Player(game.assets, game.save.state.avatarId || 'peregrino', at.x, at.y);
      ambient = new Ambient(map);
      stops = chapter ? new Stops(chapter, map, game.assets, game.save) : null;
      firstFrame = true;
      if (DEBUG) window.__world = { map, player, camera, stops }; // only with ?debug=1, for testing

      charButton = h('button', { class: 'hud__char', 'aria-label': 'Trocar personagem', title: 'Trocar personagem', onClick: chooseAvatar },
        h('img', { class: 'pixel', alt: '' }));
      const title = chapter ? `Capítulo ${chapter.number} · ${chapter.title}` : map.name;
      ui.appendChild(h('div', { class: 'hud' },
        iconButton(game.assets, 'icon.voltar', 'Voltar', () => game.scenes.go('explore'), '←'),
        h('div', { class: 'hud__title', text: title }),
        muteButton(),
        charButton,
      ));
      refreshCharButton();

      enterBox = h('div', { class: 'enter', hidden: true },
        h('div', { class: 'enter__title' }),
        h('button', { class: 'btn enter__btn', onClick: enterStop },
          h('img', { class: 'pixel', src: game.assets.url('icon.entrar'), alt: '' }), 'Entrar'),
      );
      ui.appendChild(enterBox);
      talk = stops ? new Talk(ui, stops, game.save, chapter.id) : null;
      await loadRecorded(game.assets);
      if (stops) {
        game.extras = game.extras || await loadExtras(game.assets);
        scrollChip = h('div', { class: 'chip hud__scrolls', title: 'Pergaminhos escondidos' });
        ui.querySelector('.hud').insertBefore(scrollChip, ui.querySelector('.hud .mute'));
        scrolls = new Scrolls(map, chapter, player, stops, game.save, game.extras, (rarity) => {
          celebrate({ title: 'Achou os 5 pergaminhos!', subtitle: `Você ganhou um baú ${RARITY_LABEL[rarity]}. Amanhã eles estarão em outros lugares!`, image: game.assets.url('icon.album') });
        });
      }
      input = new Input(ui, game.assets);
      if (!game.save.seenTip('joystick')) {
        joyHint = h('div', { class: 'joy-hint' }, h('span', { text: 'Arraste o polegar aqui para andar' }));
        ui.appendChild(joyHint);
      }
      onKey = (e) => { if ((e.code === 'Enter' || e.code === 'Space') && currentStop) { e.preventDefault(); enterStop(); } };
      window.addEventListener('keydown', onKey);
      if (chapter && !params.at && chapter.intro) toast(chapter.intro, { ms: 5000 });
    },

    exit() {
      if (input) input.destroy();
      input = null;
      if (talk) talk.destroy();
      talk = null;
      stopSpeaking();
      window.removeEventListener('keydown', onKey);
    },

    update(dt) {
      if (!map) return;
      const vec = leaving ? { x: 0, y: 0 } : input.vector();
      player.update(dt, vec, map);
      if (player.moving) { stepT += dt; if (stepT > 0.32) { stepT = 0; sfx('step'); } }
      if (talk) talk.update(player);
      if (scrolls) {
        scrolls.update(dt, player);
        const n = scrolls.found.length;
        const txt = `${n}/5`;
        if (scrollChip.dataset.t !== txt) { scrollChip.dataset.t = txt; scrollChip.replaceChildren(ico('icon.pergaminho', '📜'), h('b', { text: txt })); }
      }
      if (joyHint && (vec.x || vec.y)) {
        joyHint.remove();
        joyHint = null;
        game.save.markTip('joystick');
      }
      ambient.update(dt);
      if (stops) {
        stops.update(dt);
        const near = stops.nearest(player.x, player.y);
        if (near !== currentStop) {
          currentStop = near;
          enterBox.hidden = !near;
          if (near) {
            const done = game.save.isStopDone(near.id);
            enterBox.querySelector('.enter__title').textContent = `${near.title}${done ? ' ✓' : ''}`;
          }
        }
      }
    },

    render(ctx, display) {
      if (!map) return;
      camera.follow(player.x, player.y - 16, map, display.width, display.height, 1 / 60, firstFrame);
      firstFrame = false;
      ctx.fillStyle = '#05071a';
      ctx.fillRect(0, 0, display.width, display.height);
      ctx.save();
      ctx.translate(-camera.ix, -camera.iy);
      const view = { x: camera.ix, y: camera.iy, w: display.width, h: display.height };
      map.drawGround(ctx, view);
      ambient.drawBelow(ctx, view);
      if (stops) stops.drawGround(ctx);
      if (scrolls) scrolls.draw(ctx);
      // characters sorted by depth, so whoever is lower on screen is in front
      const list = stops ? stops.drawables() : [];
      list.push({ y: player.y, draw: (c) => player.draw(c) });
      list.sort((a, b) => a.y - b.y).forEach((d) => d.draw(ctx));
      ambient.drawAbove(ctx, view);
      if (DEBUG) map.drawDebug(ctx);
      ctx.restore();
      if (talk) talk.place(camera, display);
    },
  };
}
