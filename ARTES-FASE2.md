# Artes da Fase 2 — Fuga, pets e minijogos

**Prompt-base (mande primeiro, anexando a imagem do Peregrino):**
> Pixel art 16-bit, estilo chibi, contornos escuros de 1 px, paleta viva e quente, mesma identidade visual desta imagem (o Peregrino do jogo Gênesis). Visão de cima (top-down) levemente inclinada. Sem texto, sem letras, sem marca d'água. Pixels nítidos, sem desfoque, sem anti-aliasing.

**Regras de fundo:**
- **Sprites e ícones:** fundo roxo liso **#8000FF**, que o jogo remove sozinho.
- **Tilesets e cenários:** sem fundo roxo, com as peças encostadas uma na outra.

**Grade:** gere sempre no tamanho pedido, com os quadros alinhados à grade e sem espaço entre eles.

---

## LOTE A — Fuga: Jardim da Resistência (urgente)

| # | Arquivo | Tamanho | Quadros | Fundo |
|---|---|---|---|---|
| A1 | `assets/characters/serpente_sheet.png` | 192×192 | 4×4 de 48×48. Linhas: baixo, esquerda, direita, cima. 4 quadros rastejando por linha. | #8000FF |
| A2 | `assets/characters/serpente_fx.png` | 192×144 | 4×3 de 48×48. Linha 1: perseguindo (olhos vermelhos, boca aberta). Linha 2: surgindo do chão em fumaça escura. Linha 3: atordoada, recuando. | #8000FF |
| A3 | `assets/maps/fuga_jardim_tiles.png` | 128×128 | 8×8 peças de 16×16 (lista abaixo). | sem fundo |
| A4 | `assets/maps/fuga_objetos.png` | 256×64 | 8×2 de 32×32 (lista abaixo). | #8000FF |

**A1:**
> [prompt-base] Folha de sprites de uma serpente do Éden para jogo infantil: verde-escura com escamas douradas, olhos amarelos, astuta mas não assustadora demais, sem sangue. Grade 4×4 de quadros 48×48: cada linha uma direção (baixo, esquerda, direita, cima), 4 quadros de rastejar ondulando. Fundo roxo liso #8000FF.

**A2:**
> [prompt-base] Efeitos da mesma serpente, grade 4×3 de 48×48: linha 1 perseguindo (olhos vermelhos brilhando, boca aberta, corpo esticado); linha 2 surgindo de um círculo de fumaça roxo-escura no chão (do círculo vazio até a serpente inteira); linha 3 atordoada, com estrelinhas, recuando. Fundo roxo #8000FF.

**A3** (da esquerda para a direita, de cima para baixo):
- **Linha 1:** grama 1, grama 2, grama 3, grama com flores amarelas, grama com flores rosas, terra 1, terra 2, terra com pedrinhas.
- **Linha 2:** sebe (topo), sebe (frente), sebe (canto esquerdo), sebe (canto direito), sebe (ponta), árvore frutífera (parte de cima), árvore (tronco), moita redonda de esconder.
- **Linha 3:** água 1, água 2, borda da água (cima), borda (baixo), borda (esquerda), borda (direita), pedra grande, toco.
- **Linha 4:** piso de pedra clara, piso de pedra escura, ladrilho da praça 1, ladrilho 2, degrau, mureta, fonte (canto), fonte (água).
- **Linha 5:** portal dourado fechado (topo), portal fechado (base), portal aberto brilhando (topo), portal aberto (base), trepadeira espinhosa de bloqueio 1, trepadeira 2, sombra suave, marca de luz no chão.
- **Linhas 6 a 8:** variações livres de grama, terra e flores para quebrar a repetição.

> [prompt-base] Tileset 16×16 de um jardim bíblico (Éden) para jogo top-down, 8×8 peças que se encaixam lado a lado, sem fundo: [cole a lista acima].

**A4** (32×32 cada):
- **Linha 1:** pedestal de tarefa apagado, pedestal aceso (luz dourada), placa de pressão apagada, placa acesa, pergaminho brilhante (fragmento), semente brilhante, pedra do memorial, baú de tarefa.
- **Linha 2:** alavanca para cima, alavanca para baixo, lâmpada a óleo apagada, lâmpada acesa, selo da aliança, árvore pequena de tarefa, placa de madeira em branco, estrela de tarefa concluída.

---

## LOTE B — Interface da Fuga (deixa o modo com cara profissional)

