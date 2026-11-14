# Gênesis

Jogo de navegador para celular, que funciona com o aparelho deitado ou em pé, que convida o grupo de jovens a ler o livro de Gênesis. Feito pela Órbita Virtual.

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
| `src/scenes/` | As telas: abertura, login, escolha de personagem, mapa, história, desafio, álbum e painel do líder |
| `src/challenges/` | Os 4 desafios, cada um num arquivo separado |
| `src/ui/` | As peças de interface |
| `src/save/` | O salvamento automático no celular |
| `src/assets/` | A lista de imagens, o carregamento e os retângulos provisórios |
| `content/` | O conteúdo do jogo: personagens, capítulos, mapas e medalhas, todos em JSON |
| `assets/` | As artes. A lista completa está em [ASSETS.md](ASSETS.md) |

## Mapas

Cada mapa é um arquivo em `content/maps/` no formato do Tiled, com as camadas `ground`, `objects`, `collision` (1 = parede) e `triggers`. Em `genesis` ficam o nome, a imagem de fundo, o ponto de partida e as animações do lugar (`ambient`): água, brilhos, fogo, borboletas, pólen, poeira, folhas, fumaça, faíscas, nuvens e pássaros.

## Como acrescentar um livro novo (por exemplo, Êxodo)

1. Coloque um arquivo de capítulo em `content/chapters/` e acrescente-o em `content/chapters/index.json`.
2. Coloque o mapa em `content/maps/`.
3. Acrescente as artes em `assets/` e em `assets/manifest.json`.

O código do jogo não muda.

## Segurança

- Nenhum segredo fica neste repositório, e o jogo não envia dados de ninguém para fora do celular.
- O apelido é limpo antes de ser salvo: só letras sem acento, números e `_`, de 3 a 16 caracteres.
- Se o jogador limpar os dados do navegador ou trocar de celular, o progresso começa de novo.

## Fases

1. Esqueleto, lista de artes e retângulos provisórios ✅
2. Apelido e salvamento automático no celular ✅ (sem login, por decisão do líder)
3. Mapa, joystick e colisão ✅ (com água, fogo, borboletas e brilhos animados)
4. Uma parada com história e um desafio
5. Os outros três desafios
6. Álbum, medalhas e níveis
7. Painel do líder
8. Conteúdo dos capítulos 0 a 4
9. Acabamento e testes no celular
