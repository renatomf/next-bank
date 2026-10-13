# next bank — Matriz de controles de segurança (V1)

- **Atualizado em:** 2026-10-08 (fim da semana 5)
- **Objetivo:** mostrar, para cada controle de segurança esperado de um banco digital, o que **já está implementado** (com a evidência), o que **será implementado** (e em que semana) e o que foi **descartado ou adiado** (e por quê).
- **Fontes:** `threat-model.md` (ameaças e riscos aceitos), `checklist-asvs-masvs.md` (OWASP ASVS L2 e MASVS), ADRs 0004, 0007 e 0009, `docs/roadmap.md` (semanas e escopo congelado).
- **Regra:** um controle só é marcado como ✅ quando existe código **e** um teste ou verificação automática que o comprove.

**Legenda**

| Ícone | Significado |
|---|---|
| ✅ | Implementado e verificado (teste, gate de CI ou configuração conferida) |
| 🟡 | Em andamento: parte pronta, parte planejada |
| ⏳ | Planejado na V1 (semana indicada) |
| 🔭 | Adiado para depois da V1: risco aceito ou fora do escopo congelado |
| ➖ | Não se aplica à arquitetura atual (com o motivo) |
| 🚫 | Descartado (com o motivo) |

---

## 1. Autenticação e autorização