| # | Arquivo | Tamanho | Conteúdo | Fundo |
|---|---|---|---|---|
| B1 | `assets/ui/fuga_icons.png` | 256×32 | 8 ícones 32×32: pergaminho (tarefas), ampulheta (tempo), grupo (equipe), escudo dourado (proteção), olho (espectador), portal, serpente (perigo), sinal de internet | #8000FF |
| B2 | `assets/ui/fuga_menu_bg.png` | 960×540 | Cena de fundo do menu da Fuga: entrada de um jardim ao entardecer, portal dourado ao longe, uma serpente escondida entre as folhas, espaço livre no centro para os botões | sem fundo |
| B3 | `assets/ui/fuga_cards.png` | 576×192 | 3 cartões 192×192: Treino (broto), Sala pública (globo com pessoas), Sala privada (cadeado com chave) | #8000FF |
| B4 | `assets/ui/fuga_captura.png` | 480×270 | Moldura do desafio de captura: pergaminho com borda vermelha e espinhos, sombra da serpente no canto, centro vazio para o texto | #8000FF |
| B5 | `assets/ui/fuga_resultado.png` | 768×192 | 3 faixas 256×192: VITÓRIA (portal aberto, luz, pombas), DERROTA (jardim escurecido, serpente enrolada), ELIMINADO (personagem envolto em névoa, coração rachado) | #8000FF |
| B6 | `assets/ui/fuga_fx.png` | 256×128 | 8×4 quadros 32×32. Linha 1: escudo de proteção girando. Linha 2: brilho de tarefa concluída. Linha 3: aviso de aparição (círculo vermelho pulsando). Linha 4: confete de vitória. | #8000FF |
| B7 | `assets/ui/minimapa_moldura.png` | 96×96 | Moldura do minimapa (madeira com folhas), centro transparente | #8000FF |

> [prompt-base] [descrição da tabela]. Elementos de interface de jogo, sem nenhum texto escrito. Fundo roxo #8000FF quando indicado.

---

## LOTE C — Pets (21 pets, 2 imagens cada)

- **Folha:** `assets/pets/<id>_sheet.png`, 128×160, grade 4×5 de 32×32, fundo #8000FF.
  - Linhas: 1 andando para baixo; 2 andando de lado (virado para a direita); 3 andando para cima; 4 descansando (deitado, respirando); 5 comemorando (pulando com brilhos).
- **Retrato:** `assets/pets/<id>_face.png`, 64×64, rosto e corpo de frente, fundo #8000FF.

**Prompt (troque [ANIMAL] e [DETALHE]):**
> [prompt-base] Pet chibi muito fofo de [ANIMAL], [DETALHE], olhos grandes e brilhantes, do tamanho de um bichinho de estimação ao lado do personagem. Folha de sprites 4×5 de 32×32: linha 1 andando para baixo, linha 2 andando de lado virado para a direita, linha 3 andando para cima, linha 4 descansando deitado, linha 5 comemorando pulando com brilhinhos. Fundo roxo #8000FF.

**Retrato:**
> [prompt-base] Retrato 64×64 do mesmo pet chibi de [ANIMAL], [DETALHE], de frente, sorrindo. Fundo roxo #8000FF.

| id | [ANIMAL] | [DETALHE] |
|---|---|---|
| ovelhinha | ovelhinha | lã branca bem fofinha |
| cordeirinho | cordeirinho | bebê, laço azul no pescoço |
| pardal | pardal | marrom, pequenino |
| formiguinha | formiguinha | carregando uma folha verde |
| abelinha | abelhinha | listrada, segurando uma gotinha de mel |
| codorninha | codorna | redondinha, penas pintadas |
| peixinho | peixinho dourado | flutuando no ar com bolhinhas |
| cabritinho | cabritinho | chifrinhos e sininho |
| bezerrinho | bezerrinho | malhado de marrom e branco |
| carneirinho | carneirinho | chifres enrolados |
| jumentinho | jumentinho | cinza, orelhas compridas |
| boi | boizinho | marrom, cangazinha de madeira |
| pombinha | pombinha branca | ramo de oliveira no bico |
| corvo | corvo | preto com brilho azulado, levando um pãozinho |
| gazela | gazela | chifres finos, saltitante |
| cervo | cervo | galhada pequena, pescoço longo |
| camelo | camelo | duas corcovas, manta listrada vermelha |
| cavalo | cavalo branco | crina dourada |
| aguia | águia | asas abertas, marrom e branca |
| leaozinho | filhote de leão (de Daniel) | jubinha dourada, coroa de luz sutil |
| grande_peixe | baleia azul (de Jonas) | flutuando, jato de água em forma de coração |

**C22:** `assets/icons/pets.png`, 32×32, fundo #8000FF. Ícone do botão Pets do lobby: patinha dourada com uma ovelhinha.

---

## LOTE D — Minijogos

| # | Arquivo | Tamanho | Conteúdo | Fundo |
|---|---|---|---|---|
| D1 | `assets/minigames/labirinto_tiles.png` | 128×32 | 4 peças 32×32: chão de pedra, parede de sebe, pergaminho brilhante, portal de saída | sem fundo |
| D2 | `assets/minigames/labirinto_saida.png` | 64×32 | 2 quadros 32×32: saída trancada (cadeado), saída aberta (luz) | #8000FF |
| D3 | `assets/minigames/armadura_pecas.png` | 384×64 | 6 ícones 64×64, um para cada peça de Efésios 6: cinto da verdade, couraça da justiça, calçados da paz, escudo da fé, capacete da salvação, espada do Espírito | #8000FF |
| D4 | `assets/minigames/armadura_ataques.png` | 256×64 | 4 quadros 64×64: seta inflamada, nuvem escura de dúvida, máscara de mentira, corrente de tentação | #8000FF |
| D5 | `assets/minigames/armadura_fundo.png` | 960×540 | Campo de batalha espiritual ao amanhecer: muralha de luz à frente, nuvens escuras ao fundo, espaço livre no centro | sem fundo |

