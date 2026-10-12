# Plano — Semana 8: Qualidade e produção

- **Status:** Aprovado (2026-10-12), com as decisões D1 a D10 nos padrões recomendados (API e banco em `us-east-1`, reset diário). D9 revista no mesmo dia: hospedagem sem custo (Render gratuito + despertador)
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
├── demo-reset.yml          agendado: Neon volta ao branch limpo (D5)
└── keep-awake.yml          agendado: mantém a API gratuita acordada (D9)
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
| D9 | Plano do Render | **Gratuito, sem custo nem cartão** (decisão do desenvolvedor). O gratuito dorme após 15 min sem uso; o workflow `keep-awake.yml` chama o `/health` a cada ~10 min para mantê-lo acordado (as 750 h gratuitas por mês cobrem um serviço ligado o mês todo). O agendamento do GitHub pode atrasar: o README avisa que a primeira abertura pode levar até 1 min. A instância gratuita tem pouca CPU, e o Argon2id do login e do PIN não é afrouxado; se o p95 do Pix passar de 400 ms, o número medido e o desvio entram no ADR 0012, como consequência da hospedagem gratuita |
| D10 | Extras do roadmap | Profiling e emulador no navegador ficam em "Próximos passos" |

## Fora desta semana

- Biometria, compartilhar comprovante, "Minhas chaves", animações e e-mail e CPF no Perfil (decisões das semanas 6 e 7).
- iOS: sem Mac para testar; o README diz que a V1 é publicada para Android.
- Domínio próprio: a API usa o endereço do Render.

---

## Tarefa 0 — Plano (antes do código)

- [x] Este plano aprovado; F-27 no log de achados; `DemoAccountRestricted` no catálogo do `domain-model.md`

## Tarefa 1 — DEMO-03 (dia 1)

- [x] Migration `is_demo`; ataque antes da defesa: trocar PIN, trocar senha e encerrar sessão numa conta de demonstração → 403
- [x] Mensagem no app; `/security-review` (sem achados; risco residual do bloqueio por palpites registrado no DEMO-03)

## Tarefa 2 — Testes de segurança e E2E (dias 1–2)

- [ ] Mapa: cada teste de segurança obrigatório → arquivo; lacunas com teste
- [x] E2E Login → Pix → Comprovante → Extrato em `integration_test`, verde no emulador local (13 s); no CI pelo `e2e.yml`

### Desenho do E2E

**Fluxo:** o app de verdade, num emulador Android, contra a API e o Postgres de verdade:
1. login de Ana com a senha;
2. Home, mostrando o saldo;
3. Área Pix: R$ 1,00 para a chave CPF de Bruno, revisão e PIN;
4. comprovante "Concluído";
5. "Voltar ao início": o saldo caiu exatamente R$ 1,00;
6. "Ver extrato": o "Pix enviado" está lá, e o detalhe dele abre o mesmo comprovante.

| Peça | Onde | O que faz |
|---|---|---|
| Teste | `apps/mobile/integration_test/critical_flow_test.dart` | Dirige o app pelo `main()` real, com os repositórios HTTP. Espera cada tela pelo que aparece nela, sem tempo fixo. Não depende do saldo inicial: compara o saldo antes e depois |
| Contas | `apps/api/scripts/seed-demo.ts` (adiantado da tarefa 3) | Cria Ana e Bruno pelos casos de uso reais (cadastro e PIN, com CPFs fictícios fixos e documentados) e os marca como demonstração com o papel de migração. É idempotente: rodar de novo mantém as contas |
| CI | `.github/workflows/e2e.yml` | Em PR que toque `apps/`, `packages/` ou o próprio workflow, e no push na `main`: Postgres → papéis → migrations → chaves geradas na hora → API em segundo plano → `/health` → seed → emulador (API 34, x86_64, KVM) → `flutter test integration_test` com `API_BASE_URL=http://10.0.2.2:3000` |
| Local | README do app | Os mesmos passos com o Docker e o emulador da máquina |

