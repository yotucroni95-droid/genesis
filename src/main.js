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
import { createStoryScene } from './scenes/story.js';
import { createChallengeScene } from './scenes/challenge.js';
import { createAlbumScene } from './scenes/album.js';
import { createMedalsScene } from './scenes/medals.js';
import { createAvatarScene } from './scenes/avatar.js';
import { createLobbyScene } from './scenes/lobby.js';
import { createBoxesScene } from './scenes/boxes.js';
import { createShopScene } from './scenes/shop.js';
import { createMissionsScene } from './scenes/missions.js';
import { createArenaScene } from './scenes/arena.js';
import { createCollectionScene } from './scenes/collection.js';
import { createProfileScene } from './scenes/profile.js';
import { createDailyScene } from './scenes/daily.js';
import { createPassScene } from './scenes/pass.js';
import { SaveManager } from './save/save-manager.js';
import { unlockAudio, playMusic, sfx } from './audio/audio.js';
import { setUiAssets } from './ui/game-ui.js';
import { setCharacters, onMetaEvent, charById } from './game/meta.js';
import { toast } from './ui/toast.js';
import { celebrate } from './ui/celebrate.js';
import { installReliableTaps } from './ui/tap.js';

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
  installReliableTaps();

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
  // a friend's Arena challenge link: ?desafio=seed.score.nick
  const duelParam = new URLSearchParams(location.search).get('desafio');
  if (duelParam) {
    const [seed, score, ...nick] = duelParam.split('.');
    if (Number(seed) > 0) game.duel = { seed: Number(seed), score: Number(score) || 0, nick: decodeURIComponent(nick.join('.')).slice(0, 16) || 'amigo' };
    history.replaceState(null, '', location.pathname); // do not repeat it on reload
  }
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

  setUiAssets(assets);
  setCharacters(assets.json('characters.json').characters);
  onMetaEvent((e) => {
    if (e.type === 'unlockChar') {
      const c = charById(e.id) || { name: e.id };
      if (e.jesus) {
        sfx('fanfare');
        celebrate({ title: 'JESUS!', subtitle: 'Você conseguiu o personagem único do jogo. Pouquíssimos conseguem isso. Fora de série!', image: assets.url('portrait.jesus') });
      } else {
        celebrate({ title: 'Personagem liberado!', subtitle: `${c.name} (${c.rarity}) agora está no seu álbum. Jogue com ele!`, image: assets.url(`portrait.${e.id}`) });
      }
    }
    if (e.type === 'lampLit') {
      toast(`🪔 Lamparina acesa: ${e.count} ${e.count === 1 ? 'dia' : 'dias'}! +${e.coins} talentos${e.prizes.length ? ` e ${e.prizes.join(', ')}!` : ''}`, { ms: 4000 });
    }
    if (e.type === 'passLevel') toast(`✨ Passe da Fé: nível ${e.level}! Resgate o prêmio no lobby.`, { ms: 3500 });
  });
  game.scenes.register('title', createTitleScene);
  game.scenes.register('credits', createCreditsScene);
  game.scenes.register('gallery', createGalleryScene);
  game.scenes.register('explore', createExploreScene);
  game.scenes.register('world', createWorldScene);
  game.scenes.register('nickname', createNicknameScene);
  game.scenes.register('story', createStoryScene);
  game.scenes.register('challenge', createChallengeScene);
  game.scenes.register('album', createAlbumScene);
  game.scenes.register('medals', createMedalsScene);
  game.scenes.register('avatar', createAvatarScene);
  for (const [name, f] of Object.entries({ lobby: createLobbyScene, boxes: createBoxesScene, shop: createShopScene, missions: createMissionsScene, arena: createArenaScene, collection: createCollectionScene, profile: createProfileScene, daily: createDailyScene, pass: createPassScene })) game.scenes.register(name, f);

  const loop = new GameLoop({
    update: (dt) => game.scenes.update(dt),
    render: (alpha) => {
      const ctx = display.begin();
      game.scenes.render(ctx, display, alpha);
    },
  });

  // background music follows the screen (map screens use the chapter's tune)
  const goScene = game.scenes.go.bind(game.scenes);
  game.scenes.go = async (name, params = {}) => {
    let tune = 'lobby';
    if (name === 'arena') tune = 'arena';
    if (['world', 'story', 'challenge'].includes(name)) {
      const id = params.chapterId || (params.back && params.back.chapterId);
      const entry = id && assets.json('chapters/index.json').chapters.find((c) => c.id === id);
      tune = entry ? ({ cap0: 'ceu', cap1: 'eden', cap2: 'fora_eden', cap3: 'campos', cap4: 'arca', cap5: 'campos', cap6: 'eden', cap7: 'fora_eden', cap8: 'campos', cap9: 'eden', cap10: 'arca' })[id] || 'eden' : (params.mapId || 'eden');
    }
    playMusic(tune);
    if (name !== 'title' && name !== 'challenge') sfx('transition');
    return goScene(name, params);
  };
  // the first touch anywhere turns sound on (phones require it); buttons click
  // Phones open audio only on these "activation" events (finger lifted / click)
  for (const type of ['pointerup', 'touchend', 'click', 'keydown']) {
    document.addEventListener(type, unlockAudio, { capture: true, passive: true });
  }
  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest && e.target.closest('button')) sfx('click');
  }, true);

  await game.scenes.go('title');
  loop.start();
  bootEl.classList.add('is-done');
  setTimeout(() => { bootEl.style.display = 'none'; }, 600);
  window.__genesis = game; // handy for debugging in the browser console
}

boot();

// Offline support and always-fresh updates (not on the local test server).
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.search.includes('sw=1'))) { // sw=1: test offline locally
  navigator.serviceWorker.register('sw.js').then(async () => {
    // download everything (sounds and voices too) so the game works offline
    const reg = await navigator.serviceWorker.ready;
    if (reg.active) reg.active.postMessage('precache');
  }).catch(() => {});
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'offline-ready') {
      try {
        if (!localStorage.getItem('genesis.offline')) { localStorage.setItem('genesis.offline', '1'); toast('✈️ Pronto! Agora o Gênesis funciona até sem internet.', { ms: 4000 }); }
      } catch { /* storage blocked */ }
    }
  });
}
