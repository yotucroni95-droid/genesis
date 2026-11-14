// Temporary stand-in for challenges that are not built yet (Phase 5).
// It lets the player continue but does NOT save the stop as finished.

import { h } from '../ui/dom.js';

export function start(_config, env) {
  return new Promise((resolve) => {
    env.root.appendChild(h('div', { class: 'quiz' },
      h('h2', { class: 'quiz__q', text: 'Este desafio chega na próxima atualização!' }),
      h('p', { class: 'screen__note', text: 'Por enquanto, você pode continuar explorando. Esta parada ainda não conta como concluída.' }),
      h('button', { class: 'btn', text: 'Voltar ao mapa', onClick: () => resolve({ success: false, score: 0, comingSoon: true }) }),
    ));
  });
}
