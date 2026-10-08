# Plano — Semana 6: Pix no app + Extrato

- **Status:** Aprovado (2026-10-08), com as decisões D1–D12 nos padrões recomendados
- **Roadmap:** `docs/roadmap.md` (seção 8, semana 6; tabela de telas 7.1)
- **Base:**
  - ADRs 0003 (Flutter + Riverpod), 0004 (PIN no servidor, biometria só como conveniência), 0006 (`Money`), 0007 (idempotência) e 0011 (sem BFF);
  - `domain-model.md` (4, 8.1, 9, 10 e 11) e `database.md` (8 e 11, T-DB-12);
  - threat model (PIX-02, PIX-06, READ-01 a READ-04, MOB-01, MOB-02, MOB-05);
  - checklist MASVS (desbloqueio, PIN no servidor);
  - brief (3, 6 e 7) e mockups `pix-dark.png`, `comprovante-dark.png` e `home-dark.png`;
  - achado F-16.
- **Carga:** ~30h (5 dias × 6h)
- **Objetivo:** o cliente envia um Pix pelo app (chave, valor, revisão com PIN, processamento, comprovante) e acompanha o dinheiro no extrato. O app pede o PIN ao abrir e depois de 5 minutos em segundo plano.
- **Pronto quando:**
  - Pix de ponta a ponta no app, contra a API real: cadastro de A e B → A envia → comprovante → extrato de A e de B;
  - uma falha de rede no meio da autorização não duplica o Pix;
  - o extrato pagina por cursor sem duplicar nem pular itens (T-DB-12);
  - `/security-review` sem achados abertos.

## Como trabalhamos nesta semana

- **Começa pela API do extrato:** é a única rota nova. Ela abre a semana, outside-in, com o teste HTTP contra o Postgres antes da rota.
- **App em TDD nos notifiers e repositórios** (CLAUDE.md, seção 5). Layout de telas e componentes visuais recebem testes de widget depois.
- **Cada componente do `design_system` nasce com a primeira tela que o usa**, conferido contra o mockup (regra do F-14).
- **Ataque antes da defesa no app:**
  - o teste que perde a resposta da autorização e tenta de novo vem antes do código que reaproveita a chave;
  - o teste que deixa o app 5 minutos em segundo plano vem antes do bloqueio.

## Critérios de engenharia

Os mesmos das semanas 3 a 5. Nesta semana pesam mais:

| Princípio | Como se verifica |
|---|---|
| **Correção financeira no app** | Valor digitado vira centavos inteiros (`int`), nunca `double`; formatação só no `design_system` (ADR 0006); repetição da autorização reaproveita a `Idempotency-Key` |
| **Clean Architecture por feature** | `features/pix` e `features/statement` com `domain/`, `data/` e `presentation/`; nenhuma feature importa outra (teste de arquitetura) |
| **Segurança mobile** | PIN só trafega no corpo da requisição, nunca fica em estado persistente, log ou cache; desbloqueio decidido pelo servidor |
| **Performance** | Extrato com página de 20 e índice que a sustenta (`EXPLAIN ANALYZE`); listas sem jank |

## Fontes conferidas

