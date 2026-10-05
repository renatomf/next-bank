# Plano — Semana 1: Arquitetura + Segurança

- **Spec:** `docs/superpowers/specs/2026-10-05-next-bank-roadmap-design.md` (seções 6, 8)
- **Carga:** ~30h (5 dias × 6h)
- **Objetivo:** fechar no papel tudo o que a semana 2 em diante vai implementar, para que nenhuma decisão de domínio ou segurança seja tomada no meio do código.
- **Pronto quando:** modelo de domínio, ERD, threat model, ADRs 001–008 e diagramas C4 estão commitados e revisados pelo desenvolvedor.

## Como trabalhamos nesta semana

- **Claude:** escreve o rascunho de cada documento a partir da spec.
- **Desenvolvedor:** revisa, questiona e decide. Nenhum documento é commitado sem revisão.
- **Diagramas:** em Mermaid dentro do Markdown (o GitHub renderiza; sem ferramenta extra).
- **Commits:** um por tarefa, no padrão `docs(<área>): <descrição>`.

## Decisões a confirmar durante a semana (com padrão recomendado)

| # | Decisão | Padrão recomendado | Tarefa |
|---|---|---|---|
| D1 | Tipos de chave PIX na V1 | CPF, e-mail, telefone, aleatória (EVP) | 1 |
| D2 | Limites PIX | R$ 5.000 por transação (dia); R$ 1.000 por transação (20h–6h) | 1 |
| D3 | Saldo de demonstração no cadastro | R$ 10.000,00 via `system:funding` | 1 |
| D4 | Algoritmo do JWT | EdDSA (Ed25519) | 3 |
| D5 | Duração das sessões | Access 15 min; refresh 30 dias, rotativo; sessão inativa expira em 7 dias | 3 |
| D6 | Política de senha | Mínimo 10 caracteres, checagem contra lista de senhas vazadas comuns, sem regras de composição | 3 |
| D7 | PIN de transação | 4 dígitos; bloqueio após 5 erros por 30 min; troca exige senha | 3 |
| D8 | Identificação do usuário | CPF (validado por dígito verificador) + e-mail | 1 |

---

## Tarefa 1 — Modelo de domínio (dia 1, ~6h)

**Arquivo:** `docs/architecture/domain-model.md`

**Conteúdo:**
- [ ] Linguagem ubíqua: glossário (conta, lançamento, entry, posted, available, hold, chave PIX, ID E2E, idempotência, conciliação)
- [ ] Mapa de contextos (Mermaid): Identity, Accounts, Ledger, Payments, Audit (+ Operations na Fase 3), com o tipo de relação entre eles
- [ ] Para cada agregado: atributos, invariantes, comandos e eventos de domínio
- [ ] Máquina de estados do `PixTransfer` (Mermaid `stateDiagram`), com quem dispara cada transição
- [ ] Plano de contas: `customer:<id>`, `system:funding`, `system:pix_clearing`
- [ ] Exemplos de lançamentos, em tabela débito/crédito:
  - funding do cadastro
  - PIX interno
  - PIX externo (Fase 2): envio, liquidação, falha/estorno
- [ ] Regras de limite (D2) e de horário (fuso `America/Sao_Paulo`)
- [ ] Decisões D1, D2, D3 e D8 registradas
- [ ] Mapa de navegação (Mermaid) das 15 telas da V1
- [ ] Estados de cada tela, ligados ao erro de domínio que os causa (ex.: `InsufficientFunds` → "Saldo insuficiente")

**Aceite:** dá para responder, só com o documento, "o que acontece no ledger quando um PIX interno de R$ 80 é feito e quando ele falha?"

**Commit:** `docs(architecture): modelo de domínio e plano de contas`

## Tarefa 2 — ERD e restrições do banco (dia 2, ~6h)

**Arquivo:** `docs/architecture/database.md`

**Conteúdo:**
- [ ] ERD (Mermaid `erDiagram`) com as tabelas da V1:
  - `users`, `sessions`, `refresh_tokens`, `transaction_pins`
  - `accounts`
  - `ledger_accounts`, `journal_entries`, `postings`
  - `pix_keys`, `pix_transfers`, `idempotency_records`
  - `audit_events`
- [ ] Para cada tabela: colunas, tipos (`bigint` para centavos, `timestamptz`, `uuid` v7), PK, FKs e índices
- [ ] Restrições como última barreira:
  - `CHECK (available_balance >= 0)`
  - `CHECK (amount > 0)` em postings
  - Σ postings por entry = 0 (trigger diferido ou verificação no repositório; decidir e justificar)
  - `UNIQUE (user_id, idempotency_key)`
  - `UNIQUE` em chave PIX (tipo + valor)
