# Plano — Semana 4: Accounts + Ledger

- **Status:** Aprovado (2026-10-07), com as decisões D1–D10 nos padrões recomendados
- **Roadmap:** `docs/roadmap.md` (seção 8, semana 4)
- **Base:** ADRs 0005 (ledger), 0006 (`Money`), 0007 (concorrência) e 0010 (orquestração); `domain-model.md` (3.2, 3.3, 5, 6, 8, 9 e 11); `database.md` (5.2, 5.3, 6, 7, 10 e 11); threat model (READ-01, READ-02, API-05, MOB-05); brief (2.3, 3 e 7) e mockup `home-dark.png`
- **Carga:** ~30h (5 dias × 6h)
- **Objetivo:** todo cliente nasce com uma conta corrente e R$ 10.000,00 de saldo de demonstração, lançados num ledger de partidas dobradas que o banco não deixa adulterar; a Home mostra o saldo do próprio cliente, e só dele.
- **Pronto quando:** Σ débitos = Σ créditos garantido por teste (domínio e banco); "usuário A nunca lê a conta de B" provado por teste; concorrência sobre o mesmo saldo provada contra Postgres real; `/security-review` sem achados abertos; o app mostra o saldo na Home.

## Como trabalhamos nesta semana

- **Começa pelo `GET /v1/me`** (pendência da semana 3): hoje o app não sabe se o PIN já foi criado quando o cadastro é interrompido antes da tela do PIN.
- **O banco é a última barreira:** cada invariante do ledger tem a regra no domínio **e** a restrição no banco, cada uma com o próprio teste (`database.md`, seção 10).
- **Ataque antes da defesa:** o teste que tenta adulterar o ledger, gastar o mesmo saldo duas vezes ou ler a conta de outro cliente vem antes do código que impede.
- **Dois módulos novos copiam o molde do Identity:** `accounts` e `ledger`, cada um com `domain/`, `application/`, `infrastructure/`, `http/` (quando tiver rota) e `index.ts`.

## Critérios de engenharia

Os mesmos da semana 3 (Clean Architecture, DDD, SOLID, TDD, segurança, performance, observabilidade, legibilidade), verificados pelas mesmas ferramentas. Nesta semana pesam mais:

| Princípio | Como se verifica |
|---|---|
| **Correção financeira** | `Money` em centavos inteiros (TS `bigint`, Dart `int`); nenhum `number`/`double` para valor; Σ débitos = Σ créditos no domínio e no `COMMIT` |
| **DDD** | `Account` não guarda saldo; `LedgerAccount` e `JournalEntry` protegem as próprias invariantes; contextos conversam só pelas portas do mapa de contextos |
| **Concorrência** | Locks em ordem de ID e `CHECK` de saldo, provados com requisições paralelas contra Postgres real |
| **Performance** | `EXPLAIN ANALYZE` de cada query nova, com o índice que a sustenta |

## Fontes conferidas

Cada linha das fontes que a semana toca, com o teste que a prova.

