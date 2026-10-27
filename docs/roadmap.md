# next bank — Roadmap e Design de Arquitetura

- **Data:** 2026-10-05
- **Status:** Aprovado (brainstorming), versão 2
- **Fontes:** `bank-2-roadmap.txt`, `roadmap bank.txt`, `Roadmap completo.txt` + revisão de arquitetura inspirada em Nubank e C6 Bank

## 1. Objetivo

next bank é um banco fictício construído como **projeto de portfólio para vagas fullstack (web + mobile) no setor financeiro**. O projeto precisa demonstrar, com profundidade, quatro coisas:

1. **Mobile:** app Flutter com arquitetura limpa, Design System próprio e segurança mobile.
2. **Web:** backoffice em Next.js com regras operacionais reais.
3. **Backend:** API TypeScript com DDD, arquitetura hexagonal e integridade financeira.
4. **Domínio financeiro:** ledger, PIX, idempotência, concorrência, conciliação e auditoria.

**Princípio:** profundidade em poucas coisas, não amplitude. Cada peça serve a uma única história:

> O cliente faz um PIX pelo app Flutter. O backend garante que não haja duplicidade nem saldo negativo. O Bacen (simulado) responde de forma assíncrona e às vezes falha. As divergências aparecem no backoffice Next.js, onde um operador resolve com dupla aprovação, tudo auditado.

**Referências de arquitetura (não de produto):** Nubank (Ports & Adapters, ledger imutável, eventos, UI dirigida pelo servidor) e C6 Bank (produto). Nenhuma marca, cor ou ativo visual é copiado.

**Premissas:** 6h/dia × 5 dias = 30h/semana. O Claude acelera boilerplate, testes, documentação e design. Decisões de arquitetura, modelagem financeira, threat model e revisão de código continuam com o desenvolvedor.

**Estado atual:** a pasta `nexus_bank` contém um app Flutter recém-criado pelo template, sem dependências e sem git. O nome antigo (Nexus) foi descartado; a renomeação para `next-bank` (pasta, `pubspec`, bundle IDs) acontece na semana 2, junto com a criação do monorepo.

## 2. Visão geral do cronograma

| Fase | Entrega | Prazo | Marco |
|---|---|---|---|
| **1. V1 Core** | App Flutter + API: Auth, Ledger, PIX interno, extrato, testes, CI, deploy | 8 semanas | `v1.0.0` → **começar as candidaturas** |
| **1.1 Produtos do dia a dia** | Pix por QR Code (pagar e receber), recarga de celular síncrona, comprovante compartilhado, biometria (desbloqueio e confirmação), cartão na Home (só interface), `FLAG_SECURE`, verificação automática do IP. Plano: `docs/plans/v1.1.0-produtos-do-dia-a-dia.md` | ~2,5 semanas | `v1.1.0` |
| **2. PIX assíncrono** | Simulador do Bacen (SPI/DICT), PIX externo, conta transitória, conciliação, tracing; o executor em segundo plano traz agendamentos, pagamentos recorrentes e débito automático | ~2–3 semanas | `v1.2.0` |
| **3. Backoffice** | Next.js: RBAC, dupla aprovação, fila de exceções da conciliação | ~2 semanas | `v1.3.0` |
| **4. Produtos do app** | Minhas chaves Pix e QR Code dinâmico; recarga assíncrona, boleto e contas de consumo com provedor simulado; cartão de crédito e fatura | ~2 semanas por versão | `v1.4.0` → `v2.0.0` |

