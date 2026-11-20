# Como adicionar um mapa ou capítulo novo

Nada de código novo: um capítulo é só conteúdo (JSON + imagens). Siga a ordem.

## 1. Arte
- Fundo do mapa: `assets/maps/<mapa>.jpg` (960x640, 30x20 blocos de 32 px).
- Personagens novos: `assets/characters/<id>_sheet.png` e `assets/portraits/<id>.png`.
- Medalha do capítulo: `assets/medals/capitulo_<N>.png`.
- Registre cada arquivo em `assets/manifest.json` (ids `map.<mapa>`, `sheet.<id>`, `portrait.<id>`, `medal.capitulo_<N>`).
  Se um arquivo ainda não existir, o jogo desenha um substituto e não quebra.

## 2. Mapa (onde dá para andar)
- `content/maps/<mapa>.json` (formato Tiled, 30x20) e uma linha em `content/maps/index.json`.
- `tools/make_walk.py` gera a camada de colisão a partir da imagem; ajuste com `walkAdd` / `walkBlock` quando precisar.
- Paradas e NPCs ficam em blocos onde dá para andar.

## 3. Capítulo
- `content/chapters/cap<N>.json`: história, paradas (`stops`) e desafios. Os tipos de desafio
  disponíveis estão em `src/challenges/index.js` (quiz, memória, caça-palavras, ordem, V/F, versículo,
  quebra-cabeça, cesto, travessia, maná, sequência, lacunas, santuário…).
- Linha em `content/chapters/index.json`: `{ "id": "cap<N>", "number": N, "title": "...", "file": "chapters/cap<N>.json", "music": "eden" }`.
  `music` é opcional (ceu, eden, fora_eden, campos, arca, lobby, arena); sem ele vale a tabela antiga.
- Perguntas novas da Arena: `content/arena.json`; versículos: `content/verses.json`.

## 4. Vozes (opcional)
- `tools/narrate.py` gera as falas do capítulo (precisa da chave da ElevenLabs no computador, nunca no repositório).

## 5. Publicar
1. Suba `VERSION` em `sw.js` e o `?v=` do `index.html`.
2. `python3 tools/make_precache.py`.
3. Teste em `?debug=1` (celular deitado, 740x360).
4. Commit e push.