| Fonte | Regra | Teste |
|---|---|---|
| `domain-model.md` 3.2 | Um cliente tem exatamente uma conta; agência `0001`; número sequencial com dígito verificador módulo 11 | Domínio: `Account` e cálculo do DV; banco: `UNIQUE (holder_user_id)` e `UNIQUE (branch, number)` |
| `domain-model.md` 3.2 | `Account` não guarda saldo | Revisão de código: a tabela `accounts.accounts` não tem coluna de valor |
| `domain-model.md` 3.3 | Conta `CUSTOMER`: saldo disponível ≥ 0; conta `SYSTEM` pode ficar negativa | Domínio: débito acima do disponível → `InsufficientFunds`; banco: T-DB-01 |
| `domain-model.md` 3.3 | Saldos só mudam por lançamento | Revisão: nenhum caminho do código atualiza saldo fora do `post`; reconciliação no teste de concorrência |
| `domain-model.md` 3.3 | Lançamento com ≥ 2 partidas, Σ débitos = Σ créditos, moeda única, valor > 0 | Domínio: `JournalEntry` recusa cada caso; banco: T-DB-02 e T-DB-02b |
| `domain-model.md` 3.3 / ADR 0005 | Lançamento imutável; correção só por estorno | Banco: T-DB-03 (`GRANT` e trigger) |
| `domain-model.md` 5 e 6 | Plano de contas `customer:<accountId>` e `system:funding`; funding debita `system:funding` e credita o cliente | Integração do cadastro: partidas e saldos conferidos |
| `domain-model.md` 8 | Cadastro numa só transação: usuário, conta, conta contábil, funding, auditoria (`ACCOUNT_OPENED`), sessão | Falha forçada em qualquer etapa → nada gravado em nenhum schema |
| `domain-model.md` 9 | `InsufficientFunds` (422); `NotFound` (404) inclui recurso de outro usuário | Testes de domínio e de rota |
| `domain-model.md` 11 | Home: skeleton · pronto · saldo oculto · erro (tentar de novo) | Testes de widget de cada estado ("sem movimentações" vai para a semana 6, D7) |
| `database.md` 5.3 | Contas `SYSTEM` sem saldo materializado e nunca travadas | Banco: `CHECK` que mantém saldo zero em conta `SYSTEM`; revisão da query de lock (`kind = 'CUSTOMER'`) |
| `database.md` 5.3 | `UNIQUE (reference_type, reference_id, kind)` | Banco: T-DB-05 adaptado (dois fundings para a mesma conta → o segundo é recusado) |
| `database.md` 6 | `nextbank_app` só com `SELECT, INSERT` em `journal_entries` e `postings` | T-DB-03; T-DB-13 estendido aos schemas novos |
| `database.md` 7 / ADR 0007 | `READ COMMITTED` + `FOR UPDATE` em ordem de ID, só em contas de cliente | T-DB-08 e T-DB-09 no nível do Ledger (D6) |
| ADR 0006 | `Money` imutável, só soma e subtrai na mesma moeda, nunca fração de centavo; JSON em centavos inteiros | Domínio (`Money` em TS e no app) e teste de contrato |
| ADR 0010 | O orquestrador só sequencia; regra de negócio fica nos módulos | dependency-cruiser e revisão do `RegisterCustomer` |
| READ-01 | Conta derivada do token; nenhum endpoint aceita ID ou número de conta | IDOR: com A e B cadastrados, o token de A só devolve a conta de A; `?accountId=` → 422 |
| READ-02 | Respostas só com os campos aprovados | Teste de contrato (lista de schemas aprovados) e teste das chaves exatas da resposta |
| READ-05 *(nova)* | Números de conta sequenciais permitiriam enumerar contas | Nenhuma rota aceita número de conta (mesmo teste do READ-01); linha nova no threat model |
| API-05 | Ledger append-only por `GRANT` e trigger | T-DB-03 |
| MOB-05 | Ocultar saldo | Teste de widget do `BalanceCard` oculto |
| ASVS: controle de acesso | Dono verificado; identificador de conta nunca vem do cliente | READ-01 |
| ASVS: validação | Valores monetários como inteiros validados | `Money` recusa fração, valor fora do intervalo seguro e moeda diferente |
| ASVS: logs e auditoria | Auditoria imutável; `ACCOUNT_OPENED` na mesma transação | Teste do cadastro confere o evento, sem dados pessoais no `metadata` |
| MASVS: código | Validação dos dados vindos da API | App recusa saldo fracionado ou ausente → estado de erro |
| Brief 2.3, 3, 7 e `home-dark.png` | `BalanceCard` (camadas da seda, painel de vidro, olho para ocultar, "Saldo disponível · Conta •••• NNNN"); valor com "R$", inteiro e centavos em estilos diferentes; saudação com o nome | Testes de widget de cada ponto (regra do F-14: conferir contra o mockup, não só contra o brief) |

## Estrutura

