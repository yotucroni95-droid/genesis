// Walking around a chapter's map: joystick/keyboard, camera, collision,
// ambient life, glowing story stops and the "Entrar" button.

import { h } from '../ui/dom.js';
import { nearestFree } from '../world/collision.js';
import { iconButton } from '../ui/icon-button.js';
import { toast } from '../ui/toast.js';
import { TileMap } from '../world/tilemap.js';
import { Camera } from '../world/camera.js';
import { Player } from '../world/player.js';
import { Ambient } from '../world/ambient.js';
import { Stops } from '../world/stops.js';
import { stopVisible, eventProgress } from '../game/event.js';
import { Talk } from '../world/talk.js';
import { loadRecorded, stopSpeaking } from '../audio/narrator.js';
import { Scrolls } from '../world/scrolls.js';
import { celebrate } from '../ui/celebrate.js';
import { loadExtras, ico } from '../ui/game-ui.js';
import { RARITY_LABEL } from '../game/economy.js';
import { Input } from '../input/input.js';
import { muteButton } from '../ui/mute-button.js';
import { sfx } from '../audio/audio.js';
import { Pet, petState } from '../world/pet.js';

const DEBUG = new URLSearchParams(location.search).has('debug');

export function createWorldScene(game) {
  let map = null;
  let player = null;
  let pet = null;
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
  let hero = false;
  let trailColor = '';
  const trail = []; // sparkles left behind by the player's equipped trail

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
    if (hero) { // heroes already know the story: straight to the hard challenge
      game.scenes.go('challenge', { chapterId: chapter.id, stopId: currentStop.id, hero: true, back: { chapterId: chapter.id, hero: true, at: { x: player.x, y: player.y } } });
      return;
    }
    game.scenes.go('story', {
      chapterId: chapter.id,
      stopId: currentStop.id,
      back: { chapterId: chapter.id, at: { x: player.x, y: player.y } },
    });
  }

  return {
    async enter(params, ui) {
      leaving = false;
      hero = Boolean(params.hero);
      map = null; // nothing moves or draws until everything below is ready
      input = null;
      if (params.chapterId) {
        const entry = game.assets.json('chapters/index.json').chapters.find((c) => c.id === params.chapterId);
        chapter = await game.assets.loadJSON(entry.file);
      } else {
        chapter = null;
      }
      const mapId = chapter ? chapter.map : params.mapId || 'eden';
      const json = await game.assets.loadJSON(`maps/${mapId}.json`);
      if (json.genesis && json.genesis.background) await game.assets.ensure(json.genesis.background);
      map = new TileMap(json, game.assets);
      let at = params.at || { x: (map.spawn.x + 0.5) * map.tileW, y: (map.spawn.y + 1) * map.tileH - 4 };
      // never start stuck: if this spot is blocked (an old save, a changed map), step onto the path
      at = nearestFree(map, at.x, at.y) || nearestFree(map, (map.spawn.x + 0.5) * map.tileW, (map.spawn.y + 1) * map.tileH - 4) || at;
      player = new Player(game.assets, game.save.state.avatarId || 'peregrino', at.x, at.y);
      ambient = new Ambient(map);
      const petId = petState(game.save).on;
      const petDef = petId && (await game.assets.loadJSON('pets.json')).pets.find((p) => p.id === petId);
      pet = petDef ? new Pet(game.assets, petDef, player.x, player.y) : null;
      stops = chapter ? new Stops(chapter, map, game.assets, game.save, { hero, visible: (id) => stopVisible(game.save, chapter, id) }) : null;
      firstFrame = true;
      if (DEBUG) window.__world = { map, player, camera, stops }; // only with ?debug=1, for testing

      charButton = h('button', { class: 'hud__char', 'aria-label': 'Trocar personagem', title: 'Trocar personagem', onClick: chooseAvatar },
        h('img', { class: 'pixel', alt: '' }));
      const title = !chapter ? map.name : chapter.event ? `⛺ ${chapter.title} · ${eventProgress(game.save, chapter)}/${chapter.stops.length}` : `${hero ? '⚔️ Modo Herói · ' : ''}Capítulo ${chapter.number} · ${chapter.title}`;
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
        if (DEBUG) window.__world.scrolls = scrolls;
      }
      const tr = ((game.extras && game.extras.cosmetics.trails) || []).find((t) => t.id === game.save.state.equipped.trail);
      trailColor = tr ? tr.color : '';
      trail.length = 0;
      input = new Input(ui, game.assets);
      if (!game.save.seenTip('joystick')) {
        joyHint = h('div', { class: 'joy-hint' }, h('span', { text: 'Arraste o polegar aqui para andar' }));
        ui.appendChild(joyHint);
      }
      onKey = (e) => { if ((e.code === 'Enter' || e.code === 'Space') && currentStop) { e.preventDefault(); enterStop(); } };
      window.addEventListener('keydown', onKey);
      if (chapter && !params.at && hero) toast('Modo Herói: desafios difíceis, sem história, com o dobro de talentos e denários. Vença as luzes vermelhas!', { ms: 5000 });
      else if (chapter && !params.at && chapter.intro) toast(chapter.intro, { ms: 5000 });
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
      if (!map || !input) return; // still loading (slow phone internet)
      const vec = leaving ? { x: 0, y: 0 } : input.vector();
      player.update(dt, vec, map);
      if (pet) pet.update(dt, player);
      if (player.moving) { stepT += dt; if (stepT > 0.32) { stepT = 0; sfx('step'); } }
      if (trailColor && player.moving && Math.random() < dt * 22) {
        trail.push({ x: player.x + (Math.random() - 0.5) * 10, y: player.y - Math.random() * 4, vy: -6 - Math.random() * 10, life: 0.9 });
      }
      for (const p of trail) { p.y += p.vy * dt; p.life -= dt; }
      while (trail.length && trail[0].life <= 0) trail.shift();
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
            const done = hero ? Boolean((game.save.state.stars || {})[`${near.id}#heroi`]) : game.save.isStopDone(near.id);
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
      if (trail.length) {
        ctx.save();
        ctx.fillStyle = trailColor;
        for (const p of trail) { ctx.globalAlpha = Math.max(0, p.life / 0.9); ctx.fillRect(Math.round(p.x), Math.round(p.y), p.life > 0.6 ? 2 : 1, p.life > 0.6 ? 2 : 1); }
        ctx.restore();
      }
      // characters sorted by depth, so whoever is lower on screen is in front
      const list = stops ? stops.drawables() : [];
      list.push({ y: player.y, draw: (c) => player.draw(c) });
      if (pet) list.push({ y: pet.y, draw: (c) => pet.draw(c) });
      list.sort((a, b) => a.y - b.y).forEach((d) => d.draw(ctx));
      map.drawForeground(ctx);
      ambient.drawAbove(ctx, view);
      if (DEBUG) map.drawDebug(ctx);
      ctx.restore();
      if (talk) talk.place(camera, display);
    },
  };
}
