# Plano — Semana 5: Pix (backend)

- **Status:** Aprovado (2026-10-07), com as decisões D1–D12 nos padrões recomendados
- **Roadmap:** `docs/roadmap.md` (seção 8, semana 5)
- **Base:** ADRs 0004 (PIN no servidor), 0005 (ledger), 0006 (`Money`), 0007 (idempotência e concorrência) e 0010 (orquestração); `domain-model.md` (2, 3.1, 3.4, 3.5, 4, 5, 6, 7, 8, 9 e 11); `database.md` (2, 4, 5.4, 6, 7, 10 e 11); threat model (PIX-01 a PIX-10, AUTH-04, API-04); checklist ASVS (itens da semana 5); achado F-16
- **Carga:** ~30h (5 dias × 6h)
- **Objetivo:** um cliente envia Pix interno para a chave CPF de outro cliente, autorizado pelo PIN conferido no servidor, sem nunca gastar o mesmo saldo duas vezes, repetir um Pix por repetição de requisição ou mexer no Pix de outro cliente. O app ganha a rota que o Desbloqueio (F-16) vai usar.
- **Pronto quando:** todos os testes de integridade financeira verdes (T-DB-05 a T-DB-10 e T-DB-14 no nível do Pix); PIX-01 a PIX-10 com teste verde; `/security-review` sem achados abertos; o Pix de ponta a ponta funciona pela API (cadastro de A e B → consulta da chave → criação → autorização → comprovante).

## Como trabalhamos nesta semana

- **Começa pelo banco:** o schema `payments` e os testes de banco (T-DB-05, T-DB-07, T-DB-10) vêm antes de qualquer caso de uso, como na semana 4.
- **Ataque antes da defesa:** autorizar o Pix de outro cliente, repetir a mesma requisição, gastar o mesmo saldo em paralelo, chutar o PIN e varrer chaves são testes escritos antes do código que impede.
- **Um módulo novo, com o molde dos outros:** `payments`, com `domain/`, `application/`, `infrastructure/`, `http/` e `index.ts`. O Pix pertence ao Payments, que orquestra o fluxo e chama Identity, Accounts e Ledger por portas que ele mesmo define (ADR 0010, regra 1).
- **Falha de negócio é gravada, não desfeita:** PIN incorreto, saldo insuficiente e Pix expirado fazem commit do que mudou (tentativas, status, auditoria e resposta idempotente) e só depois devolvem o erro (ADR 0010, regra 3).

## Critérios de engenharia

Os mesmos das semanas 3 e 4. Nesta semana pesam mais:

| Princípio | Como se verifica |
|---|---|
| **Correção financeira** | `Money` em centavos inteiros do JSON ao banco; um Pix gera no máximo um lançamento; Σ débitos = Σ créditos no `COMMIT`; reconciliação depois da carga concorrente |
| **Concorrência** | Ordem fixa de locks da `database.md` seção 7, provada com requisições paralelas contra o Postgres real |
| **Segurança** | Pagador sempre do token; dono verificado em todo acesso a um Pix; PIN só no servidor, nunca guardado nem em hash fora do Argon2id |
| **DDD** | `PixTransfer` protege a máquina de estados; `TransactionPin` conta as tentativas; o orquestrador do Pix só sequencia |

## Fontes conferidas

Cada linha das fontes que a semana toca, com o teste que a prova.