```
apps/api/src/
├── application/onboarding/register-customer.ts   # + abre conta e grava o funding (só sequencia)
├── modules/accounts/
│   ├── domain/          # Account, número da conta e DV
│   ├── application/     # OpenAccount, GetMyAccount; porta LedgerPort (definida aqui)
│   ├── infrastructure/  # PgAccountsRepository, sequência do número
│   ├── http/            # GET /v1/me/account
│   └── index.ts
├── modules/ledger/
│   ├── domain/          # LedgerAccount, JournalEntry, Posting
│   ├── application/     # PostJournalEntry, OpenCustomerLedgerAccount, GetBalance
│   ├── infrastructure/  # PgLedgerRepository (locks ordenados)
│   └── index.ts         # implementação da LedgerPort do Accounts
├── modules/identity/http/me-route.ts             # GET /v1/me
└── shared/domain/money.ts                        # Money (usado por Ledger, Accounts e, na semana 5, Payments)
```

- **Accounts → Ledger por porta** (mapa de contextos): o Accounts define a `LedgerPort` (abrir a conta contábil e ler o saldo disponível); o Ledger a implementa pelo `index.ts`. O Ledger não conhece o Accounts.
- **Cadastro:** `RegisterCustomer` passa a chamar, na mesma transação, `identity.register` → `accounts.openAccount` (que abre a conta contábil pela porta e grava `ACCOUNT_OPENED`) → `ledger.fund` com o valor da D3.
- **App:** `features/home` ganha `domain/` (conta e saldo), `data/` (cliente gerado) e `presentation/` (Home); o `design_system` ganha `BalanceCard`, `MoneyText`, `IconCircleButton`, `Skeleton` e `ErrorState`, cada um com a primeira tela que o usa. O provider de status da API (semana 2) sai, junto com a tela antiga.
- **dependency-cruiser:** as regras atuais já cobrem módulos novos; o Ledger não importa o Accounts (regra nova, para o mapa de contextos não inverter).

## Concorrência

| Cenário | O que acontece | Teste |
|---|---|---|
| 20 cadastros simultâneos | A sequência do Postgres entrega números distintos sem lock; cada cadastro abre a própria conta contábil | 20 cadastros em paralelo no caso de uso → 20 números distintos e válidos; Σ dos fundings = −saldo calculado de `system:funding` |
| O mesmo funding gravado duas vezes (bug ou repetição) | `UNIQUE (reference_type, reference_id, kind)` recusa o segundo, e a transação inteira volta | T-DB-05 adaptado |
| Dois débitos simultâneos de R$ 80 sobre R$ 100 na mesma conta | O segundo espera o lock da linha; ao ler o saldo já debitado, falha com `InsufficientFunds`; saldo final R$ 20 | T-DB-08 no nível do `PostJournalEntry` (D6) |
| 50 lançamentos A→B e 50 B→A em paralelo | Locks sempre em ordem de ID: nenhum deadlock; saldo materializado = Σ partidas | T-DB-09 no nível do `PostJournalEntry` (D6) |
| Bug que tenta deixar saldo de cliente negativo direto no banco | `CHECK (kind = 'SYSTEM' OR available_balance >= 0)` recusa | T-DB-01 |
| Leitura do saldo durante um lançamento | `READ COMMITTED` lê o último valor confirmado, sem lock e sem bloquear o lançamento | Revisão (consulta sem `FOR UPDATE`) |
| `system:funding` em todos os cadastros | Nunca travada nem atualizada (sem *hot account*): só recebe partidas | Revisão da query de lock e `CHECK` de saldo zero em conta `SYSTEM` |

## Contratos

**Rotas** (todas autenticadas; negar por padrão já vale):

| Rota | Resposta 200 | Erros |
|---|---|---|
| `GET /v1/me` | `Me`: `{ name, hasPin }` | 401 `Unauthenticated` |
| `GET /v1/me/account` | `MyAccount`: `{ branch, number, status, availableBalance: Money }` | 401 `Unauthenticated`; 404 `NotFound` (usuário sem conta: não deveria existir depois da D9); 422 `InvalidRequest` (qualquer query string) |

- **`Money`:** `{ amount: integer (centavos, ≥ 0 na resposta), currency: "BRL" }`. Saldo contabilizado (`posted`) não sai na V1: a Home só mostra o disponível (minimização, READ-02).
- **Schemas OpenAPI novos (F-10):** `Me`, `MyAccount`, `Money`, todos na lista de schemas aprovados do `openapi.test.ts`. Cliente Dart regenerado.
- **Erros do catálogo usados:** `Unauthenticated`, `NotFound`, `InvalidRequest`, `InsufficientFunds` (só interno nesta semana: nenhuma rota debita conta de cliente).