| Fonte | Regra | Teste |
|---|---|---|
| `domain-model.md` 8.1 | Extrato lê só o ledger; contraparte do snapshot da partida; cursor `(created_at, id)`, 20 por página, do mais novo ao mais antigo | Rota: ordem, tamanho da página, contraparte e sinal de cada tipo |
| `database.md` 8 | Índice `postings (ledger_account_id, created_at DESC, id DESC)`; cursor base64url, não assinado; filtro por conta no servidor | `EXPLAIN ANALYZE` no PR; cursor inválido → 422 |
| `database.md` 11 | T-DB-12: Pix novo entre a página 1 e a 2 não duplica nem pula itens | Integração contra o Postgres |
| READ-01 | Extrato só da conta do token; nenhum parâmetro de conta | Dois clientes; `?accountId=` → 422 |
| READ-02 | Item do extrato só com os campos aprovados; documento mascarado | Teste das chaves exatas e de contrato |
| READ-03 | Cursor adulterado | Cursor malformado → 422; cursor montado com dados de outra conta não devolve nada alheio |
| READ-04 | Consultas caras | Sem parâmetro de tamanho: página fixa de 20; `limit=10000` → 422 |
| `domain-model.md` 10 | Splash → (sessão) → Desbloqueio → Home; segundo plano > 5 min → Desbloqueio; voltar do comprovante leva à Home | Testes do redirect no router real |
| `domain-model.md` 11 | Estados das telas 5, 7, 8, 9, 10, 11 e 12 | Teste de widget de cada estado |
| `domain-model.md` 9 | Mensagens dos erros do Pix, do PIN e do extrato | Teste do mapeamento de cada código para o texto |
| PIX-02 / ADR 0007 | Repetir a autorização após perder a resposta não repete o Pix | Notifier: falha de rede na autorização → nova tentativa com a **mesma** chave; novo PIN → chave nova |
| PIX-06 / F-16 | Desbloqueio após 5 min em segundo plano; PIN validado no servidor | Teste do ciclo de vida com relógio controlado; tela chama `POST /v1/me/pin/verify` |
| MOB-01 / MOB-02 | PIN e dados do Pix nunca persistidos nem logados | Revisão + teste: o estado do notifier descarta o PIN depois do envio; nada em `SharedPreferences` |
| MOB-05 | Saldo da tela do Pix respeita o "ocultar saldo" da Home | Teste de widget com o saldo oculto |
| MASVS: código | Dados da API validados antes do uso (F-18) | Interceptor de valores inteiros já cobre `amount` em todo Pix e item do extrato |
| Brief 3, 6, 7 e mockups | `AmountCard` (valor digitado em centavos), `ContactCard`, `SecureHint`, `ReceiptCard`, `StatusBadge`, `TransactionItem`, `ActionTile`, `EmptyState`; o `PinField` da semana 3 na revisão | Testes de widget de cada ponto conferido contra a imagem (F-14) |

## Estrutura

```
apps/api/src/modules/
├── ledger/application/statement.ts       # leitura do extrato (read model), sem agregado
├── ledger/infrastructure/                # query paginada por cursor
└── accounts/http/statement-route.ts      # GET /v1/me/statement: conta do token → LedgerPort (D2)

apps/mobile/lib/
├── core/idempotency_key.dart             # UUID v4 com Random.secure (D11)
├── core/session/app_lock.dart            # bloqueio por tempo em segundo plano (relógio injetável)
├── features/unlock/                      # tela 5
├── features/pix/                         # telas 7, 8, 9 e 10
│   ├── domain/   # PixRepository, PixTransfer, PixKeyLookup, erros
│   ├── data/     # HttpPixRepository (cliente gerado)
│   └── presentation/
├── features/statement/                   # telas 11 e 12
└── features/home/                        # + atalho Pix e "Últimas movimentações"

packages/design_system/                   # AmountCard, ContactCard, SecureHint, ReceiptCard,
                                          # StatusBadge, TransactionItem, ActionTile, EmptyState
```

- **Extrato na API:** a rota fica no Accounts e lê o ledger pela `LedgerPort` que o Accounts já define. É o mesmo caminho do saldo (D5 da semana 4): a conta vem do token, e o Ledger não conhece o Accounts.
- **App:** a Home não importa `features/pix` nem `features/statement`. A navegação é feita por rotas do GoRouter, montadas na raiz de composição. A Home só recebe a primeira página do extrato por um provider de `core`.

## Concorrência

| Cenário | O que acontece | Teste |
|---|---|---|
| Resposta da autorização perdida (rede caiu) | O app tenta de novo com a **mesma** `Idempotency-Key`; o servidor devolve a resposta guardada (PIX-02) | Notifier com repositório falso que falha uma vez depois de "processar" |
| Toque duplo em "Confirmar" | O botão fica desabilitado enquanto envia; no servidor, a autorização dupla dá 409 (PIX-08) | Teste de widget do botão + teste do servidor já existente |
| Pix novo enquanto o cliente pagina o extrato | Cursor `(created_at, id)`: o item novo fica antes da página 1, sem duplicar nem pular | T-DB-12 contra o Postgres |
| Timestamp do cursor | `created_at` tem microssegundos no Postgres e milissegundos no JavaScript: o cursor carrega o texto do banco, nunca um `Date` arredondado | T-DB-12 com itens criados no mesmo milissegundo |
| Desbloqueio com PIN errado em paralelo ao Pix | Mesmo contador no servidor, com a linha travada (PIX-05, semana 5) | Já coberto na semana 5 |