| Fonte | Regra | Teste |
|---|---|---|
| `domain-model.md` 3.4 | `PixKey`: (`type`, `value`) único; chave CPF = CPF do titular; até 5 por conta | Domínio: chave CPF de outro titular recusada; banco: T-DB-07. O limite de 5 fica com "Minhas chaves" (fora da V1): só existe a chave CPF |
| `domain-model.md` 3.4 | `PixTransfer`: `amount` > 0; pagador ≠ recebedor; transições só pela máquina de estados; `AWAITING_AUTH` expira em 10 min | Domínio: cada transição permitida e cada proibida; banco: `CHECK`s e T-DB-10 |
| `domain-model.md` 3.4 | Snapshot do recebedor (nome e documento mascarado) na criação; CPF completo nunca exposto ao pagador | Rota: resposta da consulta e do Pix com as chaves exatas; documento sempre `•••.NNN.NNN-••` |
| `domain-model.md` 3.4 | `IdempotencyRecord`: (`userId`, `key`) único; mesma chave com payload diferente recusada; validade de 24 h | Aplicação e banco: T-DB-06; `IdempotencyKeyReused` (422) |
| `domain-model.md` 3.1 | `TransactionPin`: 5 erros → 30 min; acerto zera; 3º bloqueio em 24 h exige redefinir | Já provado no domínio (semana 3); novo: contador atômico sob concorrência e pela rota |
| `domain-model.md` 3.5 | `PIX_CREATED`, `PIX_COMPLETED`, `PIX_FAILED`, `PIX_CANCELLED`, `PIN_LOCKED` na mesma transação; `metadata` sem CPF, chave completa, PIN ou token | Teste de cada caso de uso confere o evento e o `metadata` permitido |
| `domain-model.md` 4 | Máquina de estados: nasce em `AWAITING_AUTH`; `Authorize` → `PROCESSING` → `COMPLETED`/`FAILED` na mesma transação; `CANCELLED` por cancelamento, PIN bloqueado ou expiração | Domínio e rota: cada caminho do diagrama |
| `domain-model.md` 4 | Checagem dupla: saldo e limite no `Create` e de novo no `Authorize` | Caso de uso: saldo que muda entre os dois → `FAILED` no `Authorize` |
| `domain-model.md` 5 e 6 | Pix interno: débito em `customer:A`, crédito em `customer:B`; falha não grava lançamento | Integração: partidas, saldos e snapshot da contraparte nas duas partidas |
| `domain-model.md` 7 | Limites R$ 5.000 (6h–20h) e R$ 1.000 (20h–6h) em `America/Sao_Paulo`; mínimo R$ 0,01; expiração 10 min | Domínio com `Clock` controlado: 5h59, 6h, 19h59, 20h; R$ 1.000,00 e R$ 1.000,01 à noite |
| `domain-model.md` 7 | Consulta de chave: 30 por hora por cliente; inexistente conta em dobro | Rota: 31ª consulta → 429; 15 inexistentes → 429 |
| `domain-model.md` 8 | Cadastro cria a chave Pix CPF na mesma transação | Falha forçada na criação da chave → nada gravado em nenhum schema |
| `domain-model.md` 9 | Erros do catálogo, com `remainingAttempts` e `limit` quando úteis | Teste de rota de cada erro (status, `code` e campos extras) |
| `database.md` 2 | Valor da chave Pix é pessoal sensível: cifrado (AES-256-GCM) + índice cego (HMAC) + versão mascarada | Banco: a coluna não contém o CPF em claro (API-06) |
| `database.md` 5.4 | `CHECK`s de `pix_transfers` (valor, pagador ≠ recebedor, descrição, status e coerência de datas); `UNIQUE end_to_end_id`; PK `(user_id, key)` | T-DB-10 e um teste por `CHECK` |
| `database.md` 6 | `nextbank_app`: `SELECT, INSERT` em `pix_keys`; `UPDATE` só nas colunas de estado de `pix_transfers`; `DELETE` só em `idempotency_records` | T-DB-13 estendido ao schema `payments` |
| `database.md` 7 | `AuthorizePix`: idempotência → Pix `FOR UPDATE` → PIN `FOR UPDATE` → contas `FOR SHARE` → contas contábeis em ordem de ID → saldo e limite → lançamento → status → auditoria e resposta → `COMMIT` | T-DB-06, T-DB-08, T-DB-09 e T-DB-14 no nível do Pix; revisão da ordem no PR |
| ADR 0004 / AUTH-04 | PIN no servidor em todo Pix; autorizar exige sessão ativa no banco | Token de sessão revogada → 401 no `AuthorizePix` e no `VerifyPin` |
| ADR 0007 | `Idempotency-Key` (UUID) obrigatória em comandos financeiros; mesma chave + payload → mesma resposta; payload diferente → 422; em andamento → 409 | T-DB-06; rota sem o header → 422 |
| ADR 0010 | Payments é dono do Pix e chama os outros por portas; o cadastro só sequencia | dependency-cruiser e revisão |
| PIX-01 | Pagador do token; Pix de outro cliente → 404 | B lê, autoriza e cancela o Pix de A → 404 nas três rotas |
| PIX-02 | Repetição não repete o Pix | Mesma requisição 2× → mesma resposta e 1 lançamento; T-DB-05 e T-DB-06 |
| PIX-03 | Mesmo saldo gasto uma vez | T-DB-08 e T-DB-09 pela rota de autorização |
| PIX-04 | Valor e campos adulterados | `-1`, `0`, `0.001`, `1e20`, `"100"`, `payerAccountId` extra → 422 |
| PIX-05 | Força bruta no PIN, com contador por usuário | 6ª tentativa → 423; contador sobrevive a Pix diferentes e a tentativas paralelas |
| PIX-06 | Pix sem PIN impossível pela API | Não existe caminho para `COMPLETED` sem `VerifyPin` (teste da rota sem `pin` → 422) |
| PIX-07 | Varredura de chaves | Rate limit da consulta; documento mascarado |
| PIX-08 | Autorizar Pix expirado ou fora de ordem | Após 10 min → 409 `TransferExpired`; duas vezes → 409 `InvalidTransferState`, inclusive em paralelo |
| PIX-09 | Repúdio | `PIX_COMPLETED` traz `sessionId` e `requestId`; ID E2E na resposta |
| PIX-10 | Horário do aparelho manipulado | Só o `Clock` do servidor; nenhum campo de horário aceito no corpo |
| API-04 | Nada sensível nos logs | `redact` cobre `pin`, `value` da chave e `Idempotency-Key`; teste que loga o corpo da consulta e do Pix |
| F-16 | Rota de verificação do PIN para o Desbloqueio, com o mesmo contador do Pix | `POST /v1/me/pin/verify`: acerto → 204; erro → `PinIncorrect`; 5 erros (somados com tentativas no Pix) → `PinLocked` |
| ASVS: lógica de negócio | Fluxo em ordem, limites no servidor, idempotência e concorrência | PIX-02, PIX-03, PIX-08, PIX-10 |
| ASVS: controle de acesso | Dono verificado em todo recurso | PIX-01 |

