// "O cesto no Nilo" (Êxodo 2:3): guide the little basket down the river,
// away from rocks, logs and whirlpools, picking flowers on the way.
// config: { seconds, lives, speed, hard }

import { h } from '../ui/dom.js';
import { resultScreen } from './result.js';
import { arcade, glyph, hud, startCard, rand, hit, AW, AH } from './arcade.js';

export function start(config, env) {
  const wrap = h('div', { class: 'quiz arcade' });
  env.root.appendChild(wrap);
  const seconds = config.seconds || 26;
  const maxLives = config.lives || 3;
  const speed = (config.speed || 1) * (config.hard ? 1.25 : 1);
  return new Promise((resolve) => {
    const play = () => {
      const g = arcade(wrap);
      wrap.replaceChildren(h('p', { class: 'quiz__count', text: 'Arraste para cima e para baixo (ou use as setas) e desvie do perigo!' }), g.canvas);
      const { ctx, input } = g;
      const boat = { x: 90, y: AH / 2, vy: 0 };
      let things = [];
      let t = 0; let lives = maxLives; let flowers = 0; let spawned = 0; let hurt = 0; let spawnIn = 0.6; let started = false; let flow = 0;
      const draw = () => {
        // river with banks of reeds
        ctx.fillStyle = '#2f7fc4'; ctx.fillRect(0, 0, AW, AH);
        ctx.fillStyle = '#3c93d8';
        for (let i = 0; i < 14; i++) { const y = 30 + ((i * 37) % (AH - 60)); const x = (AW - ((flow * 90 + i * 83) % (AW + 60))); ctx.fillRect(x, y, 26, 2); }
        ctx.fillStyle = '#d9b46a'; ctx.fillRect(0, 22, AW, 16); ctx.fillRect(0, AH - 16, AW, 16);
        for (let x = -((flow * 90) % 24); x < AW; x += 24) { glyph(ctx, '🌾', x, 34, 16); glyph(ctx, '🌾', x + 12, AH - 14, 16); }
        for (const o of things) {
          if (o.kind === 'whirl') {
            ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2;
            for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(o.x, o.y, 6 + k * 6, t * 4 + k, t * 4 + k + 4.2); ctx.stroke(); }
          } else glyph(ctx, o.kind === 'rock' ? '🪨' : o.kind === 'log' ? '🪵' : '🌸', o.x, o.y, o.kind === 'flower' ? 18 : 26);
        }
        ctx.globalAlpha = hurt > 0 && Math.floor(hurt * 12) % 2 ? 0.35 : 1;
        glyph(ctx, '🧺', boat.x, boat.y + Math.sin(t * 5) * 2, 30);
        ctx.globalAlpha = 1;
        hud(ctx, { lives, left: `🌸 ${flowers}`, right: `${Math.max(0, Math.ceil(seconds - t))}s` });
      };
      const end = (won) => {
        g.stop();
        const bonus = spawned ? Math.round((flowers / Math.max(1, spawned)) * 30) : 0;
        const score = won ? Math.min(100, 60 + bonus + lives * 4) : 0;
        env.sfx && env.sfx(won ? 'fanfare' : 'wrong');
        resultScreen(wrap, {
          passed: won,
          big: won ? `🌸 ${flowers}` : '💦',
          title: won ? 'A filha do Faraó encontrou o cesto!' : 'O cesto bateu demais...',
          note: won ? 'Deus guardou o pequeno Moisés no rio Nilo (Êxodo 2:5-6).' : 'Tente de novo: desvie das pedras, troncos e redemoinhos.',
          onContinue: () => resolve({ success: true, score, correct: flowers }),
          onRetry: play,
        });
      };
      draw();
      startCard(ctx, 'O cesto no rio Nilo', ['Guie o cesto do bebê Moisés rio abaixo.', 'Desvie das pedras, troncos e redemoinhos. Pegue as flores!']);
      g.loop((dt) => {
        if (!started) { if (input.taps) { started = true; input.taps = 0; } return true; }
        t += dt; flow += dt * speed;
        // control: follow the finger, or arrow keys
        const up = input.keys.has('ArrowUp') || input.keys.has('w');
        const dn = input.keys.has('ArrowDown') || input.keys.has('s');
        if (up || dn) boat.y += (dn ? 1 : -1) * 170 * dt;
        else if (input.y != null) boat.y += (input.y - boat.y) * Math.min(1, dt * 9);
        boat.y = Math.max(52, Math.min(AH - 30, boat.y));
        spawnIn -= dt;
        const pace = 1 + t / seconds; // it gets faster
        if (spawnIn <= 0) {
          spawnIn = rand(0.45, 0.9) / (speed * pace);
          const r = Math.random();
          const kind = r < 0.22 ? 'flower' : r < 0.5 ? 'rock' : r < 0.78 ? 'log' : 'whirl';
          if (kind === 'flower') spawned += 1;
          things.push({ kind, x: AW + 20, y: rand(54, AH - 30), vy: kind === 'log' ? rand(-18, 18) : 0 });
        }
        for (const o of things) {
          o.x -= (110 + 70 * pace) * speed * dt;
          o.y = Math.max(52, Math.min(AH - 30, o.y + o.vy * dt));
          if (!o.gone && hit(o, boat, o.kind === 'flower' ? 20 : o.kind === 'whirl' ? 18 : 19)) {
            if (o.kind === 'flower') { flowers += 1; o.gone = true; env.sfx && env.sfx('coin'); }
            else if (hurt <= 0) { lives -= 1; hurt = 1.2; o.gone = true; env.sfx && env.sfx('wrong'); if (navigator.vibrate) navigator.vibrate(80); }
          }
        }
        things = things.filter((o) => o.x > -30 && !o.gone);
        hurt -= dt;
        draw();
        if (lives <= 0) { end(false); return false; }
        if (t >= seconds) { end(true); return false; }
        return true;
      });
    };
    play();
  });
}