**Banco** (migrations novas, papel `nextbank_migrator`):

| Objeto | Detalhes |
|---|---|
| `accounts.accounts` | `id`, `holder_user_id UNIQUE`, `branch char(4) CHECK = '0001'`, `number` com `CHECK` de formato, `UNIQUE (branch, number)`, `status CHECK`, `opened_at`, `updated_at` |
| `accounts.account_number_seq` | Sequência do número (D4); `USAGE` para o `nextbank_app` |
| `ledger.ledger_accounts` | Como no `database.md` 5.3, mais `currency CHECK = 'BRL'` e **`CHECK (kind = 'CUSTOMER' OR (posted_balance = 0 AND available_balance = 0))`**: conta de sistema nunca materializa saldo |
| `system:funding` | Inserida pela migration, com UUID fixo |
| `ledger.journal_entries` | `kind CHECK ('FUNDING','PIX_INTERNAL')`, `UNIQUE (reference_type, reference_id, kind)` |
| `ledger.postings` | `CHECK (amount > 0)`, `CHECK (direction IN ('D','C'))`, FKs; **índice `(journal_entry_id)`** para a verificação diferida |
| Verificação diferida | Constraint triggers `DEFERRABLE INITIALLY DEFERRED` em `postings` **e** em `journal_entries` (sem a segunda, um lançamento sem nenhuma partida passaria: o trigger de `postings` nunca dispararia) |
| Imutabilidade | `BEFORE UPDATE OR DELETE` em `journal_entries` e `postings`; `REVOKE EXECUTE … FROM PUBLIC` nas funções |
| `GRANT`s | `nextbank_app`: `SELECT, INSERT, UPDATE` em `accounts.accounts` e `ledger.ledger_accounts`; só `SELECT, INSERT` em `journal_entries` e `postings` |

O índice do extrato (`postings (ledger_account_id, created_at DESC, id DESC)`) entra na semana 6, com a consulta que o usa.

**Queries novas e índices** (cada uma com `EXPLAIN ANALYZE` no PR):

| Query | Índice |
|---|---|
| `GET /v1/me`: nome + existência do PIN | PK de `users` e de `transaction_pins` |
| Conta pelo titular | `UNIQUE (holder_user_id)` |
| Conta contábil pelo código | `UNIQUE (code)` |
| Lock das contas de cliente (`id = ANY($1) AND kind = 'CUSTOMER' ORDER BY id FOR UPDATE`) | PK |
| Verificação diferida (soma das partidas do lançamento) | `postings (journal_entry_id)` |

**Configuração:** nenhuma variável de ambiente nova.

## Dependências novas

Nenhuma. A formatação de dinheiro no `design_system` é escrita no próprio pacote (separar "R$", inteiro e centavos é simples e não justifica o `intl`).

## Decisões a confirmar (com padrão recomendado)