## Estrutura

```
apps/api/src/
├── application/onboarding/register-customer.ts   # + cria a chave Pix CPF (só sequencia)
├── modules/payments/
│   ├── domain/          # PixKey, PixTransfer (máquina de estados), TransferLimits, EndToEndId, erros
│   ├── application/     # LookupPixKey, CreatePixTransfer, AuthorizePixTransfer, CancelPixTransfer,
│   │                    # GetPixTransfer, CreateCpfKey; Idempotency; portas IdentityPort, AccountsPort, LedgerPort
│   ├── infrastructure/  # repositórios Pg, contador de consultas em memória
│   ├── http/            # rotas /v1/pix/...
│   └── index.ts
├── modules/identity/
│   ├── application/verify-pin.ts                  # VerifyPin (rota do Desbloqueio e porta do Payments)
│   └── http/pin-route.ts                          # + POST /v1/me/pin/verify
└── shared/infrastructure/pii-protector.ts         # AES-GCM + HMAC, movido do Identity (D7)
```

- **Payments → Identity:** verificar o PIN dentro da transação do Pix (com `FOR UPDATE` no PIN), confirmar a sessão ativa e ler o nome do titular para o snapshot. O mapa de contextos ganha "lê nome do titular" nessa seta (D6).
- **Payments → Accounts:** conta do pagador pelo usuário, conta e status do recebedor, `FOR SHARE` nas duas.
- **Payments → Ledger:** `postJournalEntry` com `kind = 'PIX_INTERNAL'`, `reference_type = 'PIX_TRANSFER'` e o snapshot da contraparte em cada partida; saldo disponível para a pré-checagem do `Create`.
- **Cadastro:** `RegisterCustomer` passa a chamar `payments.createCpfKey(tx, { accountId, cpf })` depois do funding.
- **dependency-cruiser:** Payments importa só os `index.ts` de Identity, Accounts e Ledger; nenhum deles importa Payments.

## Concorrência