## Contratos

**Rota nova:**

| Rota | Entrada | Resposta | Erros |
|---|---|---|---|
| `GET /v1/me/statement` | query `cursor?` (opaco) | 200 `Statement` `{ items: StatementItem[], nextCursor: string \| null }` | 401; 422 `InvalidRequest` (cursor malformado ou qualquer outro parâmetro) |

- **`StatementItem`:** `{ id, occurredAt, kind: 'PIX_SENT' \| 'PIX_RECEIVED' \| 'DEMO_FUNDING', direction: 'IN' \| 'OUT', amount: Money, counterparty: { name, documentMasked } \| null, transferId: string \| null }`.
  - O `id` é o da partida.
  - O `transferId` só vem num Pix enviado: é o link para o comprovante (D3).
  - O `amount` é sempre positivo; o sinal vem do `direction`.
- **Página:** fixa em 20 itens. Não há parâmetro de tamanho (READ-04).
- **Schemas OpenAPI novos (F-10):** `Statement`, `StatementItem`, `StatementCounterparty`. Cliente Dart regenerado.

**Banco:** migration com o índice `ledger.postings (ledger_account_id, created_at DESC, id DESC)`.

**Query nova** (com `EXPLAIN ANALYZE` no PR): a do `database.md` seção 8, filtrada pela conta contábil da conta do token. O `LIMIT 21` diz se há próxima página.

**App, rotas do GoRouter:**
- `/unlock`;
- `/pix`, `/pix/review` (bottom sheet), `/pix/processing`, `/pix/receipt/:transferId`;
- `/statement`, `/statement/:itemId`.

## Dependências novas

Nenhuma. A UUID da `Idempotency-Key` sai de `Random.secure` (D11). Biometria (`local_auth`) e compartilhar comprovante (`share_plus`) ficam fora (D4 e D9).

## Decisões a confirmar (com padrão recomendado)

| # | Decisão | Padrão recomendado |
|---|---|---|
| D1 | Prioridade, se a semana estourar | Obrigatório e na ordem: extrato na API → Desbloqueio → Pix (7 a 10) → extrato no app (11). Se estourar, vão para o início da semana 7: o detalhe da transação (12) e as "Últimas movimentações" da Home. Testes de segurança e de concorrência nunca são cortados |
| D2 | Onde fica o extrato na API | `GET /v1/me/statement` no Accounts, lendo pelo `LedgerPort` (como o saldo, D5 da semana 4). A conta vem do token |
| D3 | Detalhe de um Pix recebido | A tela 12 mostra o que o item do extrato já traz (data, tipo, contraparte, valor). "Ver comprovante" só aparece num Pix **enviado**. O pagador é o único que lê o Pix (PIX-01), então o recebedor não ganha rota nova. O `transferId` só sai nos itens enviados (READ-02) |
| D4 | Biometria | Fora desta semana. Ela guardaria o PIN no Keychain/Keystore (ADR 0004): segredo local novo, dependência nova (`local_auth`) e um threat model próprio. O roadmap já a trata como conveniência; vai para "Próximos passos" junto com a revisão do MOB-01 |
| D5 | Quando o Desbloqueio aparece | Na abertura do app com sessão guardada e depois de 5 min em segundo plano. Depois do login com senha, vai direto para a Home: a senha acabou de ser conferida. O mapa de navegação (`domain-model.md` 10) troca "Login → Desbloqueio" por "Login → Home" |
| D6 | Desbloqueio com PIN bloqueado | Mostra a mensagem do catálogo e oferece "Sair". O cliente volta pelo login com senha, e a redefinição do PIN chega com a tela Segurança (semana 7) |
| D7 | Máscara do CPF | Mantém a da API, `***.456.789-**` (seis dígitos do meio, como o DICT do Pix e o comprovante). O mockup mostra `•••.842.•••-09`; o brief ganha a regra para não divergir de novo |
| D8 | O que entra da tela do Pix do mockup | Valor, saldo disponível, "Para quem?" com busca da chave CPF, cartão do recebedor, descrição, "Revisar Pix" e o aviso do PIN. Ficam fora: abas Enviar/Receber (a tela 15 é extra da semana 7), "Recentes" (pediria uma consulta nova) e o ícone de atendimento (fora da V1) |
| D9 | Compartilhar comprovante | Fora desta semana (`share_plus` é dependência nova, e o comprovante tem dado pessoal). O comprovante mostra tudo na tela e tem "Voltar ao início" |
| D10 | Pagador no comprovante | O app compõe "DE" com o próprio nome (perfil já carregado) e a conta mascarada nos quatro últimos dígitos (`GET /v1/me/account`). A API não ganha campos |
| D11 | Gerar a `Idempotency-Key` | UUID v4 com `Random.secure` em `core`, com teste de formato e unicidade. Nova a cada criação e a cada PIN digitado; reaproveitada só na repetição da mesma tentativa |
| D12 | Navegação flutuante | Entra na semana 7, com Perfil e Segurança, quando os cinco destinos existem. Na semana 6, a Home ganha o atalho "Pix" (`ActionTile`) e as "Últimas movimentações", com "Ver extrato" (D7 da semana 4) |

