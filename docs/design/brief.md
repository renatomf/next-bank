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
| Navegação inferior flutuante em pílula, com ação central em destaque | Features fora da V1 (cartões, TED, agendamento) |
| Títulos grandes com segunda linha mais leve | Cor de marca usada como texto em fundo claro |
| Botão primário em pílula com seta ↗ | Status (sucesso) na mesma cor da marca |

## 2. Cores

### 2.1 Marca

| Token | Valor | Uso |
|---|---|---|
| `brand.mint` | `#00FFC8` | Cor de marca: botões (dark), ação central, glow, logo |
| `brand.mintDeep` | `#007A6A` | Menta para texto, links e ícones no light (5.3:1 sobre branco) |
| `brand.mintInk` | `#006B5D` | Texto sobre chips Menta claros |

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
| `accent` | `#00FFC8` | `#007A6A` | Links, ícones e textos de destaque |
| `accentSoft` | `rgba(0,255,200,0.12)` | `rgba(0,255,200,0.22)` | Fundo de chips e ícones de entrada |
| `selectedBorder` | `rgba(0,255,200,0.55)` | `#007A6A` | Borda de item selecionado |
| `primary` | `#00FFC8` | `#0A0F14` | Fundo do botão primário e da ação central |
| `onPrimary` | `#0A0F14` | `#00FFC8` | Texto e ícone sobre `primary` (14.8:1) |
| `success` | `#C4F27A` | `#3B6E0E` | Status concluído |
| `successSoft` | `rgba(196,242,122,0.12)` | `rgba(120,190,40,0.16)` | Fundo do selo de status |
| `danger` | `#FF6B6B` | `#C62828` | Erro, falha (a validar na semana 6) |
| `navBg` | `rgba(18,26,33,0.88)` + blur 16 | `rgba(255,255,255,0.92)` + blur 16 | Navegação flutuante |
| `glow` | Menta a 10%, radial no topo | Menta a 22%, radial no topo | Brilho ambiente no fundo |

### 2.3 Card de saldo (assinatura, igual nos dois modos)

Sempre escuro. Camadas, de cima para baixo:

1. Radial Menta 75% no canto superior direito
2. Radial `#00BEA0` 65% no canto inferior esquerdo
3. Faixa diagonal clara (efeito de seda) a 16%
4. Base linear `#0B2A26 → #06110F`
5. Borda `rgba(0,255,200,0.22)`; sombra `0 18 50 -12 rgba(0,255,200,0.35)`
6. Painel de vidro `rgba(6,12,14,0.62)` + blur 14 para o saldo (garante contraste do texto)

No Flutter, a primeira versão usa gradientes empilhados. Evolução opcional: fragment shader com a seda em movimento lento.

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

Valores monetários sempre separam "R$", inteiro e centavos em estilos diferentes.

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

Wordmark **"next"** em Sora 700, tracking −4%, seguido de um ponto Menta com glow. Identidade 100% própria: nenhum elemento de logos de outras instituições.

## 7. Componentes validados nos mockups

| Componente | Onde aparece |
|---|---|
| `IconCircleButton` (44, borda, superfície) | Cabeçalhos |
| `ActionTile` (84 de altura, raio 20) | Atalhos da Home |
| `BalanceCard` (com ocultar saldo) | Home |
| `AmountCard` | Pix |
| `TransactionItem` (ícone em círculo, título, legenda, valor com sinal) | Home, Extrato |
| `SegmentedControl` em pílula | Pix |
| `ContactCard` selecionável + `ContactChip` | Pix |
| `TextField` com label | Pix |
| `PrimaryButton` (pílula 56, seta ↗) e `SecondaryButton` | Pix, Comprovante |
| `StatusBadge` | Comprovante |
| `ReceiptCard` (divisórias tracejadas, ID em mono) | Comprovante |
| `FloatingNavBar` com ação central | Home |
| `SecureHint` (cadeado + texto) | Pix |

## 8. Acessibilidade

- Contraste mínimo AA em todo texto; valores verificados neste documento.
- Botões só com ícone sempre têm rótulo semântico (`Semantics(label: …)`).
- Respeitar a escala de fonte do sistema até 1.3× sem quebrar o layout.
- Status nunca depende só de cor: sempre ícone + texto.
