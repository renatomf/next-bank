# Plano — Semana 2: Esqueleto ponta a ponta

- **Roadmap:** `docs/roadmap.md` (seção 8, semana 2; checkpoint 8.1)
- **Carga:** ~30h (5 dias × 6h)
- **Objetivo:** validar cedo as ferramentas de maior risco (SQL tipado e cliente Dart gerado) e deixar de pé a cadeia app → API → Postgres, com CI bloqueando merge.
- **Pronto quando:** o app chama a API pelo cliente gerado e exibe a resposta; CI verde nos dois apps é obrigatório para merge na `main`.

## Como trabalhamos nesta semana

- **Spikes primeiro.** Cada spike tem critério de saída e limite de tempo. Estourou o limite → plano B do ADR, sem insistir.
- **Código de spike é descartável.** Só a configuração das ferramentas aprovadas fica; o resultado vira uma seção "Resultado do spike" no ADR correspondente.
- **Simplicidade.** Cada peça entra quando o código precisa dela (CLAUDE.md).
- **TDD outside-in na API:** o teste HTTP contra Postgres real vem antes da rota.

## Decisões a confirmar (com padrão recomendado)

| # | Decisão | Padrão recomendado |
|---|---|---|
| D1 | Versão do Node | 24 LTS (já instalada), fixada em `engines` e no CI |
| D2 | Gerenciador de pacotes | pnpm via Corepack, versão fixada em `packageManager` (sem instalação global) |
| D3 | Postgres | 17, a mesma major no Docker e no Neon |
| D4 | Testes da API | Vitest + `fastify.inject` (sem servidor HTTP nem supertest) |
| D5 | Zod → OpenAPI | `fastify-type-provider-zod` + `@fastify/swagger` |
| D6 | Gerador do cliente Dart | `openapi-generator` (`dart-dio`) primeiro; `swagger_parser` se o primeiro falhar; limite total de 1 dia |

## Ajustes propostos ao roadmap da semana 2

| Item do roadmap | Proposta | Motivo |
|---|---|---|
| "Home exibe saldo vindo da API" | A Home exibe o status da API (`GET /health`) pelo cliente gerado; o saldo real chega na semana 4 | Sem autenticação (semana 3) e sem ledger (semana 4), um endpoint de saldo seria público, contra o "negar por padrão" |
| Navegação completa no GoRouter com telas vazias | Cada rota nasce com a sua tela | Princípio de simplicidade |
| Componentes base do `design_system` | Cada componente nasce com a primeira tela que o usa (a partir da semana 3) | Princípio de simplicidade |
| Spike do serviço privado no Render | Adiado para o deploy (semana 8) | Só a Fase 3 depende de rede privada; não bloqueia nada agora |
| gitleaks no pré-commit | Só no CI; push protection do GitHub já está ativa | Evita uma ferramenta de hooks a mais |

Aceitos os ajustes, o roadmap é atualizado no mesmo PR que fechar a semana.

---

## Tarefa 1 — Spike: SQL tipado (dia 1, limite 1 dia)

**Valida:** ADR 0009 (pgTyped + dbmate + Neon) com o caso do ledger.

> **Resultado:** banco e dbmate aprovados; pgTyped descartado em favor de tipos escritos à mão (ver ADR 0009, "Resultado do spike"). Neon validado; achados no ADR 0009.

- [ ] `infra/docker-compose.yml` com Postgres (D3)
- [ ] `pnpm-workspace.yaml`, `package.json` raiz e `apps/api` mínimo (só o necessário para o spike)
- [ ] Migration dbmate: papéis `nextbank_migrator` e `nextbank_app`; `journal_entries` e `postings` mínimas; constraint trigger diferido (Σ postings = 0); `GRANT` só de `INSERT`/`SELECT` para `nextbank_app`
- [ ] pgTyped gerando tipos para um `INSERT` de lançamento e um `SELECT … FOR UPDATE`
- [ ] A mesma migration aplicada num branch do Neon

**Critérios de saída:**
- tipos gerados a partir do banco real; uma query incompatível com o schema quebra o `typecheck`
- `UPDATE`/`DELETE` em `postings` com `nextbank_app` → `permission denied`
- lançamento desbalanceado → rejeitado no `COMMIT`
- comportamento idêntico no Docker e no Neon

**Se falhar:** Kysely (plano B do ADR 0009).

**Fica:** Compose, configuração do dbmate e do pgTyped, migration dos papéis. **Sai:** tabelas do ledger (voltam na semana 4, com TDD).