| Controle | Status | Como / evidência | Sem. |
|---|---|---|---|
| OAuth 2.0 / OIDC | ➖ | Não há terceiros nem login delegado: o app é o único cliente da própria API (ADR 0004). Os mecanismos de token seguem as boas práticas do OAuth 2.0 (token de acesso curto, refresh rotativo com detecção de reuso). Reavaliar se houver login social ou integração com parceiros. | — |
| Access token curto + refresh token | 🟡 | Agregado `Session` (#34); JWT EdDSA de 15 min com `kid` e `typ: at+jwt`, recusando `alg: none`, troca de algoritmo, outra chave, adulteração e claims ausentes (`jose-access-tokens.test.ts`, AUTH-05); refresh opaco de 256 bits guardado só como SHA-256 (`random-refresh-tokens.test.ts`); emitidos no cadastro, no login e no refresh. | 3 |
| Rotação e revogação de tokens | ✅ | `POST /v1/auth/refresh`: rotação a cada uso, janela de 10 s e revogação da sessão inteira no reuso, com `REFRESH_REUSE_DETECTED` e `SESSION_REVOKED` commitados antes do erro (AUTH-03). Concorrência: a sessão é travada (`FOR UPDATE`) e o token relido sob o lock; o banco garante um token ativo por sessão (índice único parcial). Refreshes simultâneos testados (`session-routes.test.ts`). | 3 |
| MFA / 2FA no login | 🔭 | Risco aceito no threat model (seção 7). Evolução: OTP por e-mail em dispositivo novo. | — |
| Segundo fator nas operações (step-up) | ✅ | PIN de transação verificado **no servidor** em todo Pix (ADR 0004): `POST /v1/pix/transfers/{id}/authorize` confere o PIN dentro da transação do Pix, com a linha do PIN travada, e nenhum caminho leva o Pix a `COMPLETED` sem ele (PIX-06, `authorize-pix-transfer.test.ts`, `authorize-route.test.ts`). O mesmo contador serve ao Desbloqueio (`POST /v1/me/pin/verify`, F-16) e ao Pix: 10 palpites paralelos contam 5, e o 5º erro somado entre Desbloqueio e Pix bloqueia e cancela o Pix (PIX-05, `pin-verify-route.test.ts`). Criação do PIN: uma vez só, Argon2id com pepper (API-13). Criar, autorizar e cancelar Pix e verificar o PIN conferem no banco se a sessão segue ativa (AUTH-04). | 3, 5 |
| RBAC / ABAC | ⏳ | V1 tem um único papel (cliente): a autorização é por **dono do recurso** (conta derivada do token, recurso alheio → 404). RBAC com perfis de equipe chega com o backoffice (Fase 3). | 4–6 |
| Princípio do menor privilégio | ✅ | Banco: papel `nextbank_app` sem atributos especiais, sem DDL, só os `GRANT`s necessários (`db-roles.test.ts`, `db-*-schema.test.ts`, API-11, T-DB-13). CI: `GITHUB_TOKEN` só com leitura. | 2–3 |
| Força bruta e credential stuffing | ✅ | PIN: 5 erros → 30 min, e o 3º bloqueio em 24 h exige redefinir com a senha (#35, `CHECK` no banco). Login: 5 erros por conta em 1 min bloqueiam a conta por 1, 2, 4, 8 e até 15 min, de qualquer IP, contando também e-mails inexistentes; 10 tentativas por IP por minuto contra credential stuffing (`login-attempts.test.ts`, `login-route.test.ts`, AUTH-01). Mesmo corpo 401 e uma verificação Argon2id em todo caminho, com hash fictício para e-mail inexistente (AUTH-02). | 3 |
| Session fixation | ✅ | Impossível por desenho: a sessão e os tokens são sempre criados pelo servidor no login, nunca aceitos do cliente; cada login abre uma sessão nova (`login.test.ts`, `login-route.test.ts`). | 3 |
| Session hijacking | 🟡 | Access token de 15 min, reuso de refresh detectado (#34), tokens só no Keychain/Keystore (MOB-01, semana 3), só HTTPS (MOB-03). Vínculo do aparelho (device binding): 🔭. | 3 |
| Logout e invalidação de sessão | ✅ | `POST /v1/auth/logout` (autenticado): revoga a sessão, idempotente, e o refresh token deixa de valer na hora (✅, AUTH-06). O access token expira em até 15 min (risco aceito, ADR 0004). Troca de senha (`POST /v1/me/password/change`) revoga as outras sessões na mesma transação (✅, semana 7), e um login correndo com a troca não abre sessão com a senha antiga (F-24). O cliente vê e encerra as próprias sessões na tela Segurança. | 3, 7 |
| Autenticação por padrão | ✅ | Toda rota exige `Authorization: Bearer` válido, salvo as declaradas públicas (`/health`, cadastro, login, refresh); esquecer a marcação fecha a rota. 401 `Unauthenticated` com `WWW-Authenticate: Bearer` (`session-routes.test.ts`). | 3 |

## 2. Segurança da API

| Controle | Status | Como / evidência | Sem. |
|---|---|---|---|
| Validação rigorosa de entrada | 🟡 | Zod em toda rota (type provider), corpo máximo de 16 KB (`http-security.test.ts`), `x-request-id` validado. Schemas estritos (campo desconhecido → 422) em cada rota: cadastro ✅ (`register-route.test.ts`, inclusive nome com espaços nas pontas ou caracteres de controle); Pix ✅: valor só como inteiro seguro de centavos, `-1`, `0`, `0.001`, `1e20` e `"100"` recusados, pagador e status nunca aceitos do corpo, descrição até 140 sem caracteres de controle, PIN com exatamente 4 dígitos e ID do Pix como UUID (PIX-04, `create-transfer-route.test.ts`, `authorize-route.test.ts`). | 2+ |
| Rate limiting / throttling | 🟡 | Global: 100 requisições/min por IP, 429 no formato do catálogo (✅, F-05). Cadastro: 3 tentativas por IP por hora, falhas incluídas (✅, AUTH-09). Login: 10 por IP por minuto e bloqueio progressivo por conta (✅, AUTH-01). Consulta de chave Pix: 30 por hora por cliente, chave inexistente conta em dobro, e a criação do Pix gasta a mesma cota porque a resposta nomeia o recebedor; descontada antes de qualquer `await` (✅, PIX-07, F-11, `lookup-pix-key.test.ts`: 40 consultas simultâneas → 30 atendidas). PIN: o bloqueio por tentativas cumpre o papel (seção 1). Em memória na V1 (D3). | 3, 5 |
| CORS | ✅ | Negado por padrão: a API não registra plugin de CORS, então o navegador bloqueia chamadas de outras origens (o app mobile não precisa de CORS). Falta um teste explícito, que entra na semana 3. | 2 |
| CSRF | ➖ | A autenticação usa `Authorization: Bearer`, e não cookies, então o navegador não envia credenciais automaticamente. Reavaliar no backoffice (Fase 3) se ele usar cookies. | — |
| SQL injection | ✅ | Só queries parametrizadas com `pg` (ADR 0009), sem ORM e sem SQL montado com strings; regra própria do Semgrep no CI (API-01). | 2+ |
| XSS | ➖ | A API só responde JSON (`Content-Type` explícito, com CSP do helmet), e o app Flutter não renderiza HTML. Reavaliar no backoffice web (Fase 3). | — |
| SSRF | ➖ | A API não faz requisições para URLs vindas do cliente. Regra: se isso surgir, só com lista de destinos permitidos. | — |
| IDOR / BOLA | 🟡 | Conta sempre derivada do token; **todo recurso tem teste de IDOR** (CLAUDE.md, READ-01, PIX-01). Feito para `GET /v1/me` e `GET /v1/me/account` (ID ou número de outra conta → 422, READ-05) e para o Pix: o ID vai no caminho (D3), mas todo acesso filtra pela conta do pagador, e recebedor, terceiro ou ID inexistente recebem o mesmo 404 no comprovante, no cancelamento e na autorização (`receipt-cancel-routes.test.ts`, `authorize-route.test.ts`). O contrato só aceita ID no caminho nas três rotas aprovadas do Pix (`openapi.test.ts`). Extrato: a conta vem só do token, `?accountId=` → 422, e um cursor montado com dados de outra conta não devolve nada alheio, porque o filtro por conta é feito no servidor (READ-01, READ-03, `statement-route.test.ts`). Faltam as rotas da semana 7 (sessões). | 4–7 |
| Paginação e consultas caras | ✅ | Extrato com página fixa de 20, sem parâmetro de tamanho (`limit=10000` → 422), cursor `(created_at, id)` opaco, validado no formato e no instante (F-20), e índice `postings_statement_idx`: `EXPLAIN ANALYZE` com `Bitmap Index Scan`, 0,73 ms numa conta com 217 partidas (#81). Pix novo entre duas páginas não duplica nem pula (T-DB-12) (READ-03, READ-04, `statement-route.test.ts`, `statement.test.ts`). | 6 |
| Minimização das respostas | 🟡 | Toda resposta sai de um schema com as chaves exatas, e o teste de contrato falha se surgir schema fora da lista aprovada (READ-02). Feito para cadastro, login, `GET /v1/me` (só `name` e `hasPin`) e `GET /v1/me/account` (sem ID, titular ou saldo contabilizado; conta mascarada no app) e Pix: a consulta de chave devolve só tipo, chave mascarada, nome e documento mascarado (D6), e o Pix nunca traz IDs de conta nem o CPF completo do recebedor (`key-lookup-route.test.ts`, `create-transfer-route.test.ts`). Extrato: cada item com as chaves exatas, documento mascarado e `transferId` só num Pix enviado (READ-02, D3, `statement-route.test.ts`). | 3–6 |
| Command injection | ➖ | A API não executa comandos do sistema. O único uso (`execFileSync` no setup dos testes) tem argumentos fixos e não usa shell. | — |
| Path traversal | ➖ | Nenhuma leitura ou escrita de arquivo a partir de entrada do cliente. | — |
| Headers de segurança | 🟡 | helmet (HSTS, CSP, `nosniff`…). `http-security.test.ts` verifica HSTS, `nosniff` e a ausência de `x-powered-by`. `Cache-Control: no-store` em toda resposta (✅, F-06). | 2, 3 |
| Versionamento de API | ⏳ | Prefixo `/v1` a partir das rotas de autenticação. | 3 |
| Contratos e schemas | ✅ | OpenAPI gerado dos schemas Zod, cliente Dart gerado e gate de divergência no CI (ADR 0008, job `Contracts`). | 2 |
| Idempotência em operações financeiras | ✅ | `Idempotency-Key` (UUID) obrigatória em criar e autorizar Pix; escopo (usuário, chave), validade de 24 h, HMAC da requisição com chave do servidor e sem o PIN (D4), resposta guardada, inclusive as recusas que mudam estado (D5). Registrada na mesma transação do comando: 10 criações simultâneas com a mesma chave → um Pix e dez respostas iguais (T-DB-06); a mesma chave com outro conteúdo → 422 (ADR 0007, PIX-02, `create-transfer-route.test.ts`, `authorize-route.test.ts`). No app, a chave (UUID v4 de `Random.secure`) nasce com cada tentativa e é reaproveitada em toda repetição dela: a resposta perdida é pedida de novo com a mesma chave e o mesmo PIN, e só um PIN novo gera chave nova (MOB-07, `send_pix_controller_test.dart`, `review_pix_controller_test.dart`, `pix_flow_test.dart`). | 5, 6 |

## 3. Dados e banco

| Controle | Status | Como / evidência | Sem. |
|---|---|---|---|
| Criptografia em trânsito (TLS) | 🟡 | App: tráfego em texto puro desligado no Android e bloqueado pelo ATS padrão do iOS, sem exceções (MOB-03). Publicado: HTTPS no Render e `sslmode=verify-full` no Neon. Localmente, o banco só aceita conexões da própria máquina (`127.0.0.1`). | 2, 8 |
| Criptografia em repouso | 🟡 | Disco cifrado pelo provedor (Neon), mais CPF cifrado **na aplicação** com AES-256-GCM e índice cego HMAC: colunas prontas (#32) e adaptador testado contra adulteração e chave errada (`aes-gcm-cpf-protector.test.ts`); o cadastro grava só o CPF cifrado (`register-route.test.ts`, API-06). O valor da chave Pix segue o mesmo protetor, separado por uso (dado associado e prefixo próprios, D7), e é buscado só pelo índice cego (`aes-gcm-pii-protector.test.ts`, `pg-register-customer.test.ts`). Chaves em KMS/HSM: 🔭. | 3, 5 |
| Senhas com Argon2id | ✅ | Política de senha (#33), Argon2id com os parâmetros da OWASP (`argon2id-hasher.test.ts`) e cadastro recusando senha comum (AUTH-07) e senha gigante na borda, antes do hash (AUTH-08) (`register-route.test.ts`). | 3 |
| Segredos fora do código | ✅ | Só variáveis de ambiente; configuração validada sem ecoar valores (`config.test.ts`); `.gitignore` cobre `.env`, chaves e keystores; gitleaks no CI e no `pre-commit` (#31). | 2 |
| Privilégios mínimos no banco | ✅ | Ver seção 1. Ledger e auditoria só aceitam `INSERT`. | 2–4 |
| Prepared statements / ORM seguro | ✅ | Ver SQL injection. | 2+ |
| Auditoria de operações sensíveis | ✅ | Tabela `audit.audit_events` append-only, protegida por `GRANT` **e** trigger, até contra o dono da tabela (#32, T-DB-04). Gravada na mesma transação de cada caso de uso: cadastro, login, sessões, PIN (`PIN_CREATED`, `PIN_LOCKED`), conta (`ACCOUNT_OPENED`) e Pix (`PIX_CREATED`, `PIX_COMPLETED`, `PIX_FAILED`, `PIX_CANCELLED`), com sessão e `requestId` e sem PIN, CPF ou chave completa no `metadata` (PIX-09, `authorize-route.test.ts`). | 3–5 |
| Backup e restore testados | 🔭 | O Neon oferece restauração para um ponto no tempo. Na V1 os dados são fictícios e o banco da demo é recriado toda semana (DEMO-02), então um teste de restore agrega pouco. Evolução: ensaio de restore documentado num runbook. | — |
| Retenção e exclusão de dados | 🟡 | Reset semanal da demo com retenção documentada no README (DEMO-02, semana 8); job de limpeza de refresh tokens expirados (semana 8, junto com o agendamento no deploy). Pedido de eliminação de dados pela LGPD: 🔭, com anonimização (o ledger e a auditoria são imutáveis por desenho). | 3, 8 |

## 4. AppSec no pipeline

| Controle | Status | Como / evidência | Sem. |
|---|---|---|---|
| SAST: Semgrep | ✅ | Job `SAST (Semgrep)`, obrigatório para o merge, com regra própria contra SQL montado com strings. | 2 |
| SAST: CodeQL | 🔭 | Gratuito em repositório público e sem código para manter (configuração padrão do GitHub). Fica para depois da V1 pelo congelamento de escopo; o Semgrep já cobre o SAST. | — |
| SCA: dependências vulneráveis | ✅ | Job `Dependencies (osv-scanner)` em todos os lockfiles, obrigatório para o merge; Dependabot alerts e security updates ativos. | 2 |
| Dependabot / Renovate | ✅ / 🚫 | Dependabot ativo, inclusive para as GitHub Actions fixadas por SHA. Renovate descartado: uma ferramenta basta. | 2 |
| SBOM | 🔭 | Pouco valor para uma demo sem distribuição a terceiros. Evolução: SBOM anexado a cada release. | — |
| DAST: OWASP ZAP | ⏳ | Varredura baseline contra a API publicada (threat model, seção 9). | 8 |
| Ambiente de staging | 🚫 | Decisão do roadmap: um ambiente publicado (demo) e o local. O ZAP roda contra a demo. | — |
| Secrets scanning | ✅ | gitleaks em todo o histórico no CI (obrigatório) e no `pre-commit` local (#31); secret scanning e push protection do GitHub ativos. | 2 |

## 5. Mobile (Flutter)

| Controle | Status | Como / evidência | Sem. |
|---|---|---|---|
| Secure storage para tokens | ⏳ | `flutter_secure_storage` (Keychain/Keystore) e verificação no CI contra `SharedPreferences` para tokens (MOB-01). | 3 |
| Certificate / public-key pinning | 🔭 | Risco aceito: o pinning pode quebrar o app na rotação de certificados do provedor. Evolução: pinning da chave pública (SPKI) com chave reserva. | — |
| Nada sensível em logs | 🟡 | Lints estritos proíbem `print`; o logger e o Sentry terão filtro de dados pessoais (MOB-02). | 2+ |
| Ocultar saldo | ✅ | Olho no card de saldo; o saldo começa **escondido** a cada abertura e a escolha fica só em memória (nunca em `SharedPreferences`, MOB-01). Oculto, nenhum dígito é desenhado nem lido pelo leitor de tela (MOB-05, `money_text_test.dart`, `home_screen_test.dart`). Vale também para o saldo da tela do Pix (`pix_components_test.dart`, `pix_flow_test.dart`). Os valores das movimentações ficam sempre à vista desde a semana 8 (V14, mudando a D8 da semana 6, a pedido do desenvolvedor). | 4, 6, 8 |
| Validação dos dados vindos da API | ✅ | O app confere o que recebe antes de usar: `amount` que não seja inteiro é recusado em qualquer resposta (`AmountIntegrityInterceptor`, F-18); a conta recusa saldo negativo; o Pix recusa valor ≤ 0, status ou motivo desconhecido e falha sem motivo; o extrato recusa valor ≤ 0, direção que contradiz o tipo e `transferId` fora de um Pix enviado (`http_account_repository_test.dart`, `http_pix_repository_test.dart`, `http_statement_repository_test.dart`). Regra que continua: cada repositório novo traz a própria verificação. | 2, 4, 6 |
| Proteção contra captura de tela | 🔭 | Risco aceito (baixo impacto na demo); há a opção de ocultar o saldo (MOB-05). | — |
| Ofuscação | ⏳ | Build de release ofuscado; busca por segredos no binário (MOB-04). | 8 |
| Integridade do app (Play Integrity / App Attest) | 🔭 | Risco aceito: exige contas de loja e configuração de backend. | — |
| Desbloqueio após tempo em segundo plano | ✅ | O app abre travado com sessão guardada e trava de novo depois de 5 min em segundo plano, medidos pelo relógio monotônico e pela data do aparelho, que continua correndo com ele dormindo; data que volta também trava (F-16, F-21). O PIN é conferido no servidor, no mesmo contador do Pix (PIX-05, PIX-06); travado, toda rota de cliente vai para o Desbloqueio e o PIN de uma tentativa pendente é descartado (`app_lock_test.dart`, `redirect_test.dart`, `app_test.dart`, `review_pix_controller_test.dart`). | 6 |
| Deep links seguros | ✅ | Não há deep links na V1, e o padrão do Flutter (ligado) foi desligado no Android e no iOS; o app sempre abre pela Splash e o redirect decide a tela pela sessão (MOB-06, `deep_links_test.dart`). | 3 |
| Biometria integrada corretamente | ⏳ | Só uma conveniência local que libera o PIN guardado no secure storage. O servidor nunca confia na biometria (ADR 0004). É item extra do roadmap. | 3, 6 |
| Comunicação só via TLS | ✅ | Texto puro desligado no release; no debug, liberado só para hosts locais (MOB-03, build do APK no CI valida o manifesto). | 2 |

## 6. Infraestrutura e cloud

| Controle | Status | Como / evidência | Sem. |
|---|---|---|---|
| IAM com menor privilégio | ⏳ | Contas do Render, do Neon e do GitHub com 2FA; tokens de API com escopo mínimo; o papel do banco é criado por SQL, nunca pelo painel (API-11). | 8 |
| Firewall / security groups | 🟡 | Local: Postgres só em `127.0.0.1`. Publicado: TLS `verify-full`, senha forte e papel de menor privilégio. Lista de IPs permitidos no Neon: 🔭 (depende do plano). | 2, 8 |
| WAF | 🔭 | Na V1, o rate limit da aplicação e a proteção básica do provedor bastam. Evolução: WAF na frente da API. | — |
| Gerenciador de segredos | 🟡 | Segredos do CI nos secrets do GitHub; os de produção nas variáveis de ambiente do Render (semana 8). KMS/HSM: 🔭. | 8 |
| Logs centralizados | ⏳ | Logs JSON do Pino com `requestId` (✅) enviados ao stream de logs do Render. SIEM: 🔭. | 8 |
| Monitoramento | 🟡 | Health check com teste (✅). **Sentry ainda sem semana definida:** o CLAUDE.md o torna obrigatório, mas o plano da semana 3 o trata como extra. Proposta: semana 8, junto do deploy. | 8 |
| Alertas de segurança | 🟡 | Alertas do Dependabot e de secret scanning (✅). Alerta para eventos como reuso de refresh token: 🔭. | — |
| Varredura de vulnerabilidades | 🟡 | Dependências (✅). Imagem de container: ⏳ se o deploy usar imagem própria. | 8 |
| Containers sem privilégios | ⏳ | Se houver Dockerfile próprio: usuário sem root e sistema de arquivos somente leitura. | 8 |
| CI/CD protegido | ✅ | `main` protegida por ruleset com 6 checks obrigatórios e branch atualizada; actions fixadas por SHA; `persist-credentials: false`; `GITHUB_TOKEN` só com leitura. Segredos de deploy num environment protegido na semana 8. | 2 |
| Separação de ambientes | 🟡 | Bancos e papéis separados para desenvolvimento e testes (✅); demo publicada isolada (semana 8). Sem staging (🚫, ver seção 4). | 2, 8 |

## 7. Observabilidade e auditoria

**Eventos sugeridos × eventos do projeto** (`domain-model.md`, seção 3.5):

| Evento sugerido | Evento no next bank | Status | Sem. |
|---|---|---|---|
| `LOGIN_SUCCESS` / `LOGIN_FAILED` | `LOGIN_SUCCEEDED` / `LOGIN_FAILED` | ✅ | 3 |
| `USER_CREATED` | `USER_REGISTERED` | ✅ | 3 |
| `TOKEN_REVOKED` | `SESSION_REVOKED`, `REFRESH_REUSE_DETECTED` | ✅ | 3 |
| `PASSWORD_CHANGED` | `PASSWORD_CHANGED` | ✅ | 7 |
| — | `PIN_CREATED`, `PIN_LOCKED`, `PIN_CHANGED` | ✅ | 3, 7 |
| `PAYMENT_CREATED` / `FAILED` / `COMPLETED` | `PIX_CREATED`, `PIX_FAILED`, `PIX_COMPLETED`, `PIX_CANCELLED` | ✅ | 5 |
| `MFA_ENABLED` | — | ➖ | Não há MFA no login na V1 |
| `ROLE_CHANGED` | — | ➖ | Não há papéis na V1; chega com o backoffice (Fase 3) |
| `SENSITIVE_DATA_ACCESSED` | — | 🔭 | Faz sentido quando a equipe puder ver CPF no backoffice (Fase 3) |

**Campos de cada evento:**

| Campo | Status | Como |
|---|---|---|
| Data e hora | ✅ | `occurred_at` (`timestamptz`, UTC) |
| Usuário ou serviço | ✅ | `actor_type` (`USER`, `SYSTEM`, `STAFF`) + `actor_id`; só o sistema pode não ter ID (`CHECK`) |
| ID de correlação | ✅ | `request_id`, o mesmo `x-request-id` que vem do app e aparece nos logs |
| Resultado | ✅ | Está no nome da ação (`LOGIN_SUCCEEDED` × `LOGIN_FAILED`) e no `metadata` |
| IP | 🚫 | Não guardado na V1, por minimização de dados (LGPD). O rate limit usa o IP só em memória. Evolução: guardar junto do device binding para antifraude |
| Nunca registrar segredos | ✅ | `redact` do Pino (`logging.test.ts`); `Cpf`, `Password` e `Pin` se imprimem mascarados ou como `[REDACTED]` (#33, #35); `metadata` limitado a 4 KB e a campos permitidos |

## 8. Controles específicos de banco digital

| Controle | Status | Como / evidência | Sem. |
|---|---|---|---|
| Idempotency-Key | ✅ | Ver seção 2 (ADR 0007; T-DB-06). | 5 |
| Controle de concorrência | ✅ | Ordem fixa da `database.md` §7 na autorização: idempotência, Pix `FOR UPDATE`, PIN `FOR UPDATE`, contas `FOR SHARE` por ID, contas contábeis `FOR UPDATE` por ID; `lock_timeout` e `statement_timeout` no papel da API (API-12). Provado no ledger e pelo Pix: 100 Pix alternando A→B e B→A sem deadlock, com reconciliação (T-DB-09, `pg-ledger.test.ts`, `pg-pix-concurrency.test.ts`); duas autorizações simultâneas do mesmo Pix → 200 e 409 (PIX-08). | 4, 5 |
| Prevenção de gasto duplo | ✅ | Locks + `CHECK (available_balance >= 0)`, com o saldo conferido sob lock antes de qualquer escrita. Provado no ledger e pelo Pix: dois Pix de R$ 80 sobre R$ 100 autorizados em paralelo → um concluído, um `FAILED (INSUFFICIENT_FUNDS)`, saldo final R$ 20 (T-DB-08, PIX-03, `pg-pix-concurrency.test.ts`). | 4, 5 |
| Transações ACID | ✅ | Uma transação Postgres por caso de uso (Unit of Work, ADR 0010), inclusive a auditoria e o registro de idempotência; falha de negócio grava o que mudou e só depois responde, falha técnica desfaz tudo (`register-customer.test.ts`, `authorize-pix-transfer.test.ts`). | 3+ |
| Ledger imutável | ✅ | Partidas dobradas; `journal_entries` e `postings` só com `SELECT, INSERT` para a API e triggers que recusam alteração até do dono (T-DB-03, `db-ledger-schema.test.ts`). | 4 |
| Reconciliação | 🟡 | Σ débitos = Σ créditos por lançamento (constraint diferida, T-DB-02) e reconciliação provada em teste: depois de 1.000 Pix aleatórios entre 10 contas, todo saldo materializado = Σ das partidas, o dinheiro se conserva e cada Pix concluído tem um lançamento (T-DB-14, `pg-pix-concurrency.test.ts`). O job periódico (extra) foi para o backlog. | 4, 8 |
| Limites transacionais | ✅ | R$ 5.000 (6h–20h) e R$ 1.000 (20h–6h) por Pix, no fuso de São Paulo e sempre com o relógio do servidor, conferidos na criação e de novo na autorização (PIX-10, D1, `transfer-limits.test.ts`, `authorize-pix-transfer.test.ts`: criado às 19h55 e autorizado às 20h → `LIMIT_EXCEEDED`). | 5 |
| Antifraude | 🔭 | Na V1 há rate limits, limites e PIN. Motor de regras antifraude fica para depois. | — |
| Step-up authentication | ✅ | Ver seção 1 (PIN no servidor em todo Pix). | 3, 5 |
| Auditoria de alterações | 🟡 | Ver seção 3. | 3–5 |
| Segregação de funções | ➖ | Não há equipe operando o sistema na V1. Entra com os perfis do backoffice (Fase 3). | — |
| Proteção contra replay | ✅ | Idempotência, máquina de estados do Pix e `UNIQUE` de um lançamento por Pix: a mesma autorização repetida devolve a mesma resposta com um lançamento só (PIX-02, T-DB-05, `authorize-route.test.ts`, `db-ledger-schema.test.ts`). | 5 |
| Controle de estado das transações | ✅ | Máquina de estados no domínio (`pix-transfer.test.ts`) e `CHECK`s de coerência entre status, datas, motivo de falha e ID E2E no banco (T-DB-10, `db-payments-schema.test.ts`); Pix resolvido recusado antes do PIN, expirado cancelado (PIX-08). | 5 |

## 9. Frameworks de referência

| Framework | Uso no projeto | Status |
|---|---|---|
| OWASP ASVS (nível 2) | Checklist da API (`checklist-asvs-masvs.md`); verificação requisito a requisito na semana 8 | ✅ adotado |
| OWASP MASVS v2 | Checklist do app (mesmo arquivo) | ✅ adotado |
| OWASP API Security Top 10 (2023) | Coberto pelas ameaças do threat model (tabela abaixo) | ✅ mapeado |
| CIS Controls | 🚫 Controles de gestão de TI de uma organização (inventário de ativos, contas, resposta a incidentes). Desproporcional a um projeto de uma pessoa; os itens técnicos relevantes já estão nas seções 4 e 6 | — |
| NIST CSF | 🚫 Mesmo motivo do CIS. O NIST SP 800-63B (identidade digital) é usado diretamente na política de senha | — |

**OWASP API Security Top 10 (2023) → threat model**

| Risco | Onde é tratado |
|---|---|
| API1 Broken Object Level Authorization | READ-01, PIX-01 (teste de IDOR em todo recurso) |
| API2 Broken Authentication | AUTH-01 a AUTH-09 |
| API3 Broken Object Property Level Authorization | PIX-04 (campo desconhecido → 422), READ-02 (DTOs com campos permitidos) |
| API4 Unrestricted Resource Consumption | API-02, API-12, READ-04 |
| API5 Broken Function Level Authorization | Negar por padrão; endpoints de admin numa instância separada e privada (Fase 3) |
| API6 Unrestricted Access to Sensitive Business Flows | AUTH-09, PIX-07, DEMO-03 |
| API7 Server Side Request Forgery | ➖ (seção 2) |
| API8 Security Misconfiguration | API-03, headers, CORS, configuração validada na inicialização |
| API9 Improper Inventory Management | Contrato OpenAPI único e versionado (ADR 0008), prefixo `/v1` |
| API10 Unsafe Consumption of APIs | ➖ na V1; o simulador do Bacen (Fase 2) terá revisão própria |

---

## 9.1 Mapa dos testes de segurança obrigatórios

O CLAUDE.md exige testes de autorização (IDOR), idempotência, concorrência, rate limit, reuso de refresh token e bloqueio de PIN. Cada linha liga a exigência ao teste que a prova, sempre contra o Postgres real. Conferido na semana 8 (tarefa 2), sem lacunas. Um teste novo de segurança entra aqui.

| Exigência | O que o teste prova | Arquivo (`apps/api/test/`) |
|---|---|---|
| **IDOR (todo recurso)** | Conta: nunca mostra a de outro cliente e recusa qualquer parâmetro que aponte para outra (READ-01, READ-05) | `modules/accounts/http/my-account-route.test.ts` |
| | Extrato: nunca mostra item de outro cliente | `modules/accounts/http/statement-route.test.ts` |
| | Sessões: nunca lista nem encontra a sessão de outro cliente (404) | `modules/identity/http/me-sessions-routes.test.ts` |
| | Pix: autorizar, ver o comprovante ou cancelar o Pix de outro → o mesmo 404 de um Pix inexistente (PIX-01) | `modules/payments/http/authorize-route.test.ts`, `receipt-cancel-routes.test.ts` |
| **Idempotência** | 10 requisições simultâneas com a mesma `Idempotency-Key` criam um Pix só; a mesma chave com outro pedido → `IdempotencyKeyReused` | `modules/payments/http/create-transfer-route.test.ts` |
| | Autorização repetida recebe a mesma resposta e gera um lançamento só | `modules/payments/http/authorize-route.test.ts` |
| | Logout idempotente | `modules/identity/http/session-routes.test.ts` |
| **Concorrência (saldo)** | Dois Pix de R$ 80,00 sobre R$ 100,00 autorizados ao mesmo tempo: o saldo é gasto uma vez (T-DB-08) | `modules/payments/infrastructure/pg-pix-concurrency.test.ts` |
| | 50 Pix A→B e 50 B→A ao mesmo tempo sem deadlock (T-DB-09); 1.000 Pix aleatórios e todo saldo bate com o ledger (T-DB-14) | `modules/payments/infrastructure/pg-pix-concurrency.test.ts` |
| | Duas autorizações simultâneas do mesmo Pix: uma passa, a outra recebe 409 | `modules/payments/http/authorize-route.test.ts` |
| **Rate limit** | Login: 6ª tentativa errada numa conta em 1 min, de qualquer IP, e 11ª de um IP → 429 (AUTH-01); rajada simultânea de muitos IPs respeita o limite (F-11) | `modules/identity/http/login-route.test.ts` |
| | Cadastro: 3 por IP por hora (AUTH-09) | `application/onboarding/register-route.test.ts` |
| | Consulta de chave Pix: 30 por hora por cliente (PIX-07) | `modules/payments/http/key-lookup-route.test.ts` |
| | Senha errada na troca de PIN e de senha conta no limite do login | `modules/identity/http/pin-change-route.test.ts`, `password-change-route.test.ts` |
| **Reuso de refresh token** | Um token já trocado que volta depois de 10 s revoga a sessão inteira (AUTH-03); dois refresh simultâneos deixam um token ativo só | `modules/identity/http/session-routes.test.ts` |
| **Bloqueio de PIN** | Bloqueia no 5º PIN errado, contado junto no Desbloqueio e no Pix, e recusa até o certo (PIX-05); 10 palpites paralelos contam uma vez cada | `modules/identity/http/pin-verify-route.test.ts`, `modules/payments/http/authorize-route.test.ts` |
| **Sessão encerrada (AUTH-04)** | Access token ainda válido de uma sessão encerrada é recusado nas operações sensíveis | `authorize-route.test.ts`, `pin-verify-route.test.ts`, `receipt-cancel-routes.test.ts`, `me-sessions-routes.test.ts` |
| **Contas de demonstração (DEMO-03)** | Não trocam senha nem PIN, nem encerram sessões (403), sem gastar tentativas | `modules/identity/http/demo-accounts-route.test.ts` |

## 10. Registro de achados

Achados das revisões de segurança e da construção, no formato de relatório de auditoria. Achado novo entra aqui com severidade e status.

| # | Área | Severidade | Achado | Status |
|---|---|---|---|---|
| F-01 | Autenticação | 🟠 Alta | O PIN não implementava o **3º bloqueio em 24 h → PIN bloqueado até redefinir com a senha** (D7, PIX-05). A primeira versão do #35 só tinha o bloqueio de 30 min | Corrigido antes do merge (#35), com janela deslizante, erro `PinResetRequired` e `CHECK`s no banco |
| F-02 | Banco | 🟡 Média | `CHECK` de revogação da sessão aceitava sessão revogada sem motivo (um `CHECK` que dá `NULL` passa) | Corrigido antes do merge (#32), com teste |
| F-03 | CI/CD | 🟡 Média | Checks `Contracts`, `osv-scanner` e `Semgrep` rodavam, mas não eram obrigatórios para o merge | Corrigido (ruleset atualizado, 2026-10-06) |
| F-04 | Segredos | 🟢 Baixa | gitleaks só rodava depois do push, num repositório público | Corrigido (#31, hook `pre-commit`) |
| F-05 | API | 🟡 Média | Rate limit global previsto na semana 2 (API-02) não foi implementado | Corrigido: 100 requisições/min por IP, resposta 429 `TooManyAttempts` no formato RFC 9457 (`http-problems.test.ts`). Limites por rota (login, cadastro, PIN) entram com cada rota |
| F-06 | API | 🟢 Baixa | Respostas sem `Cache-Control: no-store` | Corrigido: `no-store` em toda resposta, inclusive erros e 404 |
| F-07 | Observabilidade | 🟢 Baixa | Sentry obrigatório pelo CLAUDE.md, mas sem semana no plano | Aberto (proposta: semana 8) |
| F-08 | Criptografia | 🟠 Alta | Decifragem AES-GCM do CPF sem tamanho de tag fixado: o Node aceitaria tag truncada (ex.: 4 bytes), facilitando forjar valores. Apontado pelo Semgrep no CI (`gcm-no-tag-length`) | Corrigido antes do merge (#37): `authTagLength: 16` e recusa de valor curto, com teste do ataque |
| F-09 | Infra | 🟠 Alta | Atrás do proxy do Render, sem `trustProxy` configurado, todos os clientes compartilhariam o mesmo IP: o rate limit bloquearia todo mundo junto, ou ninguém | Aberto (semana 8, no deploy): configurar `trustProxy` só para o proxy do provedor, com teste |
| F-10 | Processo | 🟢 Baixa | O desenho aprovado do login não listou a mudança na lista de schemas aprovados do contrato (`LoginRequestInput`), que o teste de contrato (READ-02) exige; o teste apontou na primeira execução | Corrigido no PR do login. Falha de desenho: a seção "Contratos" de todo desenho passa a listar os schemas OpenAPI novos pelo nome |
| F-11 | Autenticação | 🟡 Média | O login conferia o bloqueio da conta e só contava a falha depois da verificação da senha (assíncrona): uma rajada simultânea de tentativas, de IPs diferentes, passava inteira pela checagem. Reproduzido: 10 tentativas paralelas, 10 verificações e nenhum 429. Apontado pelo `/security-review` | Corrigido antes do merge (PR do login): a tentativa é contada antes de qualquer `await` e zerada no sucesso; testes do ataque no caso de uso e na rota. Falha de desenho: o desenho de todo controle passa a responder "o que acontece com requisições simultâneas?" |
| F-12 | Autenticação | 🟡 Média | Uma conta `LOCKED` continua renovando a sessão pelo refresh e passando pelas operações sensíveis: só o login confere o status. Apontado no `/security-review` do refresh | Aberto, condicionado: hoje não existe como bloquear uma conta pela aplicação. Quando o bloqueio pela equipe existir (Fase 3), bloquear deve revogar todas as sessões, com teste |
| F-13 | Dados pessoais | 🟢 Baixa | E-mail e nome, classificados como dados pessoais que nunca vão para logs (`database.md`, seção 2), não estavam na redação automática; nenhum log atual os incluía, mas um log futuro vazaria. Apontado na revisão consolidada do Identity | Corrigido no fechamento da semana 3: `email` e `name` redigidos, com teste; os logs de erro mantêm a classe em `err.type` |
| F-14 | Processo | 🟢 Baixa | O desenho do `design_system` foi conferido contra as tabelas do brief, mas não contra as imagens dos mockups: o botão principal saiu sem o halo Menta e o rótulo do campo saiu menor que o do mockup. Apontado na conferência visual pedida pelo desenvolvedor, antes do PR | Corrigido antes do PR da 6a, com teste para cada ponto. Falha de desenho: a seção "Fontes conferidas" de todo desenho visual passa a listar os mockups e o que cada componente reproduz deles |
| F-15 | Acessibilidade | 🟢 Baixa | O `accent` do modo claro (mintDeep `#007A6A`) ficava abaixo do AA como texto sobre `surface2` (4,47:1) e sob o brilho do topo da tela (4,46:1). O brief só tinha conferido o contraste sobre o branco, e o teste da 6a cobria só `background` e `surface`. Apontado pelo teste de contraste ampliado na 6b-1, antes de qualquer tela usar a cor | Corrigido antes do PR: o `accent` claro passa a ser o mintInk `#006B5D`, que já existia no brief, com AA em todos os fundos claros. O teste de contraste cobre todo fundo onde há texto. Falha de desenho: a regra "AA em todo texto" (brief §8) passa a ser provada sobre cada fundo do tema, não só sobre o principal |
| F-16 | Processo | 🟠 Alta | O plano da semana 3 não incluiu a tela 5 (Desbloqueio), prevista no roadmap (seção 7.1), no MASVS ("desbloqueio após tempo em segundo plano", semana 3) e na mitigação do PIX-06. Sem ela, quem pega o aparelho com a sessão aberta entra no app sem PIN. Apontado na conferência das fontes do plano da semana 4, antes de existir Pix | Corrigido na semana 6: rota de verificação do PIN (`POST /v1/me/pin/verify`, #70, mesmo contador de tentativas do Pix, PIX-05) e tela de Desbloqueio com a trava do app (#82), antes do "Pix de ponta a ponta". Falha de desenho: o plano de cada semana passa a conferir a tabela de telas do roadmap |
| F-17 | Acessibilidade | 🟡 Média | Seis componentes do `design_system` (`PrimaryButton`, `DisplayTitle`, `FormErrorText`, desde a semana 3, e `MoneyText`, `IconCircleButton`, `NextLogo`) usavam `Semantics` sem `container: true`. Numa lista, as propriedades se fundiam com o item inteiro: o leitor de tela anunciava "Entrar" junto com o texto vizinho, o card de saldo inteiro como um botão, um bloco inteiro como título e o bloco inteiro quando um erro aparecia. Os testes renderizavam cada componente sozinho, onde o problema não aparece. Apontado na construção da Home, quando o valor do saldo sumiu da árvore de semântica | Corrigido antes do PR da Home, com um teste que reproduz cada caso dentro de uma lista. Falha de desenho: a regra "AA e leitor de tela" (brief §8) passa a ser provada com o componente dentro de uma lista, como as telas o usam, e todo `Semantics` de componente declara `container: true` |
| F-18 | Correção financeira | 🟡 Média | O cliente Dart gerado do OpenAPI lê todo `amount` com `(v as num).toInt()`: uma resposta com `10.5` viraria 10 centavos em silêncio, contra a regra de nunca arredondar dinheiro sem avisar (ADR 0006). A API nunca envia fração, mas o app confere o que recebe (MASVS, código). Apontado na conferência do cliente gerado durante a Home, antes de qualquer tela mostrar dinheiro | Corrigido antes do PR da Home, com teste que reproduz o truncamento: o `AmountIntegrityInterceptor` recusa, antes de o cliente ler a resposta, qualquer `amount` que não seja inteiro, em qualquer profundidade, e a falha vira `ApiUnexpected`; o repositório da conta também recusa saldo negativo (moeda desconhecida o próprio cliente gerado já recusa). Todo `Money` do contrato usa o campo `amount`, então a mesma verificação protege o Pix. Falha de desenho: o desenho de toda fatia que consome o cliente gerado passa a conferir como ele desserializa dinheiro |
| F-19 | Processo | 🟢 Baixa | Os degradês do card de saldo e do brilho da tela saíram diferentes do mockup: o resumo do brief (§2.3) tinha virado a fonte, no lugar do CSS do mockup, e a geometria (elipses, ângulos, paradas) foi aproximada. No aparelho, o Impeller, que não faz *dithering*, ainda desenhava faixas visíveis nos degradês suaves sobre fundo escuro. Apontado na conferência visual do desenvolvedor no emulador e no celular | Corrigido antes do PR da Home: os gradientes usam a geometria exata do CSS (`cssRadialGradient`, `cssLinearGradient`, com teste), e um granulado em *overlay* (`Dither`) esconde as faixas sem mudar a cor média, medida igual à do mockup. Falha de desenho: o brief passa a registrar os valores exatos do mockup (§2.3), e a conferência visual de todo componente com degradê é feita no aparelho, não só no teste |
| F-20 | Validação de entrada | 🟢 Baixa | O cursor do extrato conferia só o formato do horário (`AAAA-MM-DDTHH:MM:SS.ffffffZ`). Uma data impossível nesse formato (mês 13) chegava ao Postgres e respondia 500. Não vazava nada, porque o erro é genérico, mas o READ-03 manda recusar cursor malformado com 422. Apontado pelo `/security-review` do extrato | Corrigido antes do PR do extrato, com teste que reproduz o caso: o horário precisa ser um instante real, que volta ao mesmo texto. Falha de desenho: a validação de todo valor que vira parâmetro de SQL confere o significado (uma data existe, um número cabe no tipo), não só a forma |
| F-21 | Autenticação no app | 🟡 Média | O Desbloqueio media o tempo em segundo plano só com o relógio monotônico (`Stopwatch`), escolhido para que mudar a hora do aparelho não encurtasse a espera. Esse relógio para enquanto o aparelho dorme (tela desligada, Doze no Android, sono no iOS): horas em segundo plano com a tela apagada podiam voltar destravadas e mostrar saldo e extrato sem o PIN (PIX-06). O Pix continuava exigindo o PIN no servidor. Apontado pelo `/security-review` do Desbloqueio | Corrigido antes do PR do Desbloqueio, com teste que reproduz o caso: a trava lê também a data do aparelho, que corre durante o sono; qualquer um dos dois relógios passando de 5 minutos trava, e uma data que andou para trás também trava. Falha de desenho: todo controle baseado em tempo no aparelho declara o que acontece com o sono e com a troca de hora, cada um com o seu teste |
| F-22 | Correção financeira | 🟠 Alta | A verificação de dinheiro do app (`AmountIntegrityInterceptor`, F-18) recusava todo campo `amount` que não fosse inteiro. Só que o Pix e o item do extrato trazem o `Money` inteiro sob esse nome, então toda resposta de Pix e de extrato era recusada como inesperada: no aparelho, a Home dizia que não conseguia carregar as movimentações, e o Pix também não sairia. Os testes não pegaram porque os testes dos repositórios montavam o cliente sem os interceptors do app. Apontado no teste do desenvolvedor no celular, contra a API real, no fechamento da semana 6 | Corrigido antes da tag (PR `fix/amount-integrity-money`), com o teste que reproduz antes da correção: um `amount` vale como centavos inteiros ou como um `Money` cujo `amount` é conferido. Falha de desenho: os testes de repositório passam a usar os interceptors que o `main.dart` liga, e o checkpoint no aparelho continua obrigatório antes de fechar a semana |
| F-23 | Correção financeira | 🟢 Baixa | Depois de um Pix, a Home mostrava a movimentação, mas ainda o saldo de antes: a tela do Pix e o comprovante também liam o saldo, que ficou em memória durante o fluxo e foi reaproveitado. O servidor estava certo e nada foi gravado errado, mas o app mostrava um saldo que não era o do servidor (o saldo é sempre o do servidor, roadmap 6.7). Apontado no teste do desenvolvedor no celular, no fechamento da semana 6 | Corrigido antes da tag, com o teste que reproduz antes da correção: a resposta da autorização descarta o Pix, o saldo e o extrato lidos antes. Falha de desenho: todo comando que move dinheiro descarta, na resposta, as leituras de saldo e de extrato |
| F-24 | Autenticação | 🟡 Média | Um login com a senha antiga, ainda na verificação do Argon2id quando a senha era trocada, abria a sessão depois de a troca encerrar as outras: a sessão sobrevivia, contra o AUTH-06 ("troca de senha revoga todas"). O login lia o hash sem trava e abria a sessão em outra transação. Apontado pelo `/security-review` da troca de senha | Corrigido antes do PR, com o teste que reproduz antes da correção: ao abrir a sessão, o login relê o hash com `FOR SHARE` e recusa se ele mudou, e a troca grava o hash antes de travar as sessões, então as duas operações se ordenam. Falha de desenho: o desenho da troca listou a concorrência com o refresh, mas não com o login em curso; toda operação que invalida credenciais passa a listar também os logins em andamento |
| F-25 | Dados pessoais | 🟢 Baixa | A redação dos logs cobria `password` e `pin`, mas não `currentPassword`, `newPassword` e `newPin`, os campos das trocas novas. Não vazava, porque o corpo das requisições não é logado, mas a regra do CLAUDE.md manda redigir senhas e PIN. Apontado pelo `/security-review` | Corrigido antes do PR, com teste. Falha de desenho: a seção "Contratos" de todo desenho passa a conferir se cada campo novo com segredo está na redação |
| F-26 | Autenticação | 🟢 Baixa | O catálogo de erros manda o `PinNotCreated` levar à tela "Criar PIN" no Desbloqueio e na revisão do Pix, mas o app só mostrava a mensagem. A conta ficava presa, sem caminho para criar o PIN, até reabrir o app. Encontrado pela varredura de estados da semana 7 (D8) | Corrigido com teste antes: o app relê o perfil e o roteador leva à criação do PIN. Falha de desenho: cada erro do catálogo com ação no app (não só mensagem) passa a ter um teste de fluxo |
| F-27 | Processo | 🟡 Média | O threat model marcava o DEMO-03 (contas de demonstração não trocam senha nem PIN) para a semana 7, mas o plano da semana 7 não o listou em "Fontes conferidas" e nada foi implementado. Sem a regra, um visitante poderia trocar a senha de Ana e tirar a demo do ar para todos. Encontrado ao planejar a semana 8, antes da publicação | Entra na semana 8 como exceção de segurança, com o ataque testado antes da defesa. Falha de desenho: o desenho de cada semana passa a filtrar o threat model pela coluna "Sem." e listar toda linha daquela semana |
| F-28 | Banco | 🟡 Média | No primeiro bootstrap no Neon, o `REVOKE ALL ON DATABASE nextbank FROM PUBLIC` e o `GRANT CONNECT` rodaram como o dono do projeto, que não é superusuário nem dono do banco (já do `nextbank_migrator`): o Postgres só avisou e não mudou nada, e o `PUBLIC` continuou podendo conectar e criar tabelas temporárias. No ambiente local o script roda como superusuário, por isso nunca apareceu. Encontrado na verificação feita logo depois do bootstrap, antes de qualquer dado | O bootstrap passa as permissões do banco como o próprio dono (`SET ROLE nextbank_migrator`) e termina com uma checagem que falha se elas não valeram; testado num Postgres 17 com um dono sem superusuário, que reproduz o Neon. Falha de desenho: todo script de infraestrutura passa a ser testado com os mesmos privilégios do ambiente de destino |
| F-30 | Processo | 🟢 Baixa | O desenho da medição de performance (semana 8, tarefa 5) previa 20 Pix por execução como Ana, mas consultar a chave e criar o Pix gastam a cota de 30 consultas por hora do pagador (PIX-07): a primeira execução recebeu 429. Falha de desenho: a lista de fontes conferidas considerou só o limite global por IP (API-02), não as cotas por cliente | Corrigido: 12 Pix por execução, com Bruno como pagador, para não gastar a cota de Ana, que é a conta dos visitantes. Processo: o desenho de um script que chama a API publicada confere todas as cotas das rotas que ele usa, não só o limite global |
| F-31 | Mobile | 🟢 Baixa | No checkpoint da semana 8, atrás de um proxy de interceptação com certificado de usuário, o APK de release recusou a conexão, como o MOB-03 exige, mas mostrou "Algo deu errado" em vez de "Sem conexão", como o desenho da tarefa 4 previa: a falha de handshake do `dart:io` chega ao Dio como erro desconhecido. Sem impacto de segurança: nada trafegou | Corrigido: certificado recusado e falha de TLS viram `ApiUnreachable` ("Sem conexão"), com o teste que reproduz o handshake recusado (`api_failure_test.dart`). Processo: um comportamento previsto no desenho ganha teste já na fatia, não só no checkpoint |

## 11. Como manter este documento

- Todo PR que implementa um controle muda o status aqui e aponta a evidência (arquivo de teste ou PR).
- Todo `/security-review` com achado acrescenta uma linha na seção 10.
- Na semana 8, este documento e o `checklist-asvs-masvs.md` são conferidos item a item antes da tag `v1.0.0`.