## Fora desta semana

- Biometria (D4), compartilhar comprovante (D9), abas Enviar/Receber e "Minhas chaves" (semana 7, extra).
- "Recentes" na tela do Pix e filtros do extrato por período e tipo: extras do roadmap.
- Navegação flutuante, Perfil e Segurança: semana 7 (D12).
- Job de expiração de Pix e limpeza da idempotência: semana 8.

---

## Tarefa 0 — Plano (antes do código)

- [x] Este plano aprovado; mapa de navegação (D5) e brief (D7) atualizados; MOB-07 no threat model (repetição da autorização pelo app, D11); biometria em "Próximos passos" no roadmap (D4)

## Tarefa 1 — Extrato na API, outside-in (dia 1)

| Ameaça | Teste escrito antes |
|---|---|
| READ-01 | A e B: cada token só vê o próprio extrato; `?accountId=` → 422 |
| READ-02 | Item com as chaves exatas; `transferId` só no Pix enviado |
| READ-03 | Cursor malformado → 422; cursor de outra conta não devolve nada alheio |
| READ-04 | `limit=10000` → 422; página sempre de no máximo 20 |
| T-DB-12 | Pix novo entre a página 1 e a 2: nada duplicado nem pulado |

- [ ] Migration do índice; query paginada; `EXPLAIN ANALYZE`
- [ ] Rota, contrato e cliente Dart regenerado

## Tarefa 2 — Desbloqueio (dia 2)

- [ ] `AppLock` em `core/session` (TDD com relógio controlado): bloqueia na abertura com sessão e após 5 min em segundo plano
- [ ] Tela 5 com o `PinField` existente; erros do catálogo; "Sair"; redirect no router real

## Tarefa 3 — Pix no app (dia 2–4)

- [ ] `design_system`: `AmountCard`, `ContactCard`, `SecureHint`, `ActionTile`, `ReceiptCard`, `StatusBadge`, conferidos contra os mockups
- [ ] `features/pix`: repositório (TDD), notifiers do envio e da revisão (TDD, inclusive a repetição com a mesma chave)
- [ ] Telas 7, 8, 9 e 10 com todos os estados da seção 11; voltar do comprovante leva à Home
- [ ] Atalho "Pix" na Home

### Desenho da tarefa 3

**Fontes conferidas**