| # | Decisão | Padrão recomendado |
|---|---|---|
| D1 | `Money` no TypeScript | `bigint` por dentro (ADR 0006); conversão para inteiro do JSON só na borda HTTP, recusando valor fora de `Number.isSafeInteger`; o `int8` do Postgres é lido como `bigint` só nos repositórios do Ledger (sem trocar o parser global, que mudaria o tipo de todo `count(*)`) |
| D2 | Quem abre a conta contábil | O Accounts, pela `LedgerPort`, dentro do `openAccount`: "toda conta de cliente tem uma conta contábil" é invariante da abertura, e o mapa de contextos já prevê essa porta. Alternativa descartada: o orquestrador chamar o Ledger direto (a invariante ficaria fora dos módulos) |
| D3 | Onde fica o funding | `ledger.fund(tx, accountId, valor)` chamado pelo `RegisterCustomer`, com o valor da D3 do modelo de domínio (R$ 10.000,00) como constante nomeada do onboarding: é política da demo, não regra do Ledger. Referência do lançamento: `reference_type = 'ACCOUNT'`, `reference_id = accountId`; contraparte "next bank" |
| D4 | Número da conta | Sequência do Postgres a partir de `100000`, seis dígitos + DV módulo 11 (resto 10 ou 11 → `0`), formato `NNNNNN-D`; o DV é calculado no domínio. Sem lock: a sequência já é segura sob concorrência, e um número perdido num rollback só deixa um buraco, sem efeito |
| D5 | Onde fica o `GET /v1/me/account` | No Accounts, que lê o saldo pela `LedgerPort`. Alternativa descartada: consulta na camada `application/` (o ADR 0010 a reserva para fluxos sem dono, e "minha conta" tem dono) |
| D6 | Lançamento genérico já nesta semana | `PostJournalEntry` completo agora, inclusive débito de conta de cliente com locks ordenados e `InsufficientFunds`, com T-DB-08 e T-DB-09 no nível do Ledger. Motivo: as invariantes são do Ledger e são testadas onde moram; na semana 5, o Pix só acrescenta a máquina de estados por cima. Custo: o caminho de débito de cliente nasce dois ou três dias antes do primeiro chamador em produção |
| D7 | Itens da Home que dependem de telas futuras | "Últimas movimentações" entra na semana 6, junto com o extrato (é a primeira página da mesma consulta, com o índice dela); atalhos (Área Pix) e a navegação flutuante nascem com as telas que abrem (semanas 6 e 7). Itens do mockup fora da V1 (Metas, Transferir, Pagar, Cobrar, suporte, notificações) não entram |
| D8 | Ocultar saldo | Nesta semana (MOB-05 e checklist marcam semana 4; o roadmap marcava como extra da 7, e será corrigido), em memória e visível por padrão; guardar a preferência fica para depois (não pode ir para `SharedPreferences`, MOB-01) |
| D9 | Usuários locais criados sem conta | Recriar o banco local (não há ambiente publicado; o deploy é na semana 8). Sem migration de dados: ela teria que gerar contas e lançamentos dentro do SQL só para dados de teste |
| D10 | Tela de Desbloqueio (lacuna da semana 3, achado F-16) | Rota de verificação do PIN na semana 5, junto com o `VerifyPin` (o contador de tentativas é o mesmo do Pix, PIX-05), e a tela na semana 6, antes do "Pix de ponta a ponta". Não entra nesta semana para não estourar a carga |

## Fora desta semana

- Chave Pix CPF no cadastro e todo o Payments: semana 5.
- Extrato, "últimas movimentações", atalhos e navegação flutuante: semanas 6 e 7 (D7).
- Tela de Desbloqueio e rota de verificação do PIN: semanas 5 e 6 (D10).
- Job de reconciliação interna (extra da semana): se a semana estourar, vai para o backlog. A reconciliação é conferida nos testes de concorrência desde já.
- Saldo contabilizado na API, bloqueio de conta (Fase 3) e preferência de saldo oculto persistida.

---

## Tarefa 0 — Registro da lacuna (antes do código)

- [x] F-16 no log de achados: o plano da semana 3 não incluiu a tela 5 (Desbloqueio), prevista no roadmap, no MASVS ("desbloqueio após tempo em segundo plano", semana 3) e no PIX-06. Falha de desenho: o plano de cada semana passa a conferir a tabela de telas do roadmap (seção 7.1)
- [x] Roadmap, threat model (PIX-06) e checklist: Desbloqueio, ocultar saldo e itens da Home nas semanas da D7, D8 e D10; "lock otimista" da seção 6.2 corrigido para o que o `database.md` e o ADR 0007 decidiram (`version` é contador; a concorrência é por `FOR UPDATE`)

## Tarefa 1 — `GET /v1/me` (dia 1)

- [ ] Teste HTTP antes da rota: sem token → 401; com token → `{ name, hasPin }` com as chaves exatas; `hasPin` muda depois do `POST /v1/me/pin`
- [ ] Rota no Identity; schema `Me` no contrato; cliente Dart regenerado
- [ ] App: depois do login e na restauração da sessão, sessão sem PIN vai para "Criar PIN" (TDD no redirect)

## Tarefa 2 — Banco e domínio, TDD estrito (dia 1–2)

