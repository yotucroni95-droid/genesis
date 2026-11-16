# Gênesis

Jogo de navegador para celular, jogado **com o aparelho deitado**, que convida o grupo de jovens a ler o livro de Gênesis. Feito pela Órbita Virtual.

- Não precisa instalar: abre direto no navegador do celular.
- Página estática hospedada no GitHub Pages. Não tem login nem servidor: cada jogador escolhe um apelido e o progresso fica guardado no próprio celular (localStorage).
- Código em JavaScript puro, com módulos, Canvas 2D e CSS. Não há etapa de compilação.

## Como abrir no computador

O jogo precisa ser aberto por um servidor (abrir o `index.html` com dois cliques não funciona). Na pasta do jogo:

```bash
python3 -m http.server 8080
```

Depois abra http://localhost:8080 no navegador. No computador, dá para andar com WASD ou com as setas. Para ver onde o personagem bate, abra com `?debug=1` no fim do endereço.

## Como as pastas estão organizadas

| Pasta | O que tem |
|---|---|
| `index.html`, `css/` | A página e o visual |
| `src/engine/` | O ritmo do jogo (60 quadros por segundo), a tela e a troca de telas |
| `src/input/` | O joystick e o teclado |
| `src/world/` | O mapa, a câmera, a colisão, o jogador e as paradas |
| `src/scenes/` | As telas: abertura, apelido, escolha de personagem, mapa, história, desafio e álbum |
| `src/challenges/` | Os 4 desafios, cada um num arquivo separado |
| `src/ui/` | As peças de interface |
| `src/save/` | O salvamento automático no celular |
| `src/assets/` | A lista de imagens, o carregamento e os retângulos provisórios |
| `content/` | O conteúdo do jogo: personagens, capítulos, mapas e medalhas, todos em JSON |
| `assets/` | As artes. A lista completa está em [ASSETS.md](ASSETS.md) |

## Mapas

Cada mapa é um arquivo em `content/maps/` no formato do Tiled, com as camadas `ground`, `objects`, `collision` (1 = parede) e `triggers`. Em `genesis` ficam o nome, a imagem de fundo, o ponto de partida e as animações do lugar (`ambient`): água, brilhos, fogo, borboletas, pólen, poeira, folhas, fumaça, faíscas, nuvens e pássaros.

## Capítulos e desafios

Cada capítulo é um arquivo em `content/chapters/` com o mapa, os personagens que libera, a medalha, os personagens que aparecem no mapa (`npcs`) e as paradas. Cada parada tem posição (em peças do mapa), título, texto da história (`story`, com quem fala), versículo, desafio (`challenge.type` + `config`) e recompensas.

Todo desafio fica em `src/challenges/` e segue a mesma regra: `start(config, env)` devolve uma promessa com `{ success, score }`.

## Como acrescentar um livro novo (por exemplo, Êxodo)

1. Coloque um arquivo de capítulo em `content/chapters/` e acrescente-o em `content/chapters/index.json`.
2. Coloque o mapa em `content/maps/`.
3. Acrescente as artes em `assets/` e em `assets/manifest.json`.

O código do jogo não muda.

## Modo viciante (Fase 10)

- **Lobby:** personagem grande no centro, patente, troféus e talentos, botões JOGAR, Arena, Baús, Missões, Loja, Coleção e Personagens.
- **Estrelas** (1 a 3) em cada parada, **talentos** (moeda do jogo, sem dinheiro de verdade), **troféus** e **patentes** (Bronze I até Lendário).
- **Baús** Comum, Raro, Épico e Lendário com abertura animada; mais troféus = mais chance de baú raro. Baú grátis a cada 6 horas.
- **Missões diárias** e **sequência de dias**; **Arena** (Desafio Relâmpago) com combo e recorde.
- **Coleção** de 40 cartas de versículo, **títulos** e **molduras** para o perfil.
- Regras em `src/game/economy.js`; conteúdo em `content/verses.json`, `content/cosmetics.json` e `content/arena.json`.

## Vida nos mapas, som e narrador (Fase 11)

