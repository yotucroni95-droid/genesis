// "A travessia" (Êxodo 14:21-29): run along the dry path in the middle of the
// sea and reach the other shore. Tap to jump over rocks and puddles; every
// stumble lets the water behind you come closer.
// config: { length (seconds of running), lives, hard }

import { h } from '../ui/dom.js';
import { resultScreen } from './result.js';
import { arcade, glyph, hud, startCard, drawSprite, rand, AW, AH } from './arcade.js';

const GROUND = 214;

export function start(config, env) {
  const wrap = h('div', { class: 'quiz arcade' });
  env.root.appendChild(wrap);
  const length = config.length || 60;
  const maxLives = config.lives || 3;
  const hard = Boolean(config.hard);
  return new Promise((resolve) => {
    const play = () => {
      const g = arcade(wrap);
      wrap.replaceChildren(h('p', { class: 'quiz__count', text: 'Toque na tela (ou espaço) para pular. Chegue à outra margem!' }), g.canvas);
      const { ctx, input } = g;
      const me = { x: 150, y: GROUND, vy: 0 };
      let things = []; let dist = 0; let wave = 20; let lives = maxLives; let shells = 0; let t = 0; let slow = 0; let next = 1.2; let started = false; let hurt = 0;
      const total = length * 150; // world pixels to the other shore
      const draw = () => {
        // walls of water on both sides of the path (seen from the side: sky of water)
        const grd = ctx.createLinearGradient(0, 0, 0, GROUND);
        grd.addColorStop(0, '#0d3f7a'); grd.addColorStop(1, '#2c8fd6');
        ctx.fillStyle = grd; ctx.fillRect(0, 0, AW, GROUND + 4);
        ctx.fillStyle = 'rgba(255,255,255,.35)';
        for (let i = 0; i < 20; i++) { const x = (i * 61 - (dist * 0.3) % 61 + AW) % AW; ctx.fillRect(x, 40 + ((i * 29) % 140), 18, 2); }
        ctx.fillStyle = '#e8f6ff'; for (let x = 0; x < AW; x += 10) ctx.fillRect(x, GROUND - 6 + Math.sin(x + t * 6) * 2, 6, 3);
        // the dry sea floor
        ctx.fillStyle = '#c99a55'; ctx.fillRect(0, GROUND, AW, AH - GROUND);
        ctx.fillStyle = '#b5864a'; for (let x = -(dist % 40); x < AW; x += 40) ctx.fillRect(x, GROUND + 14, 18, 3);
        // the other shore appears at the end
        const shoreX = me.x + (total - dist);
        if (shoreX < AW + 60) { ctx.fillStyle = '#f2c46a'; ctx.fillRect(shoreX, GROUND - 10, AW, AH); glyph(ctx, '🌴', shoreX + 40, GROUND - 30, 34); }
        for (const o of things) {
          if (o.kind === 'puddle') { ctx.fillStyle = '#3c93d8'; ctx.beginPath(); ctx.ellipse(o.x, GROUND + 4, 22, 6, 0, 0, Math.PI * 2); ctx.fill(); }
          else glyph(ctx, o.kind === 'rock' ? '🪨' : o.kind === 'weed' ? '🌿' : '🐚', o.x, o.kind === 'shell' ? o.y : GROUND - 10, o.kind === 'shell' ? 18 : 24);
        }
        ctx.globalAlpha = hurt > 0 && Math.floor(hurt * 12) % 2 ? 0.4 : 1;
        drawSprite(ctx, env.assets, env.avatar || 'peregrino', 2, me.y < GROUND ? 1 : Math.floor(t * 10) % 4, me.x, me.y + 2, 46);
        ctx.globalAlpha = 1;
        // the water coming back from behind
        ctx.fillStyle = 'rgba(30,110,200,.92)'; ctx.fillRect(0, 22, wave, AH);
        ctx.fillStyle = '#e8f6ff'; for (let y = 22; y < AH; y += 8) ctx.fillRect(wave - 4 + Math.sin(y + t * 9) * 3, y, 6, 5);
        // progress
        ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(140, 8, 200, 6);
        ctx.fillStyle = '#ffd36e'; ctx.fillRect(140, 8, 200 * Math.min(1, dist / total), 6);
        hud(ctx, { lives, left: `🐚 ${shells}`, right: `${Math.round(Math.min(1, dist / total) * 100)}%` });
      };
      const end = (won) => {
        g.stop();
        env.sfx && env.sfx(won ? 'fanfare' : 'wrong');
        const score = won ? Math.min(100, 62 + lives * 8 + Math.min(14, shells * 2)) : 0;
        resultScreen(wrap, {
          passed: won,
          big: won ? '🌊🚶🌊' : '🌊',
          title: won ? 'Você atravessou a pé enxuto!' : 'As águas voltaram...',
          note: won ? 'O povo viu o grande poder do Senhor e creu nele (Êxodo 14:31).' : 'Pule as pedras e poças sem parar. Tente de novo!',
          onContinue: () => resolve({ success: true, score, correct: shells }),
          onRetry: play,
        });
      };
      draw();
      startCard(ctx, 'O caminho no meio do mar', ['As águas estão como muralhas dos dois lados.', 'Pule as pedras e poças. Não deixe a água te alcançar!']);
      g.loop((dt) => {
        if (!started) { if (input.taps) { started = true; input.taps = 0; } return true; }
        t += dt;
        if (input.taps && me.y >= GROUND) { me.vy = -420; env.sfx && env.sfx('click'); }
        input.taps = 0;
        me.vy += 1250 * dt; me.y = Math.min(GROUND, me.y + me.vy * dt);
        const run = (slow > 0 ? 70 : 150 + Math.min(60, t * 2)) * (hard ? 1.15 : 1);
        dist += run * dt; slow -= dt; hurt -= dt;
        // the water behind moves at a steady pace: stumbles let it catch up
        wave += (slow > 0 ? 33 : 1.2) * dt;
        next -= dt;
        if (next <= 0 && dist < total - 300) {
          next = rand(0.75, 1.35) / (hard ? 1.25 : 1);
          const r = Math.random();
          things.push(r < 0.3 ? { kind: 'shell', x: AW + 20, y: rand(GROUND - 90, GROUND - 40) } : { kind: r < 0.6 ? 'rock' : r < 0.85 ? 'puddle' : 'weed', x: AW + 20 });
        }
        for (const o of things) {
          o.x -= run * dt;
          const near = Math.abs(o.x - me.x) < (o.kind === 'puddle' ? 18 : 14);
          if (!o.gone && near) {
            if (o.kind === 'shell') { if (Math.abs(o.y - (me.y - 24)) < 26) { shells += 1; o.gone = true; env.sfx && env.sfx('coin'); } }
            else if (me.y > GROUND - 18 && hurt <= 0) { lives -= 1; slow = 0.9; hurt = 1.1; o.gone = true; env.sfx && env.sfx('wrong'); if (navigator.vibrate) navigator.vibrate(90); }
          }
        }
        things = things.filter((o) => o.x > -40 && !o.gone);
        draw();
        if (lives <= 0 || wave >= me.x - 12) { end(false); return false; }
        if (dist >= total) { end(true); return false; }
        return true;
      });
    };
    play();
  });
}