> [prompt-base] [descrição da tabela]. Itens bíblicos para crianças, heroicos e luminosos, sem violência gráfica. Fundo roxo #8000FF quando indicado.

---

## LOTE E — Fase 3 (depois do Lote A)

| # | Arquivo | Tamanho | Conteúdo |
|---|---|---|---|
| E1 | `assets/characters/anjo_caido_sheet.png` | 192×192 (4×4 de 48) | Anjo caído: asas escuras rasgadas, armadura opaca, olhar sombrio, adequado para crianças. Linhas: baixo, esquerda, direita, cima. Fundo #8000FF |
| E2 | `assets/characters/anjo_caido_fx.png` | 192×144 | Mesma organização da A2: perseguindo, surgindo em sombra, atordoado |
| E3 | `assets/characters/lucifer_sheet.png` | 192×192 | Lúcifer: anjo de luz corrompido, imponente, coroa partida, capa escura com brilho frio. Mesma grade |
| E4 | `assets/characters/lucifer_fx.png` | 192×144 | Perseguindo, aparição em relâmpago escuro, recuando diante da luz |
| E5 | `assets/maps/fuga_deserto_tiles.png` | 128×128 (16×16) | Deserto das Provações: areia ×3, dunas, rochas, cactos, oásis com água, tendas, ossos de animal, ruínas de pedra, portal dourado fechado e aberto, tempestade de areia de bloqueio |
| E6 | `assets/maps/fuga_confronto_tiles.png` | 128×128 (16×16) | Confronto Final: ruínas de templo, colunas, chão rachado com luz, fendas de sombra, tochas, escadarias, portal celestial fechado e aberto, barreira de sombra de bloqueio |
| E7 | `assets/maps/fuga_objetos_2.png` | 256×64 (8×2 de 32) | Objetos de tarefa do Deserto e do Confronto: jarro de água, maná, cajado, tábuas da lei, trombeta, lâmpada, coroa, chave |

---

## LOTE F — Ícones que ainda aparecem como emoji (tiram a "cara de amador")

Todos 32×32, fundo #8000FF, estilo dos ícones atuais do lobby (contorno escuro, dourado e cores vivas).

| # | Arquivo | Onde aparece | Desenho |
|---|---|---|---|
| F1 | `assets/icons/amigos.png` | Botão Amigos do lobby (hoje 👥) | Dois bonequinhos chibi lado a lado, um de túnica azul e outro de túnica verde, com coraçãozinho dourado em cima |
| F2 | `assets/icons/fuga.png` | Botão FUGA do lobby (hoje 🏃) | Bonequinho correndo em direção a um portal dourado em arco, rastro de poeira |
| F3 | `assets/icons/celular.png` | Botões Compartilhar, Convidar e Desafiar amigos (hoje 📲) | Celular com tela verde-clara e uma seta curva saindo dele |
| F4 | `assets/icons/sabado.png` | Faixa "Feliz sábado" do lobby (hoje 🕊️) | Pomba branca com ramo de oliveira, sol se pondo laranja atrás |
| F5 | `assets/ui/sabado_pomba.png` (**64×64**) | Janela do Modo Sábado | A mesma pomba, maior, asas abertas, luz suave dourada |
| F6 | `assets/ui/amigos_icons.png` (**256×32**, 8 de 32×32) | Lista de amigos | 1 bolinha verde brilhante (online); 2 bolinha cinza (offline); 3 lupa (buscar); 4 dois raios cruzados (desafio 1x1); 5 quatro bonequinhos (2x2); 6 bonequinho correndo (convite da Fuga); 7 bonequinho com sinal de menos vermelho (remover); 8 três pontinhos dourados (menu) |
| F7 | `assets/icons/labirinto.png` | Minijogo Labirinto da Fé | Labirinto de sebe visto de cima com um pergaminho brilhando no centro |
| F8 | `assets/icons/armadura.png` | Minijogo Armadura de Deus | Escudo dourado com cruz e um capacete atrás |

> [prompt-base] Ícone de interface de jogo 32×32: [Desenho da tabela]. Legível em tamanho pequeno, poucas cores, sem texto. Fundo roxo liso #8000FF.

Para o F6: "Folha com 8 ícones 32×32 lado a lado, sem espaço entre eles: [lista]".

---

**Como me entregar:** mande as imagens aqui na conversa com o código do item (A1, C-ovelhinha, …). Eu recorto, coloco nos caminhos e troco os desenhos provisórios.
**Ordem que mais melhora o jogo:** F1–F4 (lobby) → A1–A4 → B1–B7 → C (comece por ovelhinha, cordeirinho e leaozinho) → D → E.
