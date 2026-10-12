# Plano — Semana 8: Qualidade e produção

- **Status:** Aprovado (2026-10-12), com as decisões D1 a D10 nos padrões recomendados (Render Starter, API e banco em `us-east-1`, reset diário)
- **Roadmap:** `docs/roadmap.md` (seção 8, semana 8; seção 8.2, demo pública)
- **Base:**
  - ADRs 0004 (autenticação), 0008 (contrato) e 0009 (SQL puro, achados no Neon: papéis do painel ignoram os `GRANT`s, `verify-full` no deploy);
  - `c4.md` (Render + Neon) e `database.md` (papéis de menor privilégio);
  - threat model: DEMO-01 a DEMO-04, MOB-03 (só HTTPS), MOB-06 (build ofuscado), INFRA e OPS;
  - CLAUDE.md: E2E do fluxo crítico, testes de segurança obrigatórios, Sentry, orçamentos de performance e Definition of Done.
- **Carga:** ~30h (5 dias × 6h). Pela soma das tarefas, o mais provável é estourar para uma 9ª semana, que o roadmap já prevê ("8 a 9 semanas"). D1 diz o que sai primeiro.
- **Objetivo:** a V1 publicada e avaliável em menos de um minuto: API no Render, banco no Neon, APK nas Releases, contas de demonstração prontas e protegidas, o fluxo crítico provado de ponta a ponta, e a tag `v1.0.0`.
- **Pronto quando:**
  - o E2E Login → Pix → Comprovante → Extrato passa contra a API e o Postgres reais;
  - cada teste de segurança obrigatório do CLAUDE.md está mapeado para o arquivo que o prova;
  - a API publicada responde por HTTPS, com migrations aplicadas pelo papel de migração e a API rodando com o papel de menor privilégio;
  - Ana e Bruno existem na demo, não trocam senha nem PIN, e a demo volta ao estado limpo sozinha;
  - o APK de release é assinado com chave própria, ofuscado e aponta só para HTTPS;
  - os orçamentos de performance estão medidos e registrados;
  - o README tem o vídeo, o APK, as contas da demo e os diagramas.

## Achado do planejamento (F-27)

O threat model marca o **DEMO-03** (contas de demonstração não trocam senha nem PIN → 403) para a semana 7, mas o plano da semana 7 não o listou em "Fontes conferidas", e nada foi implementado. Conserto: entra nesta semana como exceção de segurança ao congelamento. Processo: o desenho de cada semana passa a filtrar o threat model pela coluna "Sem." e listar **toda** linha daquela semana.

## Fontes conferidas

| Fonte | Regra | Teste |
|---|---|---|
| DEMO-01 | Cadastro só com CPF fictício gerado no app | Já coberto (`cpf_test.dart`, `registration_flow_test.dart`) |
| DEMO-02 | Dados de visitantes não se acumulam | O reset (D5) volta o banco da demo ao estado limpo; teste do script de seed: rodar duas vezes deixa só Ana e Bruno |
| DEMO-03 | Contas de demonstração não trocam senha nem PIN, nem encerram sessões | Rotas: trocar PIN, trocar senha e encerrar sessão numa conta de demonstração → 403 `DemoAccountRestricted`, e nada muda no banco |
| DEMO-04 | Campos com limite de tamanho | Já coberto (descrição > 140 → 422) |
| MOB-03 | Só HTTPS fora do debug | Teste do manifesto: o release não permite tráfego em texto claro |
| MOB-06 | Build de release ofuscado | O workflow de release usa `--obfuscate --split-debug-info` e R8; conferido no log do CI |
| ADR 0009 | Migrations pelo papel `nextbank_migrator` pelo host direto; API com `nextbank_app`; `sslmode=verify-full` | Teste de configuração: a API recusa subir sem `sslmode=verify-full` em produção; smoke test após o deploy |
| CLAUDE.md, Testes | E2E do fluxo crítico | `integration_test` (D2) |
| CLAUDE.md, Testes | Segurança: IDOR, idempotência, concorrência, rate limit, reuso de refresh, bloqueio de PIN | Mapa na tarefa 2: cada item → arquivo; o que faltar ganha teste |
| CLAUDE.md, Observabilidade | Todo erro inesperado chega ao Sentry, com release e ambiente, sem PII | Teste do `beforeSend`: CPF, tokens, senha e PIN removidos (D7) |
| CLAUDE.md, Performance | p95 < 200 ms nas leituras e < 400 ms no Pix; início a frio < 2 s | Medição registrada (D8) |
| CLAUDE.md, Segredos | Nada sensível no git | `.gitignore` atualizado antes de gerar a chave de assinatura, o `.env` de produção ou qualquer arquivo do Sentry; gitleaks no CI |