**Decisões:**
- **As contas vêm do seed, e não de um cadastro feito pelo teste.** O cadastro tem limite de 3 por IP por hora (AUTH-09), e o E2E precisa poder rodar de novo; esse limite não é afrouxado por causa dos testes. Ana, de demonstração, faz Pix normalmente; só não troca credenciais (DEMO-03).
- **Valor de R$ 1,00:** as execuções repetidas gastam pouco do saldo de demonstração, que o reset diário recompõe.
- **Segurança:** as chaves da API no CI são geradas na hora e descartadas com o runner; nada vai para o git nem para os segredos. O seed só roda com a URL do papel de migração, e nunca é chamado pela API.

**Dependências novas:**
- `integration_test`, que vem com o SDK do Flutter;
- `reactivecircus/android-emulator-runner` v2.38.0 (Apache-2.0), fixada por SHA, como as outras actions.

**Fora:** iOS (sem Mac) e E2E de cadastro, que o limite de cadastro impede de repetir; o cadastro já é coberto pelos testes de app e de API.

- [x] Desenho do E2E aprovado (2026-10-12)

## Tarefa 3 — Produção (dias 2–3)

- [x] Neon (Postgres 17, `us-east-1`, papéis por SQL, branches `clean` e `demo`) e Render no ar; `deploy.yml` rodado em 2026-10-12: migrations, deploy hook, release no `/health`
- [x] ADR 0012: hospedagem da V1 (Render gratuito + Neon em `us-east-1`, despertador, consequências para a performance)
- [x] Seed das contas da demo e `demo-reset.yml`: restauração pelo Neon, migrations, seed pela API publicada e smoke test verdes em produção (2026-10-12)
- [ ] Sentry na API e no app

### Desenho da tarefa 3

Três PRs: (a) API pronta para produção; (b) infraestrutura e workflows; (c) Sentry, com o próprio desenho quando chegar a vez.

**(a) API pronta para produção (código, com testes antes)**

| Peça | O que muda | Teste |
|---|---|---|
| `TRUST_PROXY` | Número de proxies confiáveis: 0 no local, 1 no Render. Sem ele, atrás do proxy todos os clientes dividiriam um contador de tentativas, e um atacante bloquearia o login de todos pelo IP (AUTH-01, API-02). Só o último salto do `X-Forwarded-For` vale, para que o cliente não forje o próprio IP | Rotas de login: com 1 proxy, IPs diferentes no `X-Forwarded-For` têm contadores diferentes; um `X-Forwarded-For` forjado antes do salto confiável não muda o contador; com 0, o cabeçalho é ignorado |
| TLS no banco | Com `NODE_ENV=production`, a API recusa subir se a `DATABASE_URL` não tiver `sslmode=verify-full` (achado do ADR 0009) | Configuração: produção sem `verify-full` → erro ao iniciar; local continua aceitando `disable` |
| Seed por HTTP | O `seedDemoAccounts` passa a falar por uma porta mínima (requisição → status e JSON), com dois adaptadores: em processo (`app.inject`, testes) e HTTP (`fetch` para a API publicada). No reset diário, o seed fala com a API publicada, e as chaves de produção (JWT, PII, pepper do PIN) **ficam só no Render**, nunca nos segredos do GitHub | O teste do seed roda pelos dois adaptadores (o HTTP contra uma API de teste ouvindo numa porta local) |

**(b) Infraestrutura e workflows**

