// "Pão do céu" (Êxodo 16): catch the manna falling in the morning. Quails are
// worth more; old manna "full of worms" (Êxodo 16:20) takes points away.
// On the sixth day you gather double (Êxodo 16:22).
// config: { goal, seconds, sixth, hard }

import { h } from '../ui/dom.js';
import { resultScreen } from './result.js';
import { arcade, glyph, hud, startCard, rand, AW, AH } from './arcade.js';

export function start(config, env) {
  const wrap = h('div', { class: 'quiz arcade' });
  env.root.appendChild(wrap);
  const goal = config.goal || 12;
  const seconds = config.seconds || 22;
  const rounds = config.sixth ? [{ day: 'Primeiro dia', goal }, { day: 'Sexto dia: junte o dobro!', goal: goal * 2 }] : [{ day: 'De manhã', goal }];
  return new Promise((resolve) => {
    const play = () => {
      let round = 0; let worms = 0; let caughtAll = 0;
      const g = arcade(wrap);
      wrap.replaceChildren(h('p', { class: 'quiz__count', text: 'Arraste o cesto (ou use as setas). Pegue o maná, fuja do maná com bichinhos!' }), g.canvas);
      const { ctx, input } = g;
      const basket = { x: AW / 2, y: AH - 26 };
      let items = []; let got = 0; let t = 0; let spawnIn = 0; let started = false; let flash = 0;
      const R = () => rounds[round];
      const draw = () => {
        const sky = ctx.createLinearGradient(0, 0, 0, AH);
        sky.addColorStop(0, '#5a7fc8'); sky.addColorStop(0.7, '#f0a868'); sky.addColorStop(1, '#f7c27a');
        ctx.fillStyle = sky; ctx.fillRect(0, 0, AW, AH);
        ctx.fillStyle = '#e8b866'; ctx.fillRect(0, AH - 18, AW, 18);
        glyph(ctx, '⛺', 40, AH - 34, 30); glyph(ctx, '⛺', AW - 40, AH - 34, 30);
        for (const it of items) {
          if (it.kind === 'mana') { ctx.fillStyle = '#fffdf2'; ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(it.x, it.y, 7.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#efe4c4'; ctx.fillRect(it.x - 2, it.y - 1, 3, 3); }
          else if (it.kind === 'old') { ctx.fillStyle = '#9b8456'; ctx.beginPath(); ctx.arc(it.x, it.y, 7, 0, Math.PI * 2); ctx.fill(); glyph(ctx, '🐛', it.x + 2, it.y - 2, 13); }
          else glyph(ctx, '🐦', it.x, it.y, 22);
        }
        glyph(ctx, '🧺', basket.x, basket.y, 34);
        if (flash > 0) { ctx.fillStyle = `rgba(160,60,40,${flash * 0.5})`; ctx.fillRect(0, 0, AW, AH); }
        hud(ctx, { left: `${R().day}  ·  ${got}/${R().goal}`, right: `${Math.max(0, Math.ceil(seconds - t))}s` });
      };
      const finish = (won) => {
        g.stop();
        env.sfx && env.sfx(won ? 'fanfare' : 'wrong');
        const score = won ? Math.max(60, Math.min(100, 100 - worms * 6)) : 0;
        resultScreen(wrap, {
          passed: won,
          big: won ? `🍞 ${caughtAll}` : `${got}/${R().goal}`,
          title: won ? 'Ninguém passou fome!' : 'Faltou maná...',
          note: won ? 'Deus deu o pão de cada dia, e no sábado o povo descansou (Êxodo 16:29-30).' : `Você precisava juntar ${R().goal}. Fuja do maná com bichinhos e tente de novo!`,
          onContinue: () => resolve({ success: true, score, correct: caughtAll }),
          onRetry: play,
        });
      };
      const intro = () => { draw(); startCard(ctx, R().day, round === 0 ? ['Junte o maná que cai do céu.', 'Codorniz vale 2. Maná velho com bichinhos tira 2!'] : ['Hoje é o sexto dia.', `Junte ${R().goal} para ter maná também no sábado!`]); };
      intro();
      g.loop((dt) => {
        if (!started) { if (input.taps) { started = true; input.taps = 0; } return true; }
        t += dt; flash -= dt * 2;
        const l = input.keys.has('ArrowLeft') || input.keys.has('a');
        const r = input.keys.has('ArrowRight') || input.keys.has('d');
        if (l || r) basket.x += (r ? 1 : -1) * 300 * dt;
        else if (input.x != null) basket.x += (input.x - basket.x) * Math.min(1, dt * 12);
        basket.x = Math.max(20, Math.min(AW - 20, basket.x));
        spawnIn -= dt;
        const busy = 1 + round * 0.7 + (config.hard ? 0.4 : 0);
        if (spawnIn <= 0) {
          spawnIn = rand(0.28, 0.55) / busy;
          const k = Math.random();
          items.push({ kind: k < 0.66 ? 'mana' : k < 0.8 ? 'quail' : 'old', x: rand(16, AW - 16), y: 18, vy: rand(70, 120) * (1 + round * 0.25), drift: rand(-20, 20) });
        }
        for (const it of items) {
          it.y += it.vy * dt; it.x += Math.sin(t * 3 + it.drift) * it.drift * dt;
          if (!it.gone && Math.abs(it.x - basket.x) < 22 && Math.abs(it.y - (basket.y - 6)) < 14) {
            it.gone = true;
            if (it.kind === 'old') { got = Math.max(0, got - 2); worms += 1; flash = 1; env.sfx && env.sfx('wrong'); }
            else { const n = it.kind === 'quail' ? 2 : 1; got += n; caughtAll += n; env.sfx && env.sfx('coin'); }
          }
        }
        items = items.filter((it) => it.y < AH && !it.gone);
        draw();
        if (got >= R().goal) {
          if (round + 1 < rounds.length) { round += 1; got = 0; t = 0; items = []; started = false; input.taps = 0; intro(); return true; }
          finish(true); return false;
        }
        if (t >= seconds) { finish(false); return false; }
        return true;
      });
    };
    play();
  });
}
