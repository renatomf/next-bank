# next bank — Brief visual e Design Tokens

- **Status:** Aprovado (2026-10-05)
- **Mockups:** https://claude.ai/artifact/4PEwqAQm3w1pfLKW8TBa6F (Home, Pix, Comprovante — dark e light)
- **Referência:** um conceito de app bancário dark de terceiros, usado só como inspiração de estrutura (não copiado). A imagem fica apenas localmente em `docs/design/references/` (ignorada pelo git) por ser trabalho de outro designer.

## 1. Direção

**Dark, premium e luminoso.** Fundo quase preto, superfícies em camadas sutis, e a cor Menta como luz: ela brilha nos pontos de ação e no card de saldo, nunca inunda a tela.

| Aproveitamos da referência | Evitamos |
|---|---|
| Card de saldo com textura de seda e painel de vidro por cima | Logo, marca e cores de bancos reais |
| Atalhos em blocos arredondados com ícone + rótulo | Cópia literal de layout e textos |
| Navegação inferior encaixada no rodapé, com rótulo em cada destino e ação central em destaque (era flutuante em pílula até a semana 7; plano da semana 8, V4) | Features fora da V1 (cartões, TED, agendamento) |
| Títulos grandes com segunda linha mais leve | Cor de marca usada como texto em fundo claro |
| Botão primário em pílula com seta ↗ | Status (sucesso) na mesma cor da marca |

## 2. Cores

### 2.1 Marca

| Token | Valor | Uso |
|---|---|---|
| `brand.mint` | `#00FFC8` | Cor de marca: botões (dark), ação central, glow, logo |
| `brand.mintDeep` | `#007A6A` | Borda de item selecionado no light. Não serve para texto: fica abaixo do AA sobre `surface2` (4,47:1) e sob o brilho (4,46:1) |
| `brand.mintInk` | `#006B5D` | Menta para texto, links e ícones no light (`accent`) e texto sobre chips Menta claros; AA em todos os fundos claros |

### 2.2 Tema

| Token | Dark | Light | Observação |
|---|---|---|---|
| `bg` | `#0A0F14` | `#F2F6F6` | Fundo da tela |
| `surface` | `#121A21` | `#FFFFFF` | Cards, blocos, campos |
| `surface2` | `#1A242D` | `#E6EEEE` | Avatar, item ativo, segmento selecionado |
| `border` | `rgba(255,255,255,0.08)` | `rgba(10,15,20,0.08)` | Borda padrão de 1px |
| `divider` | `rgba(255,255,255,0.14)` | `rgba(10,15,20,0.16)` | Linhas tracejadas do comprovante |
| `text` | `#F2F6F8` | `#0A0F14` | Texto principal |
| `textMuted` | `#8A97A3` | `#4A5560` | Texto secundário (≥ 5.8:1 nos dois modos) |
| `accent` | `#00FFC8` | `#006B5D` | Links, ícones e textos de destaque |
| `accentSoft` | `rgba(0,255,200,0.12)` | `rgba(0,255,200,0.22)` | Fundo de chips e ícones de entrada |
| `selectedBorder` | `rgba(0,255,200,0.55)` | `#007A6A` | Borda de item selecionado |
| `primary` | `#00FFC8` | `#0A0F14` | Fundo do botão primário e da ação central |
| `onPrimary` | `#0A0F14` | `#00FFC8` | Texto e ícone sobre `primary` (14.8:1) |
| `success` | `#C4F27A` | `#3B6E0E` | Status concluído |
| `successSoft` | `rgba(196,242,122,0.12)` | `rgba(120,190,40,0.16)` | Fundo do selo de status |
| `danger` | `#FF6B6B` | `#C62828` | Erro, falha (a validar na semana 6) |
| `navBg` | `rgba(18,26,33,0.88)` + blur 16 | `rgba(255,255,255,0.92)` + blur 16 | Fundo da navegação (sem uso desde a barra encaixada, que usa `surface`) |
| `glow` | Menta a 10%, radial no topo | Menta a 22%, radial no topo | Brilho ambiente no fundo |

### 2.3 Card de saldo (assinatura, igual nos dois modos)

**Desde a v1.1.0 (checkpoint de 2026-10-14):** a seda (itens 1 a 4 abaixo) deu lugar à arte de vidro verde do desenvolvedor, colorizada para o menta da marca (`GlassArt`): a luminância de cada pixel vai de `#00241C` nas sombras a `#00FFC8` nas luzes, mantendo 20% da cor original para o vidro não perder profundidade; o pixel mais claro possível é `#33FFD3`. A mesma arte está no fundo da tela de desbloqueio e no card do valor do Pix. O layout do mockup continua ("Saldo" e o olho no alto; "Saldo disponível · Conta •••• 0004" e o valor no painel de vidro). Sobre a arte, uma tinta `#06110F`: a 78% no terço de cima, sob o título, e a 35% a partir de 60% da altura, onde o painel de vidro garante o contraste. No card do valor do Pix, os textos ficam direto sobre a arte, então a tinta é de 78% no card todo; ele tem o mesmo brilho menta embaixo (a sombra do item 5) e um olho ao lado do saldo, que mostra ou esconde o saldo junto com o da Home (MOB-05). Os testes provam AA em todo texto contra `#33FFD3`, qualquer que seja o recorte da imagem. A borda, a sombra, o vidro e as cores de texto abaixo continuam.

Sempre escuro, 190 de altura (cresce com texto maior). O mockup tem 214; o desenvolvedor reduziu para 190 na conferência no celular (semana 6). Camadas do mockup, de cima para baixo, com a geometria exata do CSS da Home:

1. Radial Menta 75%: `radial-gradient(70% 90% at 92% 8%)`, transparente a 60%
2. Radial `#00BEA0` 65%: `radial-gradient(60% 80% at 8% 105%)`, transparente a 65%
3. Faixa de seda `rgba(220,255,248,0.16)`: `linear-gradient(118deg)`, transparente a 38%, cheia a 48%, transparente a 58%
4. Base `linear-gradient(160deg, #0B2A26 0%, #06110F 70%)`
5. Borda `rgba(0,255,200,0.22)`; sombra `0 18 50 -12 rgba(0,255,200,0.35)`
6. Painel de vidro `rgba(6,12,14,0.62)` + blur 14, borda branca a 10%, a 12 da base e das laterais (garante contraste do texto)

Texto do card: saldo e logo `#F2F6F8`; rótulo, "R$" e centavos `#A9B6BF` (AA sobre o vidro mesmo nos pontos mais claros das luzes, provado em teste). Botão do olho: `rgba(10,15,20,0.45)`, borda branca a 14%, ícone 18.

No Flutter, os gradientes são empilhados e desenhados com a geometria do CSS (elipses, ângulos e paradas sobre a caixa real), para baterem com o mockup em qualquer largura. O Impeller não faz *dithering* em gradientes, e degradês suaves sobre fundo escuro mostram faixas no aparelho (F-19). Por isso, o brilho da tela recebe um granulado de 1 px em modo *overlay* (`Dither`), que esconde as faixas sem mudar a cor média; o card, desde que usa a arte, não precisa mais dele.

## 3. Tipografia

| Papel | Fonte | Peso | Tamanho / altura |
|---|---|---|---|
| Display (título da Home) | Sora | 600 + 400 na 2ª linha | 30 / 1.15, tracking −3% |
| Valor grande | Sora | 600 (centavos e "R$" em 500, menores e em `textMuted`) | 34–44, tracking −3% |
| Título de tela | Sora | 600 | 22 |
| Título de seção | Sora | 600 | 17 |
| Corpo | Manrope | 600–700 | 14–15 |
| Legenda | Manrope | 400–600 | 12–13 |
| Rótulo em caixa alta | Manrope | 700, tracking +8% | 11 |
| IDs técnicos | JetBrains Mono | 500 | 12 |

Valores monetários sempre separam "R$", inteiro e centavos em estilos diferentes. No card de saldo: "R$" 18, inteiro 34 e centavos 20, a 6 px um do outro, na mesma linha de base. Com o saldo oculto, a máscara `••••••` usa Manrope 800 (a Sora não tem o ponto) e mantém a altura de linha do inteiro, para o "R$" não se mexer ao tocar no olho.

## 4. Forma e espaço

| Token | Valor |
|---|---|
| Espaçamento base | 4 px (escala 4, 8, 12, 16, 20, 24, 28) |
| Margem lateral da tela | 20 |
| Espaço entre seções | 20–22 |
| Raio: botão, pílula, navegação | 999 |
| Raio: card de saldo e card grande | 28 |
| Raio: comprovante | 24 |
| Raio: blocos, listas, contatos | 20 |
| Raio: campo de texto | 16 |
| Raio: avatar de contato | 14 |
| Botão primário | altura 56 |
| Alvo de toque mínimo | 44 × 44 |

## 5. Ícones

Lucide (traço 1.8; 2–3 nos ícones de check e seta dentro de botões). Ícone do Pix: losango duplo genérico. A marca oficial do Pix só entra se seguir o manual do Banco Central.

## 6. Logo

Wordmark **"next"** em Sora 700, tracking −4%, seguido de um ponto Menta. Identidade 100% própria: nenhum elemento de logos de outras instituições.

Por decisão do desenvolvedor sobre o mockup, o ponto não tem glow e fica na linha de base, colado ao "t". Para o tamanho `size` do texto, o ponto tem diâmetro `size × 0,2`, fica a `size × 0,06` do "t" e desce e avança `size × 2/36` (2 px no tamanho 36).

## 7. Componentes validados nos mockups

| Componente | Onde aparece |
|---|---|
| `IconCircleButton` (44, borda, superfície) | Cabeçalhos |
| `ActionTile` (84 de altura, raio 20) | Atalhos da Home |
| `BalanceCard` (com ocultar saldo) | Home |
| `AmountCard` | Pix |
| `TransactionItem` (ícone em círculo de 36, título 14 em uma linha, legenda 12, valor com sinal; medidas ajustadas pelo desenvolvedor no celular, semana 6) | Home, Extrato |
| `SegmentedControl` em pílula | Pix |
| `ContactCard` selecionável + `ContactChip` | Pix |
| `TextField` com label | Pix |
| `PrimaryButton` (pílula 56, seta ↗) e `SecondaryButton` | Pix, Comprovante |
| `StatusBadge` | Comprovante |
| `ReceiptCard` (divisórias tracejadas, ID em mono) | Comprovante |
| `NbNavBar` com ação central e rótulos (substituiu a `FloatingNavBar` na semana 8) | Início, Extrato, Segurança e Perfil |
| `SecureHint` (cadeado + texto) | Pix |

**Documentos na tela:** CPF sempre com os seis dígitos do meio, `***.456.789-**`, como a API devolve e o DICT do Pix mostra. Os mockups de Pix e comprovante usam `•••.842.•••-09`; vale a máscara da API (plano da semana 6, D7). Conta sempre com os quatro últimos dígitos: `•••• 0004`.

## 8. Acessibilidade

- Contraste mínimo AA em todo texto; valores verificados neste documento.
- Botões só com ícone sempre têm rótulo semântico (`Semantics(label: …)`).
- Respeitar a escala de fonte do sistema até 1.3× sem quebrar o layout.
- Status nunca depende só de cor: sempre ícone + texto.