| Cenário | O que acontece | Teste |
|---|---|---|
| Mesma `Idempotency-Key` em paralelo | O segundo `INSERT` em `idempotency_records` espera o primeiro terminar e devolve a resposta guardada; se esperar mais que o `lock_timeout`, recebe 409 `RequestInProgress` | T-DB-06: 10 requisições iguais em paralelo → 1 Pix, 1 lançamento, 10 respostas iguais |
| Dois Pix de R$ 80 sobre R$ 100 autorizados em paralelo | Contas contábeis travadas em ordem de ID; o segundo lê o saldo já debitado → `FAILED (INSUFFICIENT_FUNDS)`, sem lançamento | T-DB-08 pela rota: um `COMPLETED`, um `FAILED`; saldo final R$ 20 |
| 50 Pix A→B e 50 B→A autorizados em paralelo | Ordem fixa de locks: nenhum deadlock | T-DB-09 pela rota; reconciliação bate |
| O mesmo Pix autorizado duas vezes em paralelo (chaves diferentes) | `FOR UPDATE` no Pix: o segundo vê `COMPLETED` → 409 `InvalidTransferState` | Teste de concorrência da autorização |
| Tentativas de PIN em paralelo, em Pix diferentes ou no Desbloqueio | `FOR UPDATE` no PIN: cada tentativa conta uma vez; a 5ª errada bloqueia | 10 PINs errados em paralelo → exatamente 5 contados, as outras recebem `PinLocked` |
| Saldo muda entre `Create` e `Authorize` | A checagem do `Authorize` é a que vale | Caso de uso com dois Pix criados e autorizados em sequência |
| Pix expira durante a autorização | `expires_at` lido com o Pix travado e o horário do `Clock` | Teste com `Clock` em 10 min e 1 ms |
| Carga mista | 1.000 Pix aleatórios entre 10 contas, em paralelo | T-DB-14: saldo materializado = Σ partidas em todas as contas; Σ de todos os saldos de cliente constante (D11) |
| Consultas de chave em paralelo | Contador em memória atualizado sem `await` entre a leitura e a escrita (lição do F-11) | 40 consultas paralelas → exatamente 30 atendidas |

## Contratos

**Rotas** (todas autenticadas; negar por padrão já vale):

| Rota | Entrada | Resposta | Erros |
|---|---|---|---|
| `POST /v1/me/pin/verify` | `{ pin }` | 204 | 401; 422 `PinIncorrect` (`remainingAttempts`); 423 `PinLocked`, `PinResetRequired`; 409 `PinNotCreated` (D8); 422 `InvalidRequest` |
| `POST /v1/pix/key-lookups` | `{ type: "CPF", value }` | 200 `PixKeyLookup` `{ keyType, keyMasked, payeeName, payeeDocumentMasked }` | 404 `PixKeyNotFound`; 429 `TooManyAttempts`; 422 `InvalidRequest` |
| `POST /v1/pix/transfers` | header `Idempotency-Key`; `{ key: { type, value }, amount: Money, description? }` | 201 `PixTransfer` (`AWAITING_AUTH`) | 404 `PixKeyNotFound`; 422 `SamePayerAndPayee`, `InvalidAmount`, `InsufficientFunds`, `LimitExceeded` (`limit`), `AccountBlocked`, `IdempotencyKeyReused`; 409 `RequestInProgress`, `PinNotCreated` |
| `POST /v1/pix/transfers/{transferId}/authorize` | header `Idempotency-Key`; `{ pin }` | 200 `PixTransfer` (`COMPLETED`, com `endToEndId`) | 404 `NotFound` (inclui Pix de outro cliente); 422 `PinIncorrect`, `InsufficientFunds`, `LimitExceeded`, `PayeeUnavailable`; 423 `PinLocked`, `PinResetRequired`; 409 `TransferExpired`, `InvalidTransferState`, `RequestInProgress`; 401 sessão revogada |
| `POST /v1/pix/transfers/{transferId}/cancel` | — | 200 `PixTransfer` (`CANCELLED`) | 404 `NotFound`; 409 `InvalidTransferState` |
| `GET /v1/pix/transfers/{transferId}` | — | 200 `PixTransfer` (comprovante) | 404 `NotFound` |

