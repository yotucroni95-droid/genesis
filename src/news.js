// "Nova versão" notice: shown once, when the player opens the game after an
// update. To announce the next update, change NEWS.id and the list below.

const SEEN_KEY = 'genesis.newsSeen';

export const NEWS = {
  id: '2026-11-20b',
  // stops showing after this moment (Brasília time); remove or change for the next update
  until: '2026-11-23T12:00:00-03:00',
  title: 'Chegou a versão 2.0 do Gênesis!',
  intro: 'Muita coisa nova para você explorar:',
  fixes: [
    'NOVA TEMPORADA: ÊXODO! Três capítulos novos: Moisés do Nilo à sarça, o Mar Vermelho e a aliança no Sinai. Ganhe Joquebede, Miriã e Bezalel.',
    'NOVO: ARENA ONLINE 1x1 e 2x2! Desafie um amigo ou jogue em duplas, 2 contra 2, cada um no seu celular.',
    'NOVO: Configurações (⚙️ no lobby): volume da música, efeitos e dublagem, lembretes, sua conta e texto grande.',
    'NOVO: AMIGOS! Pesquise pelo apelido ou pelo código de amigo, mande pedidos e chame seus amigos para a Arena.',
    'NOVO: Ranking da Temporada. Ganhe Pontos de Temporada jogando; o ranking recomeça toda segunda-feira. Seus troféus e conquistas continuam seus para sempre.',
    'Passe de batalha com tema da temporada e 5 missões com recompensas.',
    'Loja: nova vitrine de Personalização com títulos, rastros e molduras.',
    '8 personagens novos para colecionar: Arão, Neemias, Jeremias e Estêvão (épicos); Jó, Enoque, Nabucodonosor e A Estátua do sonho de Daniel 2 (lendários).',
    'Minijogos novos: "Quem disse?" e "Pares", além de novos desafios no Êxodo.',
    'Letras mais fáceis de ler, caça-palavras maior e sem tempo, e botões ajustados para caber em qualquer tela.',
  ],
  outro: 'Em breve chegam mais atualizações, sempre buscando melhorias. Obrigado por jogar e por nos ajudar!',
};

export function showNews() {
  let seen = '';
  try { seen = localStorage.getItem(SEEN_KEY) || ''; } catch { /* storage blocked */ }
  if (seen === NEWS.id || document.getElementById('news')) return;
  if (NEWS.until && Date.now() >= Date.parse(NEWS.until)) return;
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