- **Personagens falam** quando o jogador chega perto (`talk` em cada NPC do capítulo). Os tentadores (`tempter: true`) mostram o botão **Resistir**, que responde com um versículo (`resist`) e dá talentos uma vez por dia.
- **5 pergaminhos escondidos** por mapa, em lugares sorteados a cada dia; prêmio sorteado em cada um e baú ao achar os 5 (`src/world/scrolls.js`).
- **Sons e música** gerados pelo próprio jogo (`src/audio/audio.js`), com botão 🔊/🔇 que silencia tudo (inclusive o narrador).
- **Comemoração em tela cheia** ao subir de patente, liberar personagem, concluir capítulo e achar os pergaminhos.
- **Compartilhar no WhatsApp**: imagem com patente, troféus, estrelas e recorde + link (`src/ui/share.js`).
- **Versículo do dia** com pergunta de completar a palavra (`src/scenes/daily.js`).
- **Narrador e vozes**: 166 falas gravadas com vozes brasileiras do Kokoro (skill media-use), com pausas humanizadas — narrador e Deus (Santa), homens (Alex), Eva e anjos fiéis (Dora), Lúcifer/serpente/anjos caídos (mistura). Ficam em `assets/voice/` e são listadas em `content/voices.json`. Para regenerar depois de mudar um texto: `~/.local/kokoro-venv/bin/python tools/narrate.py .` (precisa do Kokoro instalado no Mac).

## Atualizações e modo sem internet

O arquivo `sw.js` guarda o jogo no celular. Com internet, ele sempre busca a versão mais nova do código e do conteúdo; sem internet, usa o que já guardou. As imagens são reaproveitadas e atualizadas em segundo plano.

## Segurança

- Nenhum segredo fica neste repositório, e o jogo não envia dados de ninguém para fora do celular.
- O apelido é limpo antes de ser salvo: só letras sem acento, números e `_`, de 3 a 16 caracteres.
- Se o jogador limpar os dados do navegador ou trocar de celular, o progresso começa de novo.

## Fases

1. Esqueleto, lista de artes e retângulos provisórios ✅
2. Apelido e salvamento automático no celular ✅ (sem login, por decisão do líder)
3. Mapa, joystick e colisão ✅ (com água, fogo, borboletas e brilhos animados)
4. Paradas com história, quiz, recompensas e o Capítulo 0 completo ✅
5. Os outros três desafios: memória, jogo da velha e quebra-cabeça ✅
6. Álbum, medalhas, níveis e escolha de personagem ✅
7. ~~Painel do líder~~ (retirado: sem servidor, cada um vê o próprio álbum)
8. Conteúdo dos capítulos 0 a 4 ✅ (17 paradas)
9. Acabamento: funciona sem internet, sempre pega a versão nova, ícone para a tela inicial, dica do joystick ✅

## Temporada 2 (novembro de 2026)

- **Desafios que mudam**: ao repetir uma parada, o jogo sorteia outro desafio (`src/game/variety.js`) com perguntas do banco `content/questions.json` (quiz, verdadeiro ou falso, ordem certa, caça-palavras, complete o versículo). Fica mais difícil a cada repetição.
- **Modo Herói**: capítulo concluído ganha o botão ⚔️ na Jornada. Desafios difíceis, sem a história, com o dobro de talentos e denários.
- **Personagens raros por fragmentos** (`content/characters.json`, campo `rarity` e `power`): fragmentos liberam (comum 20, raro 30, épico 45, lendário 70). Jesus é "único": 1 em 500 no baú Lendário, ou quando o jogador tem todos os outros. Enquanto a arte não chega, o manifest marca `"pending": true` e o boneco usa o Peregrino tingido.
- **Lamparina (ofensiva)**, **missões da semana**, **Passe da Fé** (30 níveis, temporada de 28 dias) e **ofertas da Loja**: `src/game/meta.js`.
- **Desafiar amigo**: o botão da Arena manda um link `?desafio=semente.pontos.apelido`; quem abre responde às mesmas perguntas.
- **100% offline**: `sw.js` baixa tudo o que está em `precache.json`. **Depois de acrescentar ou remover arquivos, rode** `python3 tools/make_precache.py`, e aumente `VERSION` no `sw.js` quando o código mudar.