- **`PixTransfer`:** `{ id, status, amount: Money, description, payee: { name, documentMasked, keyType, keyMasked }, endToEndId, failureReason, createdAt, expiresAt, completedAt }`, com `null` nos campos ainda sem valor. Nenhum ID de conta, nem do pagador, nem do recebedor (READ-02).
- **`amount`:** o `Money` da semana 4, inteiro em centavos > 0; acima do limite vigente → `LimitExceeded`.
- **`description`:** opcional, até 140 caracteres, sem caracteres de controle, sem espaço nas pontas.
- **`pin`:** 4 dígitos; formato inválido → 422 `InvalidRequest` sem contar tentativa.
- **Schemas OpenAPI novos (F-10):** `VerifyPinRequest`, `PixKeyLookupRequest`, `PixKeyLookup`, `CreatePixTransferRequest`, `AuthorizePixTransferRequest`, `PixTransfer`, `PixPayee`, na lista de schemas aprovados do `openapi.test.ts`. Cliente Dart regenerado.
- **Teste de contrato "nenhuma rota com ID no caminho" (READ-05):** passa a aceitar só as três rotas de `{transferId}` acima, numa lista aprovada, cada uma com o próprio teste de IDOR (D3). ID ou número de conta continua proibido em qualquer rota.
- **Erros novos no código** (já no catálogo): `PinIncorrect`, `PinLocked`, `PinResetRequired`, `PixKeyNotFound`, `SamePayerAndPayee`, `InvalidAmount`, `InsufficientFunds` (agora exposto), `LimitExceeded`, `AccountBlocked`, `PayeeUnavailable`, `TransferExpired`, `InvalidTransferState`, `IdempotencyKeyReused`, `RequestInProgress`. **Novo no catálogo:** `PinNotCreated` (D8).

**Banco** (migration nova, papel `nextbank_migrator`):

| Objeto | Detalhes |
|---|---|
| `payments.pix_keys` | Como no `database.md` 5.4: `type CHECK`, `value_ciphertext`, `value_hmac`, `value_masked`, `key_version`, **`UNIQUE (type, value_hmac)`**, `account_id` sem FK entre schemas |
| `payments.pix_transfers` | Colunas do ERD; todos os `CHECK`s da seção 5.4; `UNIQUE (end_to_end_id)`; `currency CHECK = 'BRL'` |
| `payments.idempotency_records` | PK `(user_id, key)`; `operation`; `request_hash bytea` (D4); `status CHECK`; `response_status`, `response_body jsonb`; `expires_at` |
| `ledger.journal_entries` | Sem mudança: `PIX_INTERNAL` e o `UNIQUE (reference_type, reference_id, kind)` já existem |
| `GRANT`s | `nextbank_app`: `SELECT, INSERT` em `pix_keys` (nada altera uma chave antes de "Minhas chaves"); em `pix_transfers`, `SELECT, INSERT` e `UPDATE` só nas colunas de estado (o que foi pedido nunca muda); em `idempotency_records`, `SELECT, INSERT, DELETE` e `UPDATE` só da resposta |

Os índices `pix_transfers (payer_account_id, created_at DESC)`, `pix_transfers (expires_at) WHERE status = 'AWAITING_AUTH'`, `pix_keys (account_id)` e `idempotency_records (expires_at)` não entram: nenhuma query desta semana os usa. Cada um entra com a sua consulta (extrato de Pix, job de expiração, "Minhas chaves" e job de limpeza).

**Queries novas e índices** (cada uma com `EXPLAIN ANALYZE` no PR):

| Query | Índice |
|---|---|
| Chave pela busca (`type`, `value_hmac`) | `UNIQUE (type, value_hmac)` |
| Pix pelo ID e pelo pagador (`id = $1 AND payer_account_id = $2`, com e sem `FOR UPDATE`) | PK |
| Registro de idempotência (`INSERT … ON CONFLICT DO NOTHING` e leitura) | PK `(user_id, key)` |
| PIN do usuário `FOR UPDATE` | PK de `transaction_pins` |
| Contas do pagador e do recebedor `FOR SHARE` | PK de `accounts` e `UNIQUE (holder_user_id)` |
| Contas contábeis em ordem de ID `FOR UPDATE` | PK (já existente) |

**Configuração:** nenhuma variável nova. As chaves `PII_ENCRYPTION_KEY` e `PII_HMAC_KEY` passam a servir também ao Payments (D7).

## Dependências novas

Nenhuma. O fuso de São Paulo vem do `Intl` do Node; o ID E2E e o hash da idempotência vêm do `node:crypto`.

## Decisões a confirmar (com padrão recomendado)