## Estrutura

```
apps/api/
├── src/modules/identity/   DemoAccountRestricted; a regra fica nos casos de uso
├── db/migrations/          users.is_demo (só o seed liga; nenhuma rota escreve)
└── scripts/seed-demo.ts    cria Ana e Bruno pelos casos de uso reais (idempotente)

apps/mobile/
├── integration_test/       E2E do fluxo crítico
└── android/                assinatura de release lida de variáveis do CI

.github/workflows/
├── ci.yml                  + job E2E (D2)
├── deploy.yml              migrations → deploy da API → smoke test (D4)
├── release.yml             tag v* → APK assinado e ofuscado nas Releases (D6)
└── demo-reset.yml          agendado: Neon volta ao branch limpo (D5)
```

## Concorrência

| Cenário | O que acontece | Teste |
|---|---|---|
| Dois visitantes usando Ana ao mesmo tempo | As regras de sempre: Pix idempotente, travas em ordem, saldo nunca negativo | Já coberto pelos testes de concorrência das semanas 5 e 7 |
| Reset da demo com visitantes conectados | O branch do Neon é recriado; as sessões abertas deixam de existir e o app volta ao login no próximo refresh (401) | Smoke test depois do reset: login de Ana funciona |
| Seed rodando duas vezes | Idempotente: a conta existente é mantida | Teste de integração do seed |

## Contratos

