// "Nova versão" notice: shown once, when the player opens the game after an
// update. To announce the next update, change NEWS.id and the list below.

const SEEN_KEY = 'genesis.newsSeen';

export const NEWS = {
  id: '2026-11-17b',
  title: 'Nova versão do Gênesis!',
  intro: 'Você está jogando a versão nova. Resolvemos alguns problemas que vocês nos contaram:',
  fixes: [
    'NOVO: RANKING! Veja quem está no topo em Troféus, Arena e Estrelas, e tente passar todo mundo. Botão Ranking no lobby.',
    'NOVO: sua conta agora fica salva na nuvem! Você recebe um código secreto (GEN-...). Copie e guarde: com ele você entra na sua conta em outro celular ou navegador, sem perder nada. Não mostre o código para ninguém.',
    'Arena: agora são 240 perguntas, e as que você já respondeu vão para o fim da fila. Chega de pergunta repetida!',
    'Ganhou um código num desafio? Resgate na Loja, no botão “Resgatar código”.',
    'Os caminhos de todos os mapas foram revisados: agora dá para passar em todo lugar, inclusive em Babel e na ponte do Éden.',
    'Os personagens agora ficam ao lado da estrada, fora do caminho: ninguém fica parado no meio da passagem.',
    'Os personagens lendários (Paulo, João Batista, Salomão, Maria, Abel e a Aventureira) agora olham para a direita quando você vira o joystick para a direita.',
    'O jogo abre sempre deitado (na horizontal). Se a tela não girar, a rotação automática do celular está travada: destrave e vire de novo.',
    'Todas as missões ficam em cima do caminho, fáceis de alcançar (Jacó e Esaú, Moriá e as missões do Acampamento).',
    'Os pergaminhos aparecem só na estrada, e são sempre 5 por mapa.',
    'O botão de voltar volta só uma tela por toque (antes, às vezes voltava duas).',
    'Acampamento: o Voto e a Lei do Aventureiro foram corrigidos com o texto oficial, e o jogo de colocar em ordem agora aceita a resposta certa.',
  ],
  outro: 'Em breve chegam mais atualizações, sempre buscando melhorias. Obrigado por jogar e por nos ajudar!',
};

export function showNews() {
  let seen = '';
  try { seen = localStorage.getItem(SEEN_KEY) || ''; } catch { /* storage blocked */ }
  if (seen === NEWS.id || document.getElementById('news')) return;
  const el = document.createElement('div');
  el.id = 'news';
  el.setAttribute('role', 'dialog');
  el.innerHTML = `
    <div class="news__box screen__body">
      <button class="news__x" type="button" aria-label="Fechar">✕</button>
      <div class="news__icon">✨</div>
      <h1 class="news__title"></h1>
      <p class="news__intro"></p>
      <ul class="news__list"></ul>
      <p class="news__outro"></p>
      <button class="btn news__ok" type="button">Vamos jogar!</button>
    </div>`;
  el.querySelector('.news__title').textContent = NEWS.title;
  el.querySelector('.news__intro').textContent = NEWS.intro;
  el.querySelector('.news__outro').textContent = NEWS.outro;
  const list = el.querySelector('.news__list');
  for (const f of NEWS.fixes) {
    const li = document.createElement('li');
    li.textContent = f;
    list.appendChild(li);
  }
  // closes with the button, the ✕ or a tap outside the box (on short phone
  // screens the box scrolls; the ✕ is always visible at the top)
  const close = () => {
    try { localStorage.setItem(SEEN_KEY, NEWS.id); } catch { /* storage blocked */ }
    el.remove();
  };
  el.querySelector('.news__ok').addEventListener('click', close);
  el.querySelector('.news__x').addEventListener('click', close);
  el.addEventListener('click', (e) => { if (e.target === el) close(); });
  document.body.appendChild(el);
}