| # | Decisão | Padrão recomendado |
|---|---|---|
| D1 | Limites por transação e noturno | **Entram nesta semana**, apesar de o roadmap listá-los como extra: o threat model (PIX-10), o checklist ASVS e o catálogo (`LimitExceeded`) os marcam para a semana 5, e sem eles a regra de horário do servidor fica sem teste. O roadmap é corrigido no PR do plano |
| D2 | Consulta de chave | Rota própria `POST /v1/pix/key-lookups`, com o valor da chave no corpo: CPF não vai para URL, log de acesso nem cache (ASVS, dados fora de URLs). A tela 7 mostra o recebedor antes do valor, então a consulta é separada da criação; a criação busca a chave de novo, sem confiar em nada guardado no app |
| D3 | ID do Pix no caminho | `/v1/pix/transfers/{transferId}` nas três rotas, com UUIDv7 (74 bits aleatórios, inviável de adivinhar) e dono verificado em cada uma (PIX-01). O teste de contrato do READ-05 passa a ter uma lista aprovada de rotas com ID; conta continua proibida. Alternativa descartada: ID no corpo, que só esconde o mesmo identificador |
| D4 | Hash do payload da idempotência | **HMAC-SHA256 com a chave do servidor** (prefixo `idempotency:`) da operação, do `transferId` e do corpo canônico **sem o PIN**. Na implementação (Tarefa 4b), o SHA-256 simples previsto aqui virou HMAC: o corpo da criação traz o CPF do recebedor, que um hash sem chave deixaria recuperar de um dump. Sem o PIN porque um hash de 4 dígitos se reverte em 10.000 tentativas, então ele nunca é guardado nem em hash fora do Argon2id. Mesma chave com outro PIN devolve a resposta guardada (a chave é por tentativa: o app gera uma nova a cada PIN digitado) |
| D5 | Respostas de erro na idempotência | Erros de negócio (PIN incorreto, saldo insuficiente, expirado) também são guardados como resposta da chave, junto com o commit da falha (ADR 0007). Erro técnico desfaz tudo, inclusive o registro da chave, e permite nova tentativa |
| D6 | Nome do recebedor | O Payments lê o nome pela porta do Identity e o grava no snapshot; o mapa de contextos ganha "lê nome do titular" na seta Payments → Identity. A consulta mostra o **nome completo** e o documento mascarado, como no Pix real e no comprovante; o "nome mascarado" da tela 7 (`domain-model.md` 11) é corrigido para "documento mascarado". Alternativa: mascarar o sobrenome na consulta e mostrar o nome completo só no comprovante |
| D7 | Criptografia da chave Pix | O `AesGcmCpfProtector` sai do Identity para `shared/infrastructure/pii-protector.ts`, com o tipo do dado no HMAC (separação de domínio: o HMAC do CPF do usuário e o da chave CPF não ficam iguais). Mesmas chaves de ambiente. Alternativa descartada: copiar o adaptador para o Payments (código duplicado de criptografia) |
| D8 | Cliente sem PIN tenta Pix ou Desbloqueio | Erro novo `PinNotCreated` (409) no catálogo, mensagem "Crie seu PIN para continuar."; o app já leva esse cliente à tela "Criar PIN", então o erro só aparece com app adulterado ou condição de corrida |
| D9 | Expiração | Verificada na autorização (Pix travado, `Clock` do servidor): vencido → `CANCELLED` com commit e 409 `TransferExpired`. O job que varre os vencidos fica para a semana 8, com o agendamento do deploy; até lá, um Pix vencido não autorizado só ocupa uma linha |
| D10 | ID de ponta a ponta | Formato do Bacen: `E` + ISPB fictício `00000000` + `AAAAMMDDHHmm` (UTC) + 11 caracteres alfanuméricos aleatórios (`node:crypto`), 32 no total; gerado na conclusão; `UNIQUE` no banco |
| D11 | T-DB-14 com 1.000 Pix | No caso de uso, com o hasher de PIN rápido dos testes (o Argon2id real levaria minutos); a rota e o Argon2id real ficam provados no T-DB-08 e no T-DB-09 |
| D12 | Usuários locais sem chave CPF | Recriar o banco local, como na D9 da semana 4 (sem ambiente publicado até a semana 8) |

## Fora desta semana

- App: telas do Pix, Desbloqueio, comprovante e extrato: semana 6.
- Chaves e-mail, telefone e aleatória, e a tela "Minhas chaves": extra, fora da V1 (`domain-model.md` 3.4).
- Job de expiração e job de limpeza da idempotência: semana 8, com o agendamento no deploy (D9).
- Limite acumulado por período: evolução (`domain-model.md` 7).
- Pix externo, `PROCESSING` longo e conta transitória: Fase 2.
- Trocar o PIN (`ChangePin`, exige senha) e redefinir após `PinResetRequired`: semana 7, com a tela Segurança.

---