| Peça | O que faz |
|---|---|
| `infra/neon/bootstrap.sql` | Cria `nextbank_migrator` e `nextbank_app` **por SQL**, com o dono do Neon, nunca pelo painel: papéis do painel entram no `neon_superuser` e ignoram os `GRANT`s (ADR 0009). Mesmos limites de tempo do local |
| `.github/workflows/deploy.yml` | No push na `main` (depois do CI) e manual: migrations com o papel de migração pelo host direto do Neon (`verify-full`) → deploy hook do Render (deploy automático do Render desligado, para a migration vir sempre antes do código) → smoke test (`/health` e login de Ana, até 5 min) |
| `.github/workflows/keep-awake.yml` | A cada ~10 min, `GET /health` na API publicada (D9) |
| `.github/workflows/demo-reset.yml` | Todo dia às 06:00 UTC e manual: o branch da demo no Neon volta ao branch `clean` (só papéis, sem dados) pela API do Neon → migrations → seed por HTTP → smoke test. Nenhum código apaga lançamentos do ledger (D5) |
| ADR 0012 | Hospedagem da V1: Render gratuito + Neon gratuito em `us-east-1`, despertador, deploy pelo GitHub e as consequências (primeira abertura lenta, CPU fraca para o Argon2id, p95 a medir) |
| `docs/operations.md` | Passo a passo do que **o desenvolvedor** faz nas contas (Neon, Render, segredos do GitHub) e como gerar as chaves de produção localmente, sem que passem pelo git |

**Segredos e onde ficam**

| Valor | Onde fica | Quem cria |
|---|---|---|
| Chaves da API (JWT, PII, pepper do PIN), `DATABASE_URL` (pooler, `verify-full`) | Só nas variáveis de ambiente do Render | Desenvolvedor, com `generate-dev-keys.ts` na própria máquina |
| `MIGRATION_DATABASE_URL` (host direto, `verify-full`), `NEON_API_KEY`, `RENDER_DEPLOY_HOOK` | Segredos do GitHub (ambiente `production`) | Desenvolvedor |
| `API_URL`, `NEON_PROJECT_ID`, IDs dos branches | Variáveis do GitHub (não são segredo) | Desenvolvedor |

**Concorrência:** um reset durante um Pix derruba as conexões; o app recebe erro e "Tentar de novo", e as contas voltam limpas. Deploy e reset não rodam ao mesmo tempo: os dois usam o mesmo grupo de `concurrency`.

**Dependências novas:** nenhuma (`fetch` é nativo do Node).

**Fora:** domínio próprio, staging (roadmap, seção 3: um ambiente publicado) e alarmes (o Sentry vem no PR c).

- [ ] Desenho da tarefa 3 aprovado

## Tarefa 3.5 — Ajustes visuais (antes do APK e do vídeo)

Pedido do desenvolvedor depois do checkpoint da semana 7, com o app do C6 como referência **só de layout**. A foto não entra no repositório, porque tem marca e layout de terceiros e um nome real; o visual continua o do next bank.

**Itens e decisões**

| # | Pedido | Decisão |
|---|---|---|
| V1 | Erro escondido atrás da barra, em texto branco | Entra, como defeito. O teste que reproduz o problema vem antes da correção |
| V2 | Olho no campo de senha | Entra |
| V3 | Logo à direita do "Boa tarde, Ana"; tirar "Seu dinheiro, um passo à frente." | Entra. O slogan sai; o "ajuda com IA" fica para depois da tag |
| V4 | Barra de navegação como na referência | Entra só a parte de legibilidade: rótulo embaixo de cada ícone e a barra encaixada no rodapé, acima dos botões do Android. O redesenho maior fica para depois da tag |
| V5 | Logo do Pix | Ícone próprio (`Icons.swap_horiz` com o rótulo "Pix"), sem a marca do Banco Central. A marca é liberada só a instituições participantes do Pix, e o projeto proíbe marcas de terceiros sem licença |
| — | "Ajuda com IA" e atalhos de serviços sem tela | Depois da tag, em "Próximos passos" do roadmap. Botão sem ação quebra a acessibilidade e frustra quem testa a demo |

**Desenho**

