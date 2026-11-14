// Walking around a map: joystick/keyboard, camera, collision and ambient life.

import { h } from '../ui/dom.js';
import { iconButton } from '../ui/icon-button.js';
import { TileMap } from '../world/tilemap.js';
import { Camera } from '../world/camera.js';
import { Player } from '../world/player.js';
import { Ambient } from '../world/ambient.js';
import { Input } from '../input/input.js';

const DEBUG = new URLSearchParams(location.search).has('debug');

export function createWorldScene(game) {
  let map = null;
  let player = null;
  let ambient = null;
  let input = null;
  const camera = new Camera();
  let firstFrame = true;
  let charButton = null;

  function playableIds() {
    const data = game.assets.json('characters.json');
    return data.characters.filter((c) => c.playable).map((c) => c.id);
  }

  function refreshCharButton() {
    const img = charButton.querySelector('img');
    img.src = game.assets.url(`portrait.${player.characterId}`);
  }

  return {
    async enter(params, ui) {
      const mapId = params.mapId || 'eden';
      const json = await game.assets.loadJSON(`maps/${mapId}.json`);
      map = new TileMap(json, game.assets);
      const spawnX = (map.spawn.x + 0.5) * map.tileW;
      const spawnY = (map.spawn.y + 1) * map.tileH - 4;
      player = new Player(game.assets, params.characterId || game.save.state.avatarId || 'peregrino', spawnX, spawnY);
      ambient = new Ambient(map);
      firstFrame = true;

      charButton = h('button', {
        class: 'hud__char',
        'aria-label': 'Trocar personagem',
        title: 'Trocar personagem (teste)',
        onClick: () => {
          const ids = playableIds();
          const next = ids[(ids.indexOf(player.characterId) + 1) % ids.length];
          player.setCharacter(next);
          refreshCharButton();
        },
      }, h('img', { class: 'pixel', alt: '' }));

      const hud = h('div', { class: 'hud' },
        iconButton(game.assets, 'icon.voltar', 'Voltar', () => game.scenes.go('explore'), '←'),
        h('div', { class: 'hud__title', text: map.name }),
        charButton,
      );
      ui.appendChild(hud);
      refreshCharButton();
      input = new Input(ui, game.assets);
    },

    exit() {
      if (input) input.destroy();
      input = null;
    },

    update(dt) {
      if (!map) return;
      player.update(dt, input.vector(), map);
      ambient.update(dt);
    },

    render(ctx, display) {
      if (!map) return;
      camera.follow(player.x, player.y - 12, map, display.width, display.height, 1 / 60, firstFrame);
      firstFrame = false;
      ctx.fillStyle = '#05071a';
      ctx.fillRect(0, 0, display.width, display.height);
      ctx.save();
      ctx.translate(-camera.ix, -camera.iy);
      const view = { x: camera.ix, y: camera.iy, w: display.width, h: display.height };
      map.drawGround(ctx, view);
      ambient.drawBelow(ctx, view);
      player.draw(ctx);
      ambient.drawAbove(ctx, view);
      if (DEBUG) map.drawDebug(ctx);
      ctx.restore();
    },
  };
}