| Fonte | Regra | Teste |
|---|---|---|
| PIX-02 / MOB-07 / D11 | A chave nasce com cada tentativa e é reaproveitada em toda repetição dela | `review_controller_test`: a rede cai depois de o servidor processar → a repetição usa a mesma chave e recebe o Pix concluído; PIN novo após `PinIncorrect` → chave nova. `send_pix_controller_test`: a criação repetida usa a mesma chave; mudar valor, chave ou descrição gera chave nova |
| PIX-04 / ADR 0006 | O valor digitado vira centavos `int`, nunca `double` | `pix_amount_test`: dígitos → centavos, teto de dígitos, zero não envia |
| PIX-06 | O PIN é conferido no servidor em todo Pix | O repositório envia o PIN só no corpo da autorização (`http_pix_repository_test`, chaves exatas) |
| PIX-07 | Varredura de chaves | A busca só acontece por ação do cliente e com CPF válido no app; CPF inválido não chama a API (`send_pix_controller_test`) |
| PIX-08 | Toque duplo em "Confirmar" | O controller ignora o segundo envio enquanto o primeiro não volta; o botão fica desabilitado (teste de widget) |
| MOB-02 | O PIN e os dados do Pix não ficam guardados nem aparecem em log | O estado dos controllers não tem campo de PIN. O PIN fica só em memória, na tentativa em andamento, e é descartado na resposta definitiva ou ao sair da tela (teste) |
| MOB-05 | O saldo da tela do Pix respeita o "ocultar saldo" | Teste de widget do `AmountCard` com o saldo oculto |
| `domain-model.md` 9 | Textos do Pix e do `LimitExceeded` com o valor do limite | `api_messages_test`: cada código novo, e `limit` lido só quando é inteiro (F-18) |
| `domain-model.md` 4 e 9 | A autorização devolve 200 com `FAILED` e um motivo | Tela 9 com o texto de cada `failureReason` (`processing_controller_test`) |
| `domain-model.md` 10 | Voltar do comprovante leva à Home, nunca ao PIN | `app_test`: o botão voltar do sistema no comprovante leva à Home |
| `domain-model.md` 11 | Estados das telas 7 a 10 | Testes de widget de cada estado |
| Brief e mockups (F-14) | `AmountCard`, `ContactCard`, `SecureHint`, `ActionTile`, `ReceiptCard`, `StatusBadge` | Testes de widget de cada ponto conferido contra `pix-dark.png`, `comprovante-dark.png` e `home-dark.png` |

**Estrutura**

```
apps/mobile/lib/
├── core/account/            # vem de features/home: o Pix precisa do saldo, do "ocultar" e da conta (D10)
├── core/cpf.dart            # vem de features/auth/domain: o Pix valida a chave CPF
├── core/idempotency_key.dart
├── core/api_failure.dart    # + códigos do Pix e `limitCents`
├── core/api_messages.dart   # + textos do Pix e dos motivos de falha
└── features/pix/
    ├── domain/   pix_amount.dart, pix_transfer.dart, pix_payee.dart, pix_repository.dart
    ├── data/     http_pix_repository.dart (cliente gerado)
    └── presentation/
        ├── pix_providers.dart
        ├── send/        tela 7: SendPixController
        ├── review/      tela 8: ReviewPixController
        ├── processing/  tela 9: ProcessingController
        └── receipt/     tela 10
```

- **Itens movidos antes (commits `refactor:` sem mudar comportamento):**
  - a conta: repositório, `accountProvider` e `balanceHiddenProvider`;
  - o `Cpf`.
  - Hoje os dois vivem em features que o Pix não pode importar.
- **Rotas:**
  - `/pix`, aberta por `push` da Home;
  - `/pix/review/:transferId`, por `push` sobre `/pix`, para o voltar retornar ao formulário;
  - `/pix/processing/:transferId` e `/pix/receipt/:transferId`, por `go`.
  - Nas telas 9 e 10, o voltar leva à Home (`PopScope`).
- **A revisão lê o Pix do servidor:** a tela 8 busca o Pix pelo id (`GET /v1/pix/transfers/:id`). O cliente confirma o que o servidor gravou, não o que o app tem na memória.

**Concorrência**