> ✅ **Entregue:** `v1.1.0`, em 2026-10-21 ([Releases](https://github.com/renatomf/next-bank/releases/tag/v1.1.0)). O que entrou está no [CHANGELOG](../CHANGELOG.md), e o plano, em [v1.1.0-produtos-do-dia-a-dia.md](plans/v1.1.0-produtos-do-dia-a-dia.md).

**Nova ordem (2026-10-14):** depois da `v1.0.0`, a `v1.1.0` antecipa a parte mais simples da Fase 4, que um visitante da demo usa na primeira abertura; as Fases 2 e 3 andam uma versão. Nenhuma versão usa provedor real: o dinheiro só se move entre contas do next bank.

**Total:** ~12–13 semanas. Se tudo atrasar: V1 em 9–10 semanas e a Fase 3 passa para "Próximos passos" no README.

A Fase 4 não tem prazo: começa depois das Fases 2 e 3, já com as candidaturas em andamento, e cada versão só entra com o seu plano aprovado.

**Regra principal:** começar a se candidatar assim que a V1 estiver publicada. As Fases 2 e 3 acontecem em paralelo às entrevistas.

## 3. Decisões

| Decisão | Escolha | Motivo |
|---|---|---|
| Nome | **next bank** (logo em minúsculas) | Escolha do desenvolvedor. O README traz um aviso genérico de projeto fictício de portfólio |
| Repositório | Monorepo: pnpm workspaces + Turborepo (TypeScript) e pub workspaces (Flutter); o app atual vai para `apps/mobile` (ADR 0001) | Contratos, CI e versionamento num só lugar |
| Ordem de construção | Esqueleto ponta a ponta + fatias verticais | Integração descoberta cedo e sempre algo demonstrável |
| Design | Referências visuais → mockups HTML → tokens em Flutter (sem Figma) | Reduz o design de ~5 para ~2 dias |
| Ambientes | Um ambiente publicado (produção de demo) + local | Staging não agrega valor ao portfólio |
| Mobile | Só Flutter; sem app React Native | Um segundo app duplica esforço sem demonstrar nada novo; o React aparece no backoffice |
| Web | Backoffice em Next.js (não internet banking) | Mostra Next.js moderno com regras de negócio reais (RBAC, dupla aprovação) |
| Itens só documentados | Antifraude, Cards, Notificações, Segurança avançada, SDUI, Multimoeda | Ficam em "Próximos passos", com design resumido: mostram visão sem custar semanas |

## 4. Stack

| Camada | Tecnologias |
|---|---|
| Mobile | Flutter/Dart, Riverpod (codegen quando houver ganho), GoRouter, Dio, Freezed, flutter_secure_storage, local_auth, Sentry |
| API | Node.js, TypeScript, Fastify, Zod, PostgreSQL com SQL puro (`pg`, migrations com dbmate), Pino, Sentry |
| Backoffice | Next.js (App Router), TypeScript, Server Components/Actions, Tailwind, Playwright |
| Simulador Bacen | Fastify + TypeScript (serviço separado) |
| Contratos | Zod → OpenAPI → cliente Dart + cliente TS gerados |
| Infra | Docker Compose (local), GitHub Actions (CI + cache do Turborepo), Render (API, simulador e backoffice, com rede privada entre eles), Neon (Postgres) |
| Qualidade e segurança | Vitest, integration_test, Playwright, dependency-cruiser, regras de import no Dart, gitleaks, osv-scanner/Dependabot, Semgrep |
| Observabilidade | Pino + requestId e Sentry (V1); OpenTelemetry (Fase 2) |

## 5. Estrutura do monorepo

```
next-bank/
├── apps/
│   ├── mobile/            # Flutter (movido da raiz)
│   ├── api/               # Fastify — inclui as migrations SQL (dbmate)
│   ├── simulator/         # Fase 2: um simulador, um módulo por parceiro (bacen, depois carriers, billing, cards)
│   └── backoffice/        # Fase 3 — Next.js
├── packages/
│   └── contracts/         # OpenAPI + clientes gerados (Dart e TS)
├── packages_flutter/
│   └── design_system/     # tokens, componentes, componentes financeiros
├── infra/                 # docker-compose, Dockerfiles
├── docs/
│   ├── adr/
│   ├── architecture/      # C4, diagramas de sequência, ERD
│   ├── design/            # brief visual, mockups (referências de terceiros só localmente)
│   ├── plans/             # plano de cada semana
│   ├── security/          # threat model, checklists ASVS/MASVS
│   ├── evolucao.md        # como chegamos aqui e para onde vamos
│   └── roadmap.md         # este documento
└── .github/workflows/
```

## 6. Arquitetura

### 6.1 Bounded contexts

| Contexto | Fase | Agregados | Invariantes |
|---|---|---|---|
| **Identity** | 1 | `User`, `Session` (família de refresh tokens), `TransactionPin` | Refresh reutilizado revoga a família; PIN bloqueia após 5 tentativas erradas |
| **Accounts** | 1 | `Account` (`ACTIVE`, `BLOCKED`, `CLOSED`) | Só conta `ACTIVE` movimenta dinheiro |
| **Ledger** | 1 | `JournalEntry` (conjunto de lançamentos), `LedgerAccount` | Σ débitos = Σ créditos; lançamentos imutáveis; correção só por estorno |
| **Payments** | 1 | `PixTransfer`, `PixKey`, `IdempotencyRecord` | Máquina de estados sem saltos; limites por transação e noturno (20h–6h) |
| **Audit** | 1 | `AuditEvent` | Só aceita inclusões; sem dados sensíveis |
| **Operations** | 3 | `ApprovalRequest`, `ReconciliationException` | Quem solicita ≠ quem aprova; solicitação expira em 24h |

O **extrato** é um read model sobre Ledger + Payments, não um contexto. Na V1, Payments chama Ledger por uma porta, na mesma transação. Na Fase 2, a comunicação com o mundo externo passa a ser assíncrona via Outbox.

### 6.2 Ledger

- **Plano de contas explícito:**
  - `customer:<id>` — contas de clientes
  - `system:funding` — origem do saldo de demonstração
  - `system:pix_clearing` — conta transitória do PIX externo (Fase 2)
- **Dois saldos por conta**, modelados desde a V1 para que reservas (Cards) não exijam migração no núcleo:
  - `posted_balance`: soma dos lançamentos contabilizados
  - `available_balance`: `posted_balance` − reservas ativas
- A projeção de saldo tem coluna `version` (contador de alterações) e é atualizada na mesma transação dos lançamentos. A concorrência é resolvida por `SELECT … FOR UPDATE` em ordem de ID (ADR 0007), não por lock otimista.
- Um job de **reconciliação interna** compara a projeção com Σ lançamentos e registra divergências.
- O saldo de demonstração entra por `JournalEntry` a partir de `system:funding`. Nunca por `UPDATE`.

### 6.3 PIX — máquina de estados

```
(criação) → AWAITING_AUTH → PROCESSING → COMPLETED
                  │               └────→ FAILED
                  └─→ CANCELLED (cancelado, PIN bloqueado ou expiração)
```

O Pix nasce em `AWAITING_AUTH`; "criado" é só o evento `PixTransferCreated`. Detalhes em `docs/architecture/domain-model.md`.

- **V1 (interno):** `PROCESSING → COMPLETED` acontece na mesma transação: débito no pagador e crédito no recebedor.
- **Fase 2 (externo):** débito do pagador e crédito em `system:pix_clearing`. A confirmação do SPI move o valor de `pix_clearing` para fora (liquidação); uma falha estorna para o pagador.

### 6.4 Backend — hexagonal por módulo

```
apps/api/src/modules/<modulo>/
├── domain/          # entidades, VOs, eventos, erros — sem imports de framework
├── application/     # use cases (commands/queries) + portas (Repo, UnitOfWork, Clock, IdGenerator)
├── infrastructure/  # repositórios em SQL puro (`pg`), adapters
├── http/            # rotas Fastify, schemas Zod, mappers
└── index.ts         # API pública do módulo
```

- `domain` não importa camadas externas. Um módulo só importa outro via `index.ts`. **dependency-cruiser no CI quebra o build quando há violação.**
- Regras de negócio retornam `Result<T, DomainError>`; exceptions só para falhas técnicas.
- Erros HTTP seguem a **RFC 7807** (`application/problem+json`).
- **Unit of Work:** uma transação de banco por comando.
- **CQRS leve:** comandos passam pelo domínio; consultas (extrato) usam SQL otimizado.
- **Migrations:** só para frente, no padrão expand/contract.

### 6.5 Integridade financeira

- **Dinheiro:** VO `Money` com `bigint` em centavos + moeda. `double` é proibido.
- **Idempotência:**
  - Header `Idempotency-Key` obrigatório em comandos financeiros, com escopo **(usuário, chave)** e validade de 24h.
  - O servidor guarda o hash do payload e a resposta.
  - Mesma chave + mesmo payload → devolve a resposta original.
  - Mesma chave + payload diferente → `422`.
  - Requisição ainda em andamento → `409`.
- **Concorrência:** `SELECT … FOR UPDATE` nas contas envolvidas, sempre em ordem determinística (por ID); `CHECK (available_balance >= 0)` como última barreira.
- **Tempo:** `timestamptz` em UTC; porta `Clock`; regras de horário avaliadas em `America/Sao_Paulo`.
- **IDs:** UUIDv7 internamente; ID de ponta a ponta no estilo PIX para o comprovante.
- **Authorization:** checagem de dono em todo recurso; acesso a recurso de outro usuário → `404`.
- **LGPD:** dados mínimos; CPF mascarado em logs, no Sentry e no backoffice (exceto quando o perfil tem permissão explícita).

### 6.6 Segurança (V1)

- Senhas com **Argon2id**.
- Access token JWT de 15 min; refresh token opaco, rotativo, armazenado como hash, com detecção de reuso.
- Sessões com revogação individual e global.
- **PIN de transação validado no servidor** (Argon2id, bloqueio após 5 erros). No app, a biometria é só uma conveniência: libera o PIN guardado no secure storage. A biometria em si **não** é controle de segurança.
- Rate limiting em login, cadastro, PIN e comandos financeiros.
- Validação Zod em todas as entradas; headers seguros; HTTPS.
- Secrets só em variáveis de ambiente e no secret store do CI. Scanners no CI: gitleaks, osv-scanner e Semgrep.
- Mobile: tokens em Keychain/Keystore; release ofuscado.
- Threat model STRIDE para Auth e PIX, usando OWASP ASVS L2 e MASVS como checklist.

### 6.7 Flutter — feature-first + Clean Architecture

```
apps/mobile/lib/
├── app/        # bootstrap, router, flavors (dev/prod)
├── core/       # Dio + interceptors (auth, refresh com fila única, requestId), erros, security, logging
└── features/<feature>/
    ├── domain/        # entidades, contratos de repositório
    ├── data/          # DTOs do cliente gerado, implementações de repositório
    └── presentation/  # providers Riverpod (codegen quando houver ganho), telas, widgets
```

- Features não importam outras features; `presentation/` não importa `data/`; a raiz de composição (`main.dart`) liga as interfaces às implementações. Verificado por teste de arquitetura no CI.
- O app nunca calcula saldo nem decide autorização.
- Falhas modeladas como `sealed class`; estados com Freezed.
- **Interceptor de refresh com fila única:** várias requisições que recebem `401` ao mesmo tempo disparam um único refresh.
- Use cases no Flutter só quando houver lógica real; senão, o notifier chama o repositório.
- Formatação de dinheiro só no Design System.

### 6.8 Contrato único

Schemas Zod da API → OpenAPI → cliente Dart (mobile) + cliente TS (backoffice), em `packages/contracts`. O CI quebra se o cliente regenerado divergir do commitado.

**Plano B:** se o gerador Dart consumir mais de 1 dia de ajustes, os DTOs passam a ser escritos à mão e testes de contrato validam as respostas contra o OpenAPI.

## 7. Identidade e design (sem Figma)

### 7.0 Identidade definida

- **Nome:** next bank, logo em minúsculas.
- **Nomes no código:**
  - Pacote Flutter: `next_bank`
  - Escopo npm: `@nextbank/*` (ex.: `@nextbank/api`, `@nextbank/backoffice`, `@nextbank/contracts`). **Não** usar `@next/*`, que é o escopo oficial do Next.js.
  - Repositório: `next-bank`
- **Aviso no README:** uma linha genérica de projeto fictício de portfólio (não é instituição financeira, sem dinheiro real, dados fictícios). Nenhum ativo visual (logo, cores, ilustrações) de outras instituições é usado.
- **Cor de marca: Menta `#00FFC8`** (menta neon). No código, `NbBrand.mint`.
- **Assinatura visual:** card de saldo sempre escuro, com brilho (glow) Menta, nos dois modos.

**Tokens finais:** paleta completa, tipografia, raios, espaçamento e componentes estão em **[`docs/design/brief.md`](../../design/brief.md)**, a fonte da verdade do visual.

- **Tema:** a V1 entrega o **dark como padrão** (a referência e os mockups são dark-first). Os tokens do light já estão definidos; o seletor de tema na tela de Perfil é item extra da semana 7.
- `#00FFC8` **nunca** é usado como texto sobre fundo claro (1.3:1, ilegível), nem com texto branco por cima.
- **Status ≠ marca:** status de sucesso usa verde-lima (`#C4F27A` no dark, `#3B6E0E` no light), distinto da Menta. Entradas e saídas são indicadas por ícone + sinal (`+ R$ 50,00`).

### 7.0.1 Processo (concluído na semana 0)

1. ✅ Referência visual em `docs/design/references/` (layout dark com card de saldo em efeito de seda, atalhos em blocos, navegação flutuante).
2. ✅ Mockups de Home, Pix e Comprovante, nos modos dark e light, aprovados. Canvas: https://claude.ai/artifact/4PEwqAQm3w1pfLKW8TBa6F
3. ✅ Tokens e brief visual em `docs/design/brief.md`, com contraste verificado (WCAG AA).
4. ⏭️ Semana 3 em diante: tokens → `ThemeExtension` no pacote `design_system`, junto com o primeiro componente que os usa.
5. ⏭️ Semanas 3–7: as demais telas nascem direto em Flutter, seguindo o brief.

**Regras:** identidade própria (sem cores, logos ou ativos de bancos reais); fontes do Google Fonts (Sora + Manrope + JetBrains Mono); ícones open source (Lucide).

### 7.1 Telas da V1

As telas são construídas **direto no Flutter**, dentro de cada fatia (sem mockups adicionais). Cada tela começa consumindo uma interface de repositório; repositórios falsos só existem em testes.

| # | Tela | Semana |
|---|---|---|
| 1 | Splash (restaura sessão) | 2 |
| 2 | Login | 3 |
| 3 | Cadastro (nome, CPF, e-mail, senha) | 3 |
| 4 | Criar PIN de transação | 3 |
| 5 | Desbloqueio do app (PIN/biometria) | 6 (era 3; achado F-16) |
| 6 | Home | 2 (simples) → 4 |
| 7 | Pix: enviar (chave + valor) | 6 |
| 8 | Revisar Pix + PIN (bottom sheet) | 6 |
| 9 | Pix processando | 6 |
| 10 | Comprovante | 6 |
| 11 | Extrato | 6 |
| 12 | Detalhe da transação | 6 |
| 13 | Perfil | 7 |
| 14 | Segurança (sessões ativas, encerrar sessão, trocar PIN) | 7 |
| 15 | *Extra:* Minhas chaves Pix (aba "Receber") | 7 |

- **Chave CPF automática:** todo cadastro cria uma chave Pix do tipo CPF, para a demo funcionar sem a tela 15.
- **Navegação e Design System:** cada rota do GoRouter nasce com a sua tela, e cada componente do `design_system` nasce com a primeira tela que o usa (a partir da semana 3).
- Os estados de cada tela (vazio, erro, carregando, regras de negócio) são listados no modelo de domínio.

### 7.2 Componentes do Design System (V1)

- **Base:** Button, TextField, Card, BottomSheet, Dialog, Snackbar, Skeleton, EmptyState, ErrorState
- **Financeiros:** BalanceCard (com ocultar saldo), MoneyInput, TransactionItem, TransactionStatusBadge, PixKeyInput, PinPad, ReceiptCard

## 8. Fase 1 — V1 Core (8 semanas)

> ✅ **Entregue:** `v1.0.0`, em 2026-10-13. O que entrou está no [CHANGELOG](../CHANGELOG.md), e a performance medida, em [performance.md](performance.md).

Fluxo de cada fatia: **ADR → testes de domínio (TDD) → backend → contrato → mobile → documentação.**

Cada semana tem itens **obrigatórios** e **extras**. Se a semana estourar, os extras vão para o backlog.

| Sem. | Fatia | Obrigatório | Extra | Pronto quando |
|---|---|---|---|---|
| 1 | Arquitetura + Segurança | *(Design já concluído: identidade, tokens e 3 mockups.)* Modelo de domínio (contextos, agregados, máquina de estados, plano de contas); threat model (Auth, PIX); ADRs 001–008; C4 (contexto e containers); ERD inicial; mapa de navegação e estados das telas | — | ADRs, threat model e diagramas commitados e revisados |
| 2 | Esqueleto ponta a ponta | **Spikes:** SQL puro (`pg`) + migrations dbmate com triggers/`GRANT`s no Neon, no caso do ledger; gerador de cliente Dart (ADRs 0008 e 0009). Monorepo (pnpm workspaces; Turborepo quando houver o segundo pacote TypeScript e pub workspaces quando nascer o `design_system`; o cliente gerado entra no app por caminho); app em `apps/mobile`, **sem as plataformas não usadas** e com **identificador único** (`dev.renatomf.nextbank`); Fastify + Postgres com papéis de menor privilégio e migrations dbmate (Docker Compose); CI (format, lint, typecheck, testes, contrato) nos dois apps; gitleaks no CI; proteção da `main`; Pino + requestId; **Home exibe o status da API** pelo cliente gerado (o saldo chega na semana 4, com autenticação e ledger) | Deploy no Render + Neon e spike do serviço privado no Render (movidos para a semana 8); osv-scanner + Semgrep; Sentry; dependency-cruiser (com o primeiro módulo) | PR verde; app conversa com a API |
| 3 | Identity | Cadastro, login, logout; Argon2id; JWT + refresh rotativo com detecção de reuso; sessões; rate limit; auditoria de auth. Mobile: login e cadastro, secure storage, interceptor de refresh com fila única, restauração e expiração de sessão; PIN de transação validado no servidor; **cadastro da demo com CPF fictício gerado no app** (nunca dados reais) | Desbloqueio por biometria no app | Testes de domínio e de API verdes; itens de auth do threat model mitigados |
| 4 | Accounts + Ledger | `Money`; `Account`; plano de contas; `JournalEntry` em partidas dobradas; saldos posted/available com versão; funding pela conta de sistema; authorization por dono. `GET /v1/me`. Mobile: Home (saldo com ocultar saldo, estados de loading e erro); "últimas movimentações" e atalhos entram com o extrato e o Pix, na semana 6 | Job de reconciliação interna | Σ débitos = Σ créditos garantido por teste; usuário A nunca lê a conta de B |
| 5 | PIX — backend | Chaves PIX; máquina de estados; idempotência (escopo + validade); locks ordenados; `CHECK` de saldo; auditoria na transação; teste de concorrência (2 × R$80 sobre R$100); rota de verificação do PIN para o Desbloqueio (F-16); limites por transação e noturno com o horário do servidor (PIX-10; eram extra, plano da semana 5, D1) | — | Todos os testes de integridade financeira verdes |
| 6 | PIX — mobile + Extrato | Desbloqueio do app com PIN (F-16); fluxo do PIX; confirmação com PIN (a biometria foi para "Próximos passos", plano da semana 6, D4); comprovante; extrato com paginação por cursor; detalhe da transação | Filtros do extrato (período, tipo) | **PIX funcionando de ponta a ponta** |
| 7 | Perfil + Polimento | Perfil; segurança (sessões ativas, encerrar sessão); acessibilidade (semântica, contraste, escala de fonte); estados de erro revisados | Animações | As 14 telas implementadas |
| 8 | Qualidade + Produção | E2E Login → PIX → Comprovante → Extrato; testes de segurança (authz, rate limit, idempotência, reuso de refresh, bloqueio do PIN); deploy; README com diagramas; **demo acessível** (seção 8.2) | Profiling básico (startup, rebuilds, queries lentas); app em emulador no navegador | **Tag `v1.0.0`** |

### 8.0 Congelamento de escopo

O escopo da V1 está **congelado** desde 2026-10-05. Ideia nova, mesmo boa, vai para "Próximos passos" (seção 11) até a tag `v1.0.0`. Exceções só para correções de segurança ou de integridade financeira. Estimativa realista: **8 a 9 semanas**.

### 8.1 Checkpoints

- **Fim da semana 2:** se o esqueleto não estiver de pé, simplificar o tooling: ativar o plano B dos contratos e reduzir o CI ao essencial.
- **Fim da semana 6:** se o PIX não estiver funcionando de ponta a ponta, a Fase 3 passa a ser opcional.

### 8.2 Demo pública (para recrutadores)

Quem avalia o projeto precisa vê-lo funcionando **em menos de um minuto**, sem instalar nada e sem dados reais:

- **Vídeo de demo** (2–3 min) no topo do README
- **APK** publicado nas Releases do GitHub a cada versão
- **Contas de demonstração prontas** (ex.: Ana e Bruno, com saldo), documentadas no README, para um Pix entre elas em 30 segundos
- **Cadastro sem dados reais:** o app gera um CPF fictício válido; o aviso pede para não usar dados pessoais
- **Reset diário** do banco da demo (semanal no plano original; diário desde a semana 8, D5), apagando contas de visitantes e recriando as contas de demonstração
- *Extra:* app rodando num emulador dentro do navegador

### 8.3 ADRs da V1

| # | Decisão |
|---|---|
| 001 | Monorepo (pnpm workspaces + Turborepo + pub workspaces) |
| 002 | Monólito modular com DDD + arquitetura hexagonal |
| 003 | Flutter + Riverpod (inclui "por que não React Native") |
| 004 | Autenticação: JWT + refresh rotativo + PIN de transação no servidor |
| 005 | Ledger de partidas dobradas: plano de contas, saldos posted/available |
| 006 | Value Object Money (centavos em bigint) |
| 007 | Idempotência e controle de concorrência |
| 008 | Contrato único (Zod → OpenAPI → clientes gerados) |

### 8.4 Estratégia de testes

> Os padrões obrigatórios de segurança, arquitetura, qualidade, testes e performance (incluindo gates de CI, cobertura de 90% em domínio/aplicação e orçamentos de performance) estão em `CLAUDE.md`, seção "Padrões de engenharia", e valem para todas as fases.


- **Domínio (TDD):** Money, JournalEntry, PixTransfer (transições de estado), limites, Session, TransactionPin
- **Use cases:** com portas falsas e `Clock` controlável
- **Integração:** repositórios contra Postgres real (Docker)
- **API:** authorization, idempotência, concorrência, reuso de refresh, rate limit
- **Mobile:** notifiers Riverpod, repositórios, widgets do Design System, telas críticas
- **E2E:** um fluxo crítico de ponta a ponta
- **Meta:** cobertura alta no domínio e nos use cases; sem meta numérica global

## 9. Fase 2 — PIX assíncrono (~2–3 semanas, `v1.2.0`)

**Acréscimo de 2026-10-14:** o executor em segundo plano desta fase também roda os **agendamentos, os pagamentos recorrentes e o débito automático**: cada ocorrência paga uma única vez (idempotência por ocorrência), com autorização dada no agendamento, cancelamento a qualquer momento e falha registrada quando falta saldo.

**Objetivo:** provar consistência num mundo assíncrono e não confiável.

### Simulador do Bacen (módulo `bacen` de `apps/simulator`)

O simulador é um só, com um módulo por parceiro; o do Bacen é o primeiro (plano `v1.2.0-pix-assincrono.md`, D13).

- `GET /dict/keys/:key`: consulta de chaves externas (DICT)
- `POST /spi/payments`: aceita o pagamento com `202` e confirma depois via webhook
- `GET /spi/payments/:id`: consulta de status (usada quando o webhook não chega)
- `GET /settlements/:date`: arquivo de liquidação do dia
- **Injeção de falhas configurável:** latência, taxa de erro, webhook duplicado, webhook perdido, timeout
- Webhooks assinados com HMAC

### Mudanças na API

- **Outbox transacional + worker:** envia os pagamentos ao SPI com retry e backoff.
- **Inbox:** deduplica webhooks pelo ID do evento; eventos versionados.
- **Conta transitória** `system:pix_clearing`; liquidação ou estorno conforme a confirmação.
- **Timeout → consulta de status**, nunca reenvio cego.
- **Conciliação diária** contra o arquivo de liquidação; cada divergência vira uma `ReconciliationException`.
- **OpenTelemetry** com um trace ponta a ponta: app → API → worker → simulador → webhook.
- Mobile: estado `PROCESSING` com consulta periódica (backoff) até o estado final.

**ADRs:** 009 Outbox + Inbox · 010 PIX assíncrono e conciliação

**Pronto quando:** um PIX externo sob 30% de falhas injetadas termina sempre num estado final correto, sem duplicidade, e a conciliação aponta 100% das divergências injetadas.

## 10. Fase 3 — Backoffice Next.js (~2 semanas, `v1.3.0`)

**Objetivo:** mostrar web moderno e o "banco por dentro".

- **Autenticação de staff**, separada da autenticação de clientes; sessão em cookie `httpOnly`; middleware do Next.js.
- **Perfis (RBAC):**
  - `operador`: consulta e abre solicitações
  - `analista`: aprova solicitações
  - `admin`: gerencia staff
- **Funcionalidades:**
  - Busca de clientes; conta e extrato com dados mascarados
  - Bloqueio de conta (imediato, auditado); desbloqueio com **dupla aprovação**
  - Estorno de PIX com **dupla aprovação**, gerando um `JournalEntry` de estorno
  - **Fila de exceções da conciliação** (da Fase 2): investigar, liquidar ou estornar
  - Trilha de auditoria: quem fez o quê e quando
- **API:** endpoints `/admin/*` no contexto **Operations**, com RBAC verificado no servidor.
- **Next.js:** App Router, Server Components para leitura, Server Actions para comandos, cliente TS gerado do OpenAPI.
- **Testes:** Playwright cobrindo o fluxo de dupla aprovação, incluindo a tentativa do solicitante de aprovar a própria solicitação (deve falhar).
- **Deploy:** Render, no mesmo provedor da API. Os endpoints `/admin/*` são servidos por uma instância separada da API (mesma imagem, modo `admin`), implantada como **serviço privado**, sem URL pública: só o backoffice a alcança pela rede interna. A API pública não registra as rotas `/admin/*`. Evolução opcional: gateway de identidade (zero trust) na frente do backoffice.

- **Revisão do BFF (ADR 0011):** o desenho da fase começa respondendo se o servidor do Next.js basta como BFF do backoffice (sessão em cookie `httpOnly`, Server Actions chamando a API `/admin/*` privada) ou se é preciso um serviço dedicado, e como ficam CSRF/`SameSite` e a propagação do `requestId` e da `Idempotency-Key` nos comandos do staff.

**ADR:** 0012 Backoffice: RBAC e dupla aprovação

**Pronto quando:** um PIX divergente da Fase 2 é resolvido pelo backoffice, com dupla aprovação, e aparece corretamente no extrato do cliente e na trilha de auditoria.

## Fase 4 — Produtos do app (`v1.4.0` → `v2.0.0`)

**Objetivo:** trocar os atalhos "Em breve" da Home por produtos de verdade, cada um de ponta a ponta: API, Postgres, ledger, app e testes. O dinheiro continua dentro do next bank. Nada aqui movimenta dinheiro real, e não há integração com instituição de verdade (decisão de 2026-10-14). A parte mais simples já chegou na `v1.1.0`.

**Ordem e motivo** (definida em 2026-10-12, depois da semana 8; revista em 2026-10-14, quando a `v1.1.0` antecipou o QR Code estático, a recarga síncrona e o cartão visual):

| Versão | Produto | O que entra | Por quê, nessa ordem |
|---|---|---|---|
| `v1.4.0` | **Minhas chaves Pix e QR Code dinâmico** | Chaves e-mail e telefone (cadastrar, listar, excluir, sem duplicidade, cifradas como a de CPF); QR Code dinâmico no padrão BR Code. A chave aleatória e o QR estático (gerar, ler e validar o CRC) chegaram na `v1.1.0` | Está mais perto do domínio que já existe (Payments) e ativa o atalho "Pagar" |
| `v1.5.0` | **Recarga assíncrona, boleto e contas de consumo** | Provedor simulado (módulos `carriers` e `billing` de `apps/simulator`) com sucesso, falha, timeout e duplicidade; máquina de estados com reserva de saldo, confirmação ou estorno; a recarga síncrona da `v1.1.0` passa a usá-lo; linha digitável do boleto bancário (47 dígitos) e de arrecadação de contas de consumo (48 dígitos) validada, com empresas fictícias | Mostra fluxo assíncrono, falhas e devolução de dinheiro sobre a base da Fase 2 (outbox, inbox, conta transitória); ativa "Recarga" |
| `v2.0.0` | **Cartão de crédito** | Cartão virtual de demonstração (nunca PAN, CVV ou dados reais), bloqueio, limite, autorização com reserva em `available_balance`, compra negada e estornada, fatura, vencimento, pagamento e parcelamento | É o maior produto: um novo contexto (Cards) com ciclo de cobrança próprio. O cartão visual da Home (só interface) chegou na `v1.1.0` e passa a mostrar os dados do servidor |

**Regras que continuam valendo:**
- Cada versão começa com o seu plano: fontes conferidas, threat model (ameaças novas viram linha e teste), contratos, concorrência e ADR quando houver decisão de arquitetura.
- Dinheiro só como `Money`, comandos idempotentes e transacionais, ledger só por inclusão, teste de concorrência em toda regra financeira.
- O README separa o que funciona de ponta a ponta dentro do next bank do que dependeria de uma instituição real, que não faz parte do projeto.
- O Pix com outros bancos não está aqui: é a Fase 2 (simulador do Bacen).

## 11. Próximos passos (só documentados no README)

Cada item recebe um parágrafo de design no README, sem implementação:

- **Antifraude + MED:** motor de regras de risco (dispositivo novo, valor atípico, beneficiário novo, horário) → aprovar, pedir step-up ou reter; devolução PIX pelo MED.
- **Cards:** planejado na Fase 4 (`v2.0.0`).
- **Notificações:** consumidores do outbox, push via FCM, central de notificações.
- **Biometria no app:** saiu daqui e entrou na `v1.1.0` (plano `v1.1.0-produtos-do-dia-a-dia.md`, D11 e MOB-11).
- **Segurança avançada:** vínculo de dispositivo (chave no Secure Enclave/Keystore assinando transações), Play Integrity/App Attest, `FLAG_SECURE`, certificate pinning (SPKI), Row-Level Security.
- **SDUI/BDC:** Home montada pelo servidor sobre o Design System, com schema versionado e fallback local.
- **Conta global multimoeda:** cotação com validade, spread, conversão em lançamentos no ledger.
- **Feature flags** e **observabilidade com métricas e dashboards**.
- **Animações** de transição entre telas e de feedback (extra da semana 7, que ficou fora pelo plano da semana 7, D10).
- **Assistente com IA:** na V1 o campo "Posso te ajudar?" só avisa "Em breve" (plano da semana 8, tarefa 3.5, V9). Os atalhos "Pagar", "Transferir" e "Recarga" ganham produto de verdade na Fase 4.
- **Verificação automática do IP do cliente (API-14):** uma rota mínima que devolve o IP que a API enxergou do próprio chamador, e um passo no smoke test do deploy com uma requisição normal e outra com `X-Forwarded-For` forjado. Assim o deploy falha sozinho se o Render ou a Cloudflare mudarem o número de saltos de proxy, hoje 3 e conferido à mão (`operations.md`, passo 6; F-29).
- **Recarga de celular, depois da `v1.1.0`:** "Recargas recentes" para repetir uma recarga (precisa de um atalho guardado pelo servidor, decisão R3), o comprovante da recarga como imagem compartilhada (decisão R8, com a imagem do Pix movida antes para `core/ui`) e uma operadora de verdade, com reserva, timeout e estorno (Fase 4, D5).
- **Testes visuais de regressão (golden tests)** do `design_system` e das telas: hoje os testes conferem valores (cor, tamanho, contraste), não a aparência renderizada.
- **Atualizações de versão maior, depois da `v1.2.0`:** `go_router` 17 → 18 e `sentry_flutter` 9 → 10, propostas pelo Dependabot em 2026-10-26 (PRs #180 e #179, fechados). Ficaram fora pelo escopo congelado. O `sentry_flutter` 10 quebrava os testes do app e o E2E, e cada uma entra como tarefa própria, com desenho: o que muda na API da biblioteca, os testes afetados e, no Sentry, a redação de dados pessoais (`beforeSend`) conferida de novo.

## 12. Fora do código (mesma prioridade)

- README com diagramas e GIF/vídeo no topo; seção "Decisões e trade-offs" apontando para os ADRs
- Vídeo de demo de 2–3 minutos
- 2–3 artigos técnicos (LinkedIn/Medium), por exemplo: idempotência no PIX; "por que meu saldo nunca é um UPDATE"; PIX assíncrono e conciliação
- Narrativa de entrevista: cada decisão explicada em até 2 minutos

## 13. Fora de escopo

- Integração real com SPI/DICT do Bacen, KYC real, OTP por SMS/e-mail, Open Finance
- Microsserviços, Kafka, Redis, event sourcing completo
- App React Native
- Publicação nas lojas

## 14. Riscos

| Risco | Mitigação |
|---|---|
| Atraso nas semanas 2, 3 e 5 | Divisão obrigatório/extra; checkpoints nas semanas 2 e 6; plano B dos contratos |
| Escopo crescer | Tudo fora deste documento vai para "Próximos passos" |
| Código gerado por IA sem dono | Toda fatia começa por ADR e testes de domínio revisados pelo desenvolvedor |
| Nome coincidir com marcas existentes | Aviso genérico no README; identidade visual própria; escopo `@nextbank/*` |
| Cold start do Render na demo | Health check agendado ou plano pago durante o período de candidaturas |
| Biometria indisponível em emulador | O PIN é o controle real; biometria simulada nos testes |
| Esperar o projeto "ficar perfeito" para se candidatar | Candidaturas começam na `v1.0.0` |
