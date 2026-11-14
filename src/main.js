// Entry point: preloads everything with a progress bar, then starts the loop.

import { CONFIG } from './config.js';
import { Display } from './engine/display.js';
import { GameLoop } from './engine/loop.js';
import { SceneManager } from './engine/scene-manager.js';
import { Assets } from './assets/loader.js';
import { createTitleScene } from './scenes/title.js';
import { createCreditsScene } from './scenes/credits.js';
import { createGalleryScene } from './scenes/gallery.js';
import { createExploreScene } from './scenes/explore.js';
import { createWorldScene } from './scenes/world-map.js';
import { createNicknameScene } from './scenes/nickname.js';
import { SaveManager } from './save/save-manager.js';

const CONTENT_FILES = ['characters.json', 'chapters/index.json', 'maps/index.json'];

function blockBrowserGestures() {
  // Stop pinch-zoom, double-tap zoom and pull-to-refresh on phones.
  const stop = (e) => e.preventDefault();
  document.addEventListener('gesturestart', stop, { passive: false });
  document.addEventListener('dblclick', stop, { passive: false });
  document.addEventListener('touchmove', (e) => {
    if (!e.target.closest || !e.target.closest('.screen__body, input')) e.preventDefault();
  }, { passive: false });
  document.addEventListener('contextmenu', stop);
}

async function boot() {
  blockBrowserGestures();

  const bootEl = document.getElementById('boot');
  const fill = bootEl.querySelector('.bar__fill');
  const bar = bootEl.querySelector('.bar');
  const label = bootEl.querySelector('.boot__label');
  const setProgress = (f) => {
    const pct = Math.round(f * 100);
    fill.style.width = `${pct}%`;
    bar.setAttribute('aria-valuenow', String(pct));
    label.textContent = `Carregando… ${pct}%`;
  };

  const display = new Display(document.getElementById('screen'), { targetShortSide: CONFIG.viewShortSide });
  const assets = new Assets();
  const game = { config: CONFIG, display, assets, save: new SaveManager(), scenes: null };
  game.scenes = new SceneManager(game, document.getElementById('ui'));

  try {
    await assets.loadAll('assets/manifest.json', CONTENT_FILES, setProgress);
    if (document.fonts && document.fonts.load) {
      await Promise.race([document.fonts.load('700 20px "Pixelify Sans"'), new Promise((r) => setTimeout(r, 1500))]);
    }
  } catch (err) {
    console.error(err);
    label.textContent = 'Não foi possível carregar o jogo. Verifique a internet e toque para tentar de novo.';
    bootEl.addEventListener('click', () => location.reload(), { once: true });
    return;
  }

  game.scenes.register('title', createTitleScene);
  game.scenes.register('credits', createCreditsScene);
  game.scenes.register('gallery', createGalleryScene);
  game.scenes.register('explore', createExploreScene);
  game.scenes.register('world', createWorldScene);
  game.scenes.register('nickname', createNicknameScene);

  const loop = new GameLoop({
    update: (dt) => game.scenes.update(dt),
    render: (alpha) => {
      const ctx = display.begin();
      game.scenes.render(ctx, display, alpha);
    },
  });

  await game.scenes.go('title');
  loop.start();
  bootEl.classList.add('is-done');
  setTimeout(() => { bootEl.style.display = 'none'; }, 600);
  window.__genesis = game; // handy for debugging in the browser console
}

boot();