- **Erro novo:** `DemoAccountRestricted` (403): "Esta é uma conta de demonstração. Para testar essa função, crie sua própria conta." Entra no catálogo do `domain-model.md` e no app (`api_messages`).
- **Banco:** `identity.users.is_demo boolean NOT NULL DEFAULT false`. Nenhuma query nova de leitura em rota quente: o caso de uso já carrega o usuário.
- **Configuração nova da API:** `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `APP_RELEASE`; `DATABASE_URL` de produção com `sslmode=verify-full`.
- **Configuração nova do app:** `API_BASE_URL` (HTTPS) e `SENTRY_DSN` por `--dart-define` no release.
- **Segredos novos (GitHub e Render, nunca no git):** chave de assinatura do Android (base64) e senhas, `NEON_API_KEY`, `MIGRATION_DATABASE_URL`, deploy hook do Render, DSNs do Sentry.

## Dependências novas

| Dependência | Para quê | A conferir no PR |
|---|---|---|
| `@sentry/node` (API) | Erros inesperados com release e ambiente | Licença MIT, manutenção ativa, tamanho |
| `sentry_flutter` (app) | Idem no app | Licença MIT, manutenção ativa, impacto no APK |
| `reactivecircus/android-emulator-runner` (CI) | Emulador para o E2E | Fixada por SHA, como as outras actions |
| `autocannon` (dev, API) | Carga nominal para medir o p95 | Licença MIT; só em `devDependencies` |

## Decisões a confirmar (com padrão recomendado)

| # | Decisão | Padrão recomendado |
|---|---|---|
| D1 | Prioridade, se a semana estourar | Na ordem: DEMO-03 → deploy → contas da demo e reset → APK de release → E2E → mapa dos testes de segurança → Sentry → performance → README e vídeo → tag. O que não couber vai para a semana 9; nada de segurança é cortado |
| D2 | E2E | `integration_test` do Flutter (já vem com o SDK) contra a API e o Postgres em Docker, num emulador. No CI, roda em todo PR que toque `apps/mobile` ou `apps/api`, além de localmente antes da tag |
| D3 | Hospedagem e região | API no Render e banco no Neon, **na mesma região dos EUA (Virginia, `us-east-1`)**. O Render não tem São Paulo; com o Neon em `sa-east-1`, cada query cruzaria o continente (~120 ms) e o p95 de 200 ms ficaria inviável. O app no Brasil paga a viagem uma vez por requisição, não por query |
| D4 | Como o deploy acontece | Workflow `deploy.yml`, manual e no merge na `main`: aplica as migrations com o papel de migração pelo host direto, chama o deploy hook do Render (deploy automático do Render desligado) e faz o smoke test (`/health` e login de Ana) |
| D5 | Reset da demo | Branch do Neon: um branch "limpo" com as migrations e o seed, e o branch da demo recriado a partir dele por um workflow agendado. Nenhum código apaga lançamentos do ledger (que só aceita inclusão): o banco inteiro volta a um ponto anterior. Frequência: **diária**, para que um PIN de Ana bloqueado por visitantes não dure mais que um dia |
| D6 | APK de release | Chave de assinatura gerada localmente, guardada só como segredo do GitHub; build no workflow `release.yml` ao criar a tag `v*`, ofuscado e com R8, publicado nas Releases. O `.gitignore` ganha `*.jks`, `*.keystore` e `key.properties` antes de gerar a chave |
| D7 | Sentry | Entra na API e no app, com remoção de PII no `beforeSend` (CPF, tokens, senha, PIN, corpo das requisições). Plano gratuito |
| D8 | Performance | Carga nominal com `autocannon` contra a API publicada (leituras e Pix das contas de demonstração), p95 lido do próprio resultado e conferido no `responseTime` dos logs; início a frio medido no celular com `flutter run --profile --trace-startup`. Resultados num doc de performance |
| D9 | Plano do Render | **Starter (pago, cerca de US$ 7/mês):** o gratuito dorme após 15 min sem uso e a primeira requisição leva quase 1 min, o que quebra a promessa de "avaliável em menos de um minuto". Alternativa: gratuito, com aviso no README |
| D10 | Extras do roadmap | Profiling e emulador no navegador ficam em "Próximos passos" |

## Fora desta semana

- Biometria, compartilhar comprovante, "Minhas chaves", animações e e-mail e CPF no Perfil (decisões das semanas 6 e 7).
- iOS: sem Mac para testar; o README diz que a V1 é publicada para Android.
- Domínio próprio: a API usa o endereço do Render.

---

## Tarefa 0 — Plano (antes do código)

- [x] Este plano aprovado; F-27 no log de achados; `DemoAccountRestricted` no catálogo do `domain-model.md`

## Tarefa 1 — DEMO-03 (dia 1)

- [ ] Migration `is_demo`; ataque antes da defesa: trocar PIN, trocar senha e encerrar sessão numa conta de demonstração → 403
- [ ] Mensagem no app; `/security-review`

## Tarefa 2 — Testes de segurança e E2E (dias 1–2)

- [ ] Mapa: cada teste de segurança obrigatório → arquivo; lacunas com teste
- [ ] E2E Login → Pix → Comprovante → Extrato em `integration_test`, local e no CI

## Tarefa 3 — Produção (dias 2–3)

- [ ] Neon (região, papéis criados por SQL, não pelo painel, por causa dos achados do ADR 0009) e Render; `deploy.yml` e smoke test
- [ ] Seed das contas da demo e `demo-reset.yml`
- [ ] Sentry na API e no app

## Tarefa 4 — App de release (dia 4)

- [ ] Chave de assinatura, `release.yml`, APK ofuscado apontando para HTTPS; checkpoint no celular com o APK

## Tarefa 5 — Medição, README e tag (dias 4–5)

- [ ] Performance medida e registrada (D8)
- [ ] README: vídeo, APK, contas da demo, diagramas e retenção dos dados
- [ ] Threat model, matriz, checklist, CHANGELOG; tag `v1.0.0`