| Peça | Onde | O que muda | Teste |
|---|---|---|---|
| `NbToast` | `design_system` | Aviso no topo da tela, por cima do conteúdo, nas cores do tema e com ícone. Some sozinho em 4 s ou com um toque, e o leitor de tela o anuncia (`liveRegion`) | Widget: aparece, é anunciado e some |
| Erros de recarga | Home, Extrato e Segurança | Quando já há dados na tela e a recarga falha (puxar para atualizar, voltar ao app), os dados ficam e o erro vem em `NbToast`. Sem dados, o bloco de erro com "Tentar de novo" continua no lugar dele, sempre acima da barra | Primeiro o que reproduz: a recarga falha e o erro não pode ficar coberto pela barra |
| `NbTextField` | `design_system` | Com `obscureText`, ganha o olho "Mostrar senha"/"Ocultar senha" (área de toque de 48 dp). Começa oculto, e o valor não sai do campo (MOB-02) | Widget: alterna, rótulo certo, começa oculto |
| Cabeçalho da Home | `home_screen.dart` | Saudação à esquerda e `NextLogo` à direita; sem o slogan | Widget e varredura de acessibilidade |
| `NbNavBar` | `design_system` (substitui a `FloatingNavBar`) | Barra no rodapé, com a cor da superfície e uma borda em cima. Cada destino tem ícone e rótulo; o Pix fica no centro, em destaque. Respeita a área dos botões do Android (`SafeArea`) | Widget: rótulos, selecionado anunciado, sem estouro em 320 px a 1.3x; os testes de navegação continuam |

- **Concorrência:** não se aplica, porque nada disso tem estado compartilhado nem chamada nova.
- **Contratos e dependências:** nenhum.
- **Fora:** "ajuda com IA", atalhos de serviços e o redesenho geral, depois da tag.

- [x] Desenho aprovado (2026-10-12), feito antes da tarefa 2 para o E2E já rodar sobre a barra nova
- [x] V1 a V5 implementados, com a varredura de acessibilidade verde nos dois temas
- [ ] Checkpoint no celular

### Segunda rodada (V6 a V10), pedida depois da primeira

O desenvolvedor reviu três pontos que a primeira rodada tinha adiado.

**Decisões do desenvolvedor (2026-10-12):**
- **Exceção à regra de marcas de terceiros:** o símbolo oficial do Pix entra, só o símbolo, sem o texto "powered by Banco Central". O README avisa: "Pix é marca do Banco Central do Brasil; o next bank é um projeto fictício, sem vínculo com o Banco Central ou com o arranjo Pix".
- **Atalhos e ajuda sem tela:** entram como "Em breve". Ao tocar, mostram o toast "Em breve." Assim continuam botões com ação, acessíveis e honestos com quem testa. As telas de verdade ficam para depois da tag.
- **Símbolo do Pix:** convertido uma vez para um `CustomPainter` em Dart, sem `flutter_svg`.