- [ ] Migrations de `accounts` e `ledger` (seção Contratos), com os testes de banco escritos antes: T-DB-01, T-DB-02, T-DB-02b (lançamento sem partidas), T-DB-03, T-DB-05 adaptado e T-DB-13 estendido
- [ ] `Money` (TS): inteiro em centavos, mesma moeda, sem fração, conversão segura na borda (D1)
- [ ] `Account`: DV módulo 11, formato, status (só `ACTIVE` movimenta, regra usada a partir da semana 5)
- [ ] `LedgerAccount`: crédito aumenta, débito diminui; cliente nunca negativo (`InsufficientFunds`); sistema sem saldo materializado
- [ ] `JournalEntry`: ≥ 2 partidas, Σ débitos = Σ créditos, moeda única, valor > 0

## Tarefa 3 — Casos de uso e API, outside-in (dia 2–4)

| Ameaça | Teste escrito antes |
|---|---|
| READ-01 | A e B cadastrados: o token de A nunca devolve a conta de B; `GET /v1/me/account?accountId=<de B>` → 422 |
| READ-02 | `MyAccount` com as chaves exatas; schema novo fora da lista aprovada quebra o teste de contrato |
| READ-05 | Nenhuma rota aceita número ou ID de conta |
| API-05 | `UPDATE`/`DELETE` em `postings` e `journal_entries` recusados (T-DB-03) |
| Concorrência | 20 cadastros paralelos; T-DB-08 e T-DB-09 no `PostJournalEntry` |

- [ ] `PostJournalEntry` no Ledger: locks ordenados só em contas de cliente, verificação de saldo, partidas e saldos com `version` (D6)
- [ ] `OpenAccount` no Accounts, com a `LedgerPort` e `ACCOUNT_OPENED` na auditoria (D2)
- [ ] `RegisterCustomer`: conta, conta contábil e funding na mesma transação (D3); falha em qualquer etapa → nada gravado
- [ ] `GET /v1/me/account` (D5); schemas `MyAccount` e `Money`; cliente Dart regenerado
- [ ] `EXPLAIN ANALYZE` de cada query nova

## Tarefa 4 — App: Home (dia 4–5)

- [ ] `features/home`: repositório da conta (TDD), validação do saldo vindo da API (inteiro, moeda conhecida)
- [ ] `design_system`: `MoneyText` (formatação só aqui, ADR 0006), `BalanceCard` com ocultar saldo (D8), `IconCircleButton`, `Skeleton`, `ErrorState`, conferidos contra o `home-dark.png` e o `home-light.png`
- [ ] Home: saudação com o nome, título, `BalanceCard`; estados skeleton · pronto · saldo oculto · erro; contraste AA e escala de fonte 1.3×
- [ ] Sai o status da API da semana 2 (provider, repositório e testes), sem deixar código morto

## Tarefa 5 — Fechamento

- [ ] `/security-review` (obrigatório: ledger e autorização)
- [ ] Threat model: READ-05; READ-01, READ-02, API-05 e MOB-05 com evidência na matriz de controles
- [ ] `database.md`: sequência do número, `CHECK` de conta de sistema, índice `postings (journal_entry_id)` e o trigger em `journal_entries`
- [ ] `domain-model.md`: porta Accounts → Ledger também para o saldo (D5)
- [ ] ADR se alguma decisão D1–D10 mudar no caminho; CHANGELOG
- [ ] D9: instrução para recriar o banco local no PR que muda o cadastro

---

## Checkpoint de fim de semana

- [ ] Σ débitos = Σ créditos: domínio (`JournalEntry`) e banco (T-DB-02, T-DB-02b) verdes
- [ ] READ-01, READ-02, READ-05 e API-05 com teste verde
- [ ] T-DB-08 e T-DB-09 verdes, com reconciliação conferida
- [ ] Cobertura ≥ 90% em `domain/` e `application/`
- [ ] App: cadastro novo mostra R$ 10.000,00 na Home; ocultar saldo funciona; erro de rede mostra "tentar de novo"
- [ ] Se a semana estourar: o job de reconciliação vai para o backlog; os testes de concorrência e de segurança não são cortados
- [ ] Próximo passo: plano da semana 5 (Pix — backend), com a chave CPF no cadastro e a rota de verificação do PIN (D10)
