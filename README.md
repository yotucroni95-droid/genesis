# Gênesis

Jogo de navegador para celular, que funciona com o aparelho deitado ou em pé, que convida o grupo de jovens a ler o livro de Gênesis. Feito pela Órbita Virtual.

- Não precisa instalar: abre direto no navegador do celular.
- Página estática hospedada no GitHub Pages. O login e o salvamento usam o Supabase (a partir da Fase 2).
- Código em JavaScript puro, com módulos, Canvas 2D e CSS. Não há etapa de compilação.

## Como abrir no computador

O jogo precisa ser aberto por um servidor (abrir o `index.html` com dois cliques não funciona). Na pasta do jogo:

```bash
python3 -m http.server 8080
```

Depois abra http://localhost:8080 no navegador. No computador, dá para andar com WASD ou com as setas (a partir da Fase 3).

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
| `src/save/` | O login, o salvamento automático e a fila de envio quando não há internet |
| `src/assets/` | A lista de imagens, o carregamento e os retângulos provisórios |
| `content/` | O conteúdo do jogo: personagens, capítulos, mapas e medalhas, todos em JSON |
| `assets/` | As artes. A lista completa está em [ASSETS.md](ASSETS.md) |
| `supabase/migrations/` | O arquivo que cria as tabelas (Fase 2) |

## Como acrescentar um livro novo (por exemplo, Êxodo)

1. Coloque um arquivo de capítulo em `content/chapters/` e acrescente-o em `content/chapters/index.json`.
2. Coloque o mapa em `content/maps/`.
3. Acrescente as artes em `assets/` e em `assets/manifest.json`.

O código do jogo não muda.

## Segurança

- Nenhum segredo fica neste repositório. A única chave no jogo é a chave pública (*anon*) do Supabase, que foi feita para ser pública.
- A proteção dos dados vem das regras de acesso do banco (Row Level Security), no arquivo de `supabase/migrations/`.

## Fases

1. Esqueleto, lista de artes e retângulos provisórios ✅
2. Banco de dados no Supabase, login e salvamento automático
3. Mapa, joystick e colisão
4. Uma parada com história e um desafio
5. Os outros três desafios
6. Álbum, medalhas e níveis
7. Painel do líder
8. Conteúdo dos capítulos 0 a 4
9. Acabamento e testes no celular
