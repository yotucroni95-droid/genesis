// Ranking: everyone with a cloud account, top 50 by trophies, Arena record or
// stars, plus the player's own place. Data comes from Supabase (genesis_ranking).

import { h } from '../ui/dom.js';
import { gameScreen } from '../ui/screen.js';
import { frameView } from '../ui/game-ui.js';
import { Starfield } from './starfield.js';
import { cloudOn, accountCode, fetchRanking, pushNow } from '../cloud/account.js';

const TABS = [
  { id: 'trofeus', label: '🏆 Troféus', unit: 'troféus', how: 'Ganhe troféus na Arena e suba de patente.' },
  { id: 'arena', label: '⚡ Arena', unit: 'pontos', how: 'Seu melhor resultado numa partida da Arena.' },
  { id: 'estrelas', label: '⭐ Estrelas', unit: 'estrelas', how: 'Estrelas conquistadas na Jornada.' },
];
const MEDAL = ['🥇', '🥈', '🥉'];
let lastTab = 'trofeus';

export function createRankingScene(game) {
  const stars = new Starfield(90);
  return {
    enter(params, ui) {
      let tab = params.tab || lastTab;
      const tabsEl = h('div', { class: 'rank-tabs', role: 'tablist' });
      const info = h('p', { class: 'rank-info' });
      const list = h('ol', { class: 'rank-list' });
      const meBar = h('div', { class: 'rank-me' });
      const portrait = (id) => game.assets.url(game.assets.entry(`portrait.${id}`) ? `portrait.${id}` : 'portrait.peregrino');
      const frameId = (id) => ((game.extras && game.extras.cosmetics.frames.some((f) => f.id === id)) ? id : 'madeira');

      const load = async () => {
        lastTab = tab;
        const t = TABS.find((x) => x.id === tab);
        tabsEl.replaceChildren(...TABS.map((x) => h('button', { class: `rank-tab${x.id === tab ? ' is-on' : ''}`, role: 'tab', text: x.label, onClick: () => { if (x.id !== tab) { tab = x.id; load(); } } })));
        info.textContent = t.how;
        list.replaceChildren(h('li', { class: 'rank-empty', text: 'Carregando o ranking...' }));
        meBar.textContent = '';
        if (!cloudOn()) { list.replaceChildren(h('li', { class: 'rank-empty', text: 'O ranking está desligado no momento.' })); return; }
        let data;
        try {
          await pushNow(game.save); // your newest numbers first
          data = await fetchRanking(tab);
        } catch {
          list.replaceChildren(h('li', { class: 'rank-empty', text: 'Sem internet agora. Conecte e toque na aba de novo.' }));
          return;
        }
        if (tab !== t.id) return; // another tab was chosen meanwhile
        const top = (data && data.top) || [];
        const me = data && data.me;
        list.replaceChildren(...(top.length ? top.map((r) => h('li', { class: `rank-row${r.pos <= 3 ? ` is-top${r.pos}` : ''}${me && me.pos === r.pos ? ' is-me' : ''}` },
          h('span', { class: 'rank-pos', text: r.pos <= 3 ? MEDAL[r.pos - 1] : `${r.pos}º` }),
          frameView(frameId(r.frame), 40, portrait(r.avatar)),
          h('span', { class: 'rank-name' }, h('b', { text: `@${r.nick}` }), h('small', { text: `Nível ${r.level || 1}` })),
          h('span', { class: 'rank-value' }, h('b', { text: Number(r.value).toLocaleString('pt-BR') }), h('small', { text: t.unit })),
        )) : [h('li', { class: 'rank-empty', text: 'Ninguém no ranking ainda. Seja o primeiro!' })]));
        const total = (data && data.total) || 0;
        if (me) meBar.replaceChildren(h('b', { text: `Você está em ${me.pos}º lugar` }), h('span', { text: ` de ${total} · ${Number(me.value).toLocaleString('pt-BR')} ${t.unit}` }));
        else if (!accountCode()) meBar.textContent = 'Salve sua conta para aparecer no ranking.';
        else meBar.textContent = `Você ainda não está neste ranking. ${t.how}`;
      };

      ui.appendChild(gameScreen(game, 'Ranking', h('div', { class: 'rank' }, tabsEl, info, list, meBar), { back: params.back || 'lobby' }));
      load();
    },
    update(dt) { stars.update(dt); },
    render(ctx, d) { stars.render(ctx, d.width, d.height); },
  };
}