| # | O que muda | Onde | Teste |
|---|---|---|---|
| V6 | `PixMark`: o símbolo oficial do Pix (#32BCAD) desenhado pelo caminho do SVG oficial, com o rótulo "Pix" para o leitor de tela. Substitui o ícone de transferência no centro da barra e no atalho "Área Pix". O texto ao lado garante o sentido mesmo quando o símbolo tem pouco contraste no tema claro | `design_system` | Widget: desenha no tamanho pedido e é anunciado como "Pix" |
| V7 | Atalhos em linha de quatro: Área Pix (funciona), Pagar, Transferir e Recarga (avisam "Em breve."). O `ActionTile` passa a aceitar um widget como ícone, para o `PixMark` | Home | Os três "Em breve" mostram o toast e não navegam; varredura de acessibilidade |
| V8 | Cabeçalho: ícone de perfil (o mesmo da barra) num círculo, o primeiro nome do cliente e o logo à direita. A saudação sai, junto com o `greetingFor` e o teste dela | Home | Widget: ícone, primeiro nome e logo na mesma linha; sem saudação |
| V9 | Campo "Posso te ajudar?" acima dos atalhos, em pílula, com o ícone `auto_awesome` na cor de destaque. É um botão (não um campo de texto) que avisa "Em breve: assistente com IA." | Home | Toque mostra o aviso; rótulo para o leitor de tela |
| V10 | Barra do Android como no C6: o app desenha de ponta a ponta (edge-to-edge), a barra do sistema fica transparente e sem a faixa de contraste forçado, e os ícones do sistema ficam claros no tema escuro e escuros no claro. O fundo da `NbNavBar` continua por trás dos botões do Android | `main.dart` | Widget: o estilo da barra do sistema segue o tema, nos dois temas |

- `NbToast` ganha um ícone opcional: o "Em breve" usa o ícone de informação, e os erros continuam com o de erro.
- **Concorrência, contratos e dependências:** nenhum.
- **Roadmap:** "Próximos passos" muda para "telas de verdade do assistente e dos atalhos".

- [x] Desenho da segunda rodada aprovado (2026-10-12)
- [x] V6 a V10 implementados, com a varredura de acessibilidade verde nos dois temas
- [ ] Checkpoint no celular da segunda rodada
- [ ] Aviso da marca Pix no README (tarefa 5)

### Terceira rodada (V11 a V14)

| # | O que muda | Onde | Teste |
|---|---|---|---|
| V11 | Ao lado do "Posso te ajudar?", dois botões redondos: "Ajuda" (`help_outline`) e "Notificações" (`notifications_none`). Os dois avisam "Em breve." e têm área de toque de 48 dp | Home | Toque mostra o aviso; rótulos; celular pequeno a 1.3x sem estouro |
| V12 | Cartão de saldo: a palavra "Saldo" no lugar do logo | `BalanceCard` | Widget: mostra "Saldo" e não tem o logo |
| V13 | Atalhos do mesmo tamanho: rótulo em uma linha, que encolhe só o necessário para caber ("Transferir" não quebra mais), e os quatro com a mesma altura | `ActionTile` e Home | Widget: os quatro com o mesmo tamanho; rótulo numa linha só |
| V14 | O olho esconde só o saldo, na Home e na tela do Pix; os valores do extrato e do detalhe ficam sempre visíveis. O saldo **começa escondido** a cada abertura do app, e a escolha continua só na memória | `balanceHiddenProvider`, Home, Extrato e detalhe | Começa escondido; o olho alterna; as movimentações mostram o valor com o saldo escondido |

- **V14 muda a decisão D8 da semana 6** (o olho escondia também os valores das movimentações), a pedido do desenvolvedor. Começar escondido protege mais a abertura do app; já os valores das transações à vista entregam parte da informação. O MOB-05 e a matriz de controles registram a troca.
- **Código morto:** sem nenhuma tela escondendo valores de movimentação, o parâmetro `hidden` sai do `TransactionItem`, junto com os testes dele.
- **Concorrência, contratos e dependências:** nenhum.

- [x] Desenho da terceira rodada aprovado (2026-10-12)
- [x] V11 a V14 implementados, com a varredura de acessibilidade verde nos dois temas
- [ ] Checkpoint no celular da terceira rodada
- [x] V15: degradê na barra de navegação, do `surface2` no topo ao `background` no rodapé, nos tons de cada tema, como na referência; os rótulos seguem AA na varredura de contraste

## Tarefa 4 — App de release (dia 4)

- [ ] Chave de assinatura, `release.yml`, APK ofuscado apontando para HTTPS; checkpoint no celular com o APK
- [ ] Ícone do app (adaptativo: "next" em Sora Bold e o ponto verde-menta) e splash nativa (fundo da marca e ícone, Android 12+)
- [ ] Visual da tela Splash, pedido pelo desenvolvedor com uma imagem de referência (seda de vidro verde), o logo e um slogan. Decisões pendentes: o fundo recriado em código com o `Silk` (sem asset) ou a imagem, só com licença comprovada; o slogan "Finance at your fingertips" ou em pt-BR; nenhuma espera artificial (abertura a frio < 2 s)

## Tarefa 5 — Medição, README e tag (dias 4–5)

- [ ] Performance medida e registrada (D8)
- [ ] README: vídeo, APK, contas da demo, diagramas e retenção dos dados
- [ ] Threat model, matriz, checklist, CHANGELOG; tag `v1.0.0`
