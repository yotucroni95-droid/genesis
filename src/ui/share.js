// "Compartilhar no WhatsApp": builds a picture of the player's progress and
// shares it (with a link to the game) using the phone's share menu.

import { rankFor, totalStars } from '../game/economy.js';
import { toast } from './toast.js';

const GAME_URL = 'https://yotucroni95-droid.github.io/genesis/';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function shareCard(game, { headline, link = '' } = {}) {
  const url = GAME_URL + link;
  const s = game.save.state;
  const rank = rankFor(s.trophies || 0);
  const W = 1080;
  const H = 1080;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#05071a');
  sky.addColorStop(0.6, '#141d55');
  sky.addColorStop(1, '#3a2266');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.8})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 3, 3);
  }
  const logo = game.assets.image('logo.genesis');
  if (logo) ctx.drawImage(logo, W / 2 - 300, 30, 600, 357);
  // avatar with rank glow
  const glow = ctx.createRadialGradient(W / 2, 560, 40, W / 2, 560, 260);
  glow.addColorStop(0, `${rank.color}aa`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 300, W, 520);
  const portrait = game.assets.image(`portrait.${s.avatarId}`);
  ctx.fillStyle = rank.color;
  roundRect(ctx, W / 2 - 150, 410, 300, 300, 36);
  ctx.fill();
  if (portrait) ctx.drawImage(portrait, W / 2 - 136, 424, 272, 272);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd36e';
  ctx.font = 'bold 64px "Pixelify Sans", sans-serif';
  ctx.fillText(`@${s.nick}`, W / 2, 790);
  ctx.fillStyle = rank.color;
  ctx.font = 'bold 54px "Pixelify Sans", sans-serif';
  ctx.fillText(`Patente ${rank.name}`, W / 2, 860);
  ctx.fillStyle = '#ffffff';
  ctx.font = '40px "Pixelify Sans", sans-serif';
  ctx.fillText(`🏆 ${s.trophies || 0}   ⭐ ${totalStars(game.save)}   ⚡ ${s.arenaBest || 0}   🧑 ${Object.keys(s.unlocked).length}`, W / 2, 930);
  ctx.fillStyle = '#a9b0d6';
  ctx.font = '34px "Pixelify Sans", sans-serif';
  ctx.fillText(headline || 'Consegue me alcançar? Jogue o Gênesis!', W / 2, 1000);
  ctx.font = '28px sans-serif';
  ctx.fillText(GAME_URL.replace('https://', ''), W / 2, 1050);

  const text = `${headline || 'Estou jogando o Gênesis!'} Cheguei na patente ${rank.name} com ${s.trophies || 0} troféus 🏆. ${link ? 'Aceita o desafio? Toque no link e responda as mesmas perguntas:' : 'Consegue me alcançar?'} ${url}`;
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const file = blob && new File([blob], 'genesis.png', { type: 'image/png' });
  try {
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text, title: 'Gênesis' });
      return;
    }
    if (navigator.share) { await navigator.share({ text, title: 'Gênesis' }); return; }
  } catch (e) {
    if (e && e.name === 'AbortError') return; // the player closed the menu
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  toast('Abrindo o WhatsApp...');
}