- [ ] Estratégia de lock: quais linhas recebem `FOR UPDATE` e em que ordem
- [ ] Política de migrations: só para frente, expand/contract
- [ ] Query do extrato com paginação por cursor (esboço do SQL + índice que a sustenta)

**Aceite:** cada invariante da Tarefa 1 tem uma linha mostrando onde ela é garantida (domínio, banco ou ambos).

**Commit:** `docs(architecture): ERD e restrições do banco`

## Tarefa 3 — Threat model (dia 3, ~6h)

**Arquivos:** `docs/security/threat-model.md`, `docs/security/checklist-asvs-masvs.md`

**Conteúdo do threat model:**
- [ ] Ativos: credenciais, tokens, PIN, saldo/ledger, dados pessoais (CPF), trilha de auditoria
- [ ] Diagrama de fluxo de dados com fronteiras de confiança (app ↔ API ↔ Postgres; Fase 2: API ↔ simulador)
- [ ] STRIDE para os fluxos **Login/Refresh** e **PIX criar → autorizar → processar**, uma linha por ameaça:

  | Ameaça | Categoria | Cenário | Mitigação | Teste | Semana |
  |---|---|---|---|---|---|

  Cobrir no mínimo: credential stuffing, roubo de refresh token, reuso de refresh, força bruta no PIN, IDOR em contas e transações, replay de requisição de PIX, PIX duplicado por retry, condição de corrida no saldo, adulteração de valor no cliente, vazamento de CPF em logs, enumeração de chaves PIX, tokens em armazenamento inseguro no celular.
- [ ] Decisões D4, D5, D6 e D7 registradas
- [ ] Riscos aceitos na V1 (ex.: sem vínculo de dispositivo até a fase futura), com justificativa

**Conteúdo do checklist:** os requisitos do OWASP ASVS L2 e do MASVS que se aplicam à V1, cada um com status (`planejado na semana X` ou `fora do escopo da V1`).

**Aceite:** toda mitigação aponta para um teste e uma semana do roadmap.

**Commit:** `docs(security): threat model e checklist ASVS/MASVS`

## Tarefa 4 — ADRs 001–008 (dia 4, ~6h)

**Arquivos:** `docs/adr/README.md` (índice e template) + um arquivo por ADR

**Template (MADR enxuto):** Contexto → Opções consideradas → Decisão → Consequências (positivas, negativas) → Status.

| ADR | Título | Ponto central a defender |
|---|---|---|
| 001 | Monorepo | pnpm workspaces + pacotes Flutter; por que não multi-repo |
| 002 | Monólito modular com DDD + hexagonal | Fronteiras verificadas no CI; caminho de extração para serviços |
| 003 | Flutter + Riverpod | Inclui "por que não React Native" e "por que não Bloc" |
| 004 | Autenticação | JWT EdDSA + refresh opaco rotativo + PIN no servidor; por que biometria não é controle |
| 005 | Ledger de partidas dobradas | Append-only, posted/available, plano de contas; por que saldo não é `UPDATE` |
| 006 | Value Object Money | `bigint` em centavos; por que nunca `double` |
| 007 | Idempotência e concorrência | Escopo (usuário, chave), validade de 24h, 409/422; locks ordenados + `CHECK` |
| 008 | Contrato único | Zod → OpenAPI → clientes gerados; plano B com DTOs manuais |

**Aceite:** cada ADR cabe em uma página e tem pelo menos uma consequência negativa honesta.

**Commit:** `docs(adr): ADRs 001-008`

## Tarefa 5 — C4, sequências e README inicial (dia 5, ~6h)

**Arquivos:** `docs/architecture/c4.md`, `docs/architecture/sequences.md`, `README.md`

**Conteúdo:**
- [ ] C4 nível 1 (contexto): cliente, operador (Fase 3), next bank, simulador do Bacen (Fase 2)
- [ ] C4 nível 2 (containers): app Flutter, API Fastify, Postgres, Sentry; Fase 2/3 marcadas como futuras
- [ ] Diagramas de sequência (Mermaid):
  - login + refresh com detecção de reuso
  - PIX interno: criar → autorizar com PIN → processar (com idempotência e locks)
- [ ] `README.md` inicial: nome, tagline, **aviso de projeto fictício sem relação com o next (Bradesco)**, objetivo, stack, links para spec, brief, ADRs e threat model, status "em construção"
- [ ] Revisão final da semana: conferir consistência entre os documentos

**Aceite:** um entrevistador entende o sistema só pelo README e pelos diagramas, em 5 minutos.

**Commit:** `docs: C4, diagramas de sequência e README inicial`

---

## Checkpoint de fim de semana

- [ ] As decisões D1–D8 estão registradas
- [ ] Nada na spec contradiz os documentos novos (se contradisser, atualizar a spec)
- [ ] Lista de dúvidas abertas para a semana 2, se houver
- [ ] Próximo passo: plano da semana 2 (esqueleto ponta a ponta)