## Tarefa 0 — Plano (antes do código)

- [x] Este plano aprovado; roadmap corrigido (D1); mapa de contextos e tela 7 atualizados (D6); `PinNotCreated` no catálogo (D8)

## Tarefa 1 — Banco (dia 1)

- [x] Migration do schema `payments`, com os testes de banco escritos antes: T-DB-05 (dois `PIX_INTERNAL` para o mesmo Pix), T-DB-07, T-DB-10, um teste por `CHECK` e T-DB-13 estendido
- [x] `pii-protector` movido para `shared/infrastructure` com separação de domínio no HMAC (D7), testes migrados

## Tarefa 2 — Domínio, TDD estrito (dia 1–2)

- [ ] `PixKey` (CPF do titular, valor normalizado e mascarado)
- [ ] `PixTransfer`: criação, cada transição da seção 4, expiração, snapshot do recebedor
- [ ] `TransferLimits` com `Clock` e fuso de São Paulo; `EndToEndId` (D10)

## Tarefa 3 — PIN e cadastro (dia 2)

| Ameaça | Teste escrito antes |
|---|---|
| PIX-05 | 5 erros pela rota → 423; contador compartilhado entre a rota e o Pix; 10 tentativas paralelas → 5 contadas |
| AUTH-04 | Sessão revogada → 401 no `POST /v1/me/pin/verify` |
| F-16 | Acerto → 204 e tentativas zeradas |

- [ ] `VerifyPin` no Identity (rota e porta do Payments), com `PinNotCreated` (D8)
- [ ] Cadastro cria a chave CPF na mesma transação; falha forçada → nada gravado

## Tarefa 4 — Pix, outside-in (dia 3–4)

| Ameaça | Teste escrito antes |
|---|---|
| PIX-01 | B lê, autoriza e cancela o Pix de A → 404 |
| PIX-02 | Mesma requisição 2× → mesma resposta e 1 lançamento; payload diferente → 422 |
| PIX-04 | Valores e campos adulterados → 422 |
| PIX-07 | 31ª consulta → 429; inexistente conta em dobro |
| PIX-08 | Expirado → 409; autorizar duas vezes → 409 |
| PIX-09 | `PIX_COMPLETED` com `sessionId` e `requestId` |
| PIX-10 | `Clock` às 21h → limite noturno |

- [ ] `LookupPixKey` e rota, com o contador de consultas
- [ ] Idempotência (registro, hash sem PIN, resposta guardada, `RequestInProgress` por `lock_timeout`)
- [ ] `CreatePixTransfer`, `AuthorizePixTransfer` (ordem da `database.md` 7), `CancelPixTransfer`, `GetPixTransfer` e rotas
- [ ] Contrato: schemas novos, lista aprovada de rotas com ID (D3), cliente Dart regenerado
- [ ] `EXPLAIN ANALYZE` de cada query nova

## Tarefa 5 — Concorrência e fechamento (dia 5)

- [ ] T-DB-06, T-DB-08, T-DB-09 pela rota; autorização dupla em paralelo; T-DB-14 com 1.000 Pix (D11)
- [ ] `/security-review` (obrigatório: Pix, PIN, idempotência, ledger e autorização)
- [ ] Threat model e matriz de controles: PIX-01 a PIX-10 e AUTH-04 com evidência; checklist ASVS
- [ ] `database.md` (índices que ficaram para depois), `domain-model.md` (D6, D8), catálogo de erros, CHANGELOG
- [ ] D12: instrução para recriar o banco local no PR do cadastro

---

## Checkpoint de fim de semana

- [ ] Pix de ponta a ponta pela API: cadastro de A e B → consulta da chave → criação → autorização com PIN → comprovante; saldos de A e B corretos
- [ ] PIX-01 a PIX-10 e AUTH-04 com teste verde
- [ ] T-DB-05 a T-DB-10 e T-DB-14 verdes, com reconciliação conferida
- [ ] Cobertura ≥ 90% em `domain/` e `application/`
- [ ] Rota de verificação do PIN pronta para o Desbloqueio (F-16)
- [ ] Se a semana estourar: o cancelamento pelo cliente e a consulta do comprovante passam para o início da semana 6; idempotência, locks, PIN e testes de concorrência e de segurança não são cortados
- [ ] Próximo passo: plano da semana 6 (Pix no app, Desbloqueio, comprovante e extrato)