**Commit:** `docs(adr): record SQL toolchain spike result` (+ commits da configuração que fica)

## Tarefa 2 — Spike: cliente Dart gerado (dia 2, limite 1 dia)

**Valida:** ADR 0008 (Zod → OpenAPI → cliente Dart).

- [ ] Rota de exemplo com schemas Zod cobrindo os casos difíceis: inteiro em centavos, enum, campo opcional, erro RFC 7807
- [ ] OpenAPI gerado pela API (D5)
- [ ] Cliente Dart gerado em `packages/contracts` (D6)
- [ ] Teste Dart que desserializa respostas reais com o cliente gerado

**Critérios de saída:**
- nenhum ajuste manual no código gerado
- centavos como `int` (nunca `double`), enums tipados, opcionais como nulos
- regenerar sem mudanças produz diff vazio (base para o gate do CI)

**Se falhar:** plano B do ADR 0008 (DTOs escritos à mão + testes de contrato).

**Commit:** `docs(adr): record Dart client generator spike result`

## Tarefa 3 — API base (dia 3)

**Ameaças:** API-02, API-03, API-04, API-07, API-10.

Testes antes do código, contra Postgres real:
- [ ] `GET /health` → 200 com o banco acessível; 503 sem banco, sem detalhes internos
- [ ] Corpo acima de 16 KB → 413 (API-02)
- [ ] Erro inesperado → RFC 7807 genérico, sem stack nem SQL (API-03)
- [ ] Log de payload com senha, PIN, token, CPF, chave Pix e `authorization` sai redigido (API-04)
- [ ] Campo com `\n` não quebra a linha do log (API-10)
- [ ] `x-request-id` recebido é propagado ao log e à resposta; ausente → gerado
- [ ] Variáveis de ambiente validadas com Zod na inicialização; ausência derruba o boot com mensagem sem o valor
- [ ] A API conecta com `nextbank_app`, nunca com o papel de migração (API-07)

Também: TypeScript estrito (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), ESLint sem warnings, Prettier, `@fastify/helmet`, timeouts do servidor.

**Fora desta semana:** rate limit por rota (nasce com as rotas de auth, semana 3); CORS (não há cliente web até a Fase 3).

**Commits:** `test(api): …` antes de `feat(api): …`

## Tarefa 4 — CI (dia 4)

**Ameaças:** API-08, API-09.

- [ ] Workflow com filtro de caminho: Flutter (`format`, `analyze`, `test`) e API (`format`, `lint`, `typecheck`, `test` com Postgres de serviço)
- [ ] Gate do contrato: cliente regenerado ≠ commitado → falha
- [ ] gitleaks
- [ ] Actions fixadas por SHA; `permissions: contents: read`; `pnpm install --frozen-lockfile`
- [ ] Dependabot (`npm`, `pub`, `github-actions`)
- [ ] dependency-cruiser com a regra do domínio sem framework (entra com o primeiro módulo)
- [ ] Proteção da `main` exigindo o CI verde (configurada pelo desenvolvedor no GitHub)

**Extra (roadmap):** osv-scanner e Semgrep (com a regra contra SQL concatenado, API-01).

**Commit:** `ci: add Flutter and API workflows`

## Tarefa 5 — App conversa com a API (dia 5)

**Ameaças:** MOB-02, MOB-03.

- [ ] Notifier (Riverpod) consumindo o cliente gerado — teste antes do notifier
- [ ] Home exibe o status da API (carregando, ok, erro)
- [ ] URL da API por `--dart-define`; HTTP liberado só para o emulador em debug (`10.0.2.2`, `localhost`)
- [ ] Teste do MOB-03: build de release não aceita `http://`
- [ ] Dependências novas só as usadas aqui (Riverpod, Dio do cliente gerado)

**Extra:** Sentry na API e no app com limpeza de PII (MOB-02); deploy no Render + Neon.

**Commits:** `test(mobile): …` antes de `feat(mobile): …`

---

## Checkpoint de fim de semana

- [ ] Resultados dos spikes registrados nos ADRs 0008 e 0009
- [ ] App → API → Postgres funcionando localmente
- [ ] CI obrigatório na `main`
- [ ] Roadmap atualizado com os ajustes aceitos
- [ ] Se o esqueleto não estiver de pé: ativar o plano B dos contratos e reduzir o CI ao essencial (roadmap 8.1)
- [ ] Próximo passo: plano da semana 3 (Identity)