| Cenário | O que acontece | Teste |
|---|---|---|
| Resposta da autorização perdida | A tela diz que não foi possível confirmar e oferece "Tentar de novo". A repetição envia a mesma chave e o mesmo PIN, ainda em memória, e o servidor devolve a resposta guardada | `review_controller_test` |
| `RequestInProgress` (409) | Tratado como resultado desconhecido: "Tentar de novo" com a mesma chave | `review_controller_test` |
| Resposta da criação perdida | "Revisar Pix" de novo com o mesmo rascunho usa a mesma chave: o servidor devolve o mesmo Pix, sem criar outro | `send_pix_controller_test` |
| Toque duplo em "Revisar Pix" ou "Confirmar" | O segundo envio é ignorado; no servidor, a autorização dupla dá 409 | Controllers + teste de widget |
| App bloqueado no meio da revisão | O redirect leva ao Desbloqueio; o controller é descartado e o PIN some junto. O Pix pendente expira em 10 min | `app_test` |
| `PROCESSING` na volta da autorização | A tela 9 consulta o Pix a cada 1 s, até 10 vezes. Se não terminar, diz "Ainda processando" e leva à Home | `processing_controller_test` |

**Contratos**

- **Nada muda na API.** As rotas usadas (`lookupPixKey`, `createPixTransfer`, `getPixTransfer` e `authorizePixTransfer`) e os schemas vêm do cliente gerado.
- **`PixRepository`:**
  - `lookup(cpf)` → `PixPayee`;
  - `create(cpf, amountCents, description, idempotencyKey)` → `PixTransfer`;
  - `fetch(id)` → `PixTransfer`;
  - `authorize(id, pin, idempotencyKey)` → `PixTransfer`.
  - Status ou motivo de falha desconhecido → `ApiUnexpected`.
- **Catálogo novo no app:**
  - `PixKeyNotFound`, `SamePayerAndPayee`, `InvalidAmount`, `InsufficientFunds`;
  - `LimitExceeded` (com `limitCents`, de `limit.amount`);
  - `AccountBlocked`, `TransferExpired`, `InvalidTransferState`, `IdempotencyKeyReused`, `RequestInProgress`.
- **Valor:**
  - digitado da direita para a esquerda (`3` → R$ 0,03; `35000` → R$ 350,00);
  - no máximo 9 dígitos;
  - zero não envia;
  - os limites de valor e de horário ficam só no servidor (PIX-10).
- **Chave:** só CPF (D8).

**Dependências novas:** nenhuma.

**Decisões da tarefa 3**

| # | Decisão | Padrão recomendado |
|---|---|---|
| T1 | O PIN na repetição da autorização | Fica em memória só na tentativa em andamento e é descartado na resposta definitiva ou ao sair da tela. Pedir o PIN de novo transformaria a repetição numa tentativa nova (MOB-07) |
| T2 | Cancelar o Pix ao sair da revisão | Fica fora: o Pix pendente expira em 10 min, e a autorização confere `expires_at` (PIX-08) |
| T3 | Tamanho da entrega | Dois PRs: (a) `core`, domínio, dados e controllers; (b) `design_system`, telas, rotas e atalho na Home |

**Fora da tarefa 3:**
- cancelar ao sair (T2);
- compartilhar comprovante (D9);
- abas, "Recentes" e atendimento (D8);
- outras chaves além de CPF;
- biometria (D4).

## Tarefa 4 — Extrato no app (dia 4–5)

- [ ] `design_system`: `TransactionItem`, `EmptyState`
- [ ] `features/statement`: repositório e notifier com paginação por cursor (TDD)
- [ ] Telas 11 e 12; "Últimas movimentações" na Home

## Tarefa 5 — Fechamento

- [ ] `/security-review` (obrigatório: Pix, PIN e autorização)
- [ ] Threat model e matriz de controles (READ-03, READ-04, PIX-06, F-16 fechado); checklist MASVS
- [ ] `database.md` (índice do extrato verificado), `domain-model.md`, CHANGELOG

---

## Checkpoint de fim de semana

- [ ] **Pix funcionando de ponta a ponta no app** contra a API real, no emulador e no celular
- [ ] Desbloqueio na abertura e após 5 min em segundo plano; PIN bloqueado oferece "Sair"
- [ ] Falha de rede na autorização não duplica o Pix
- [ ] Extrato pagina sem duplicar nem pular (T-DB-12); READ-01 a READ-04 com teste verde
- [ ] Cobertura ≥ 90% em `domain/` e `application/`; `flutter analyze` sem warnings
- [ ] Se a semana estourar: aplica a D1
- [ ] Próximo passo: plano da semana 7 (Perfil, Segurança, navegação flutuante)
