# next bank — Matriz de controles de segurança (V1)

- **Atualizado em:** 2026-10-06 (semana 3, em andamento)
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
| Segundo fator nas operações (step-up) | 🟡 | PIN de transação verificado **no servidor** em todo Pix (ADR 0004). Criação do PIN pronta (`POST /v1/me/pin`): uma vez só, hash Argon2id com pepper do servidor (API-13). Operações sensíveis conferem no banco se a sessão segue ativa (AUTH-04, `pin-route.test.ts`). A verificação no Pix vem na semana 5. | 3, 5 |
| RBAC / ABAC | ⏳ | V1 tem um único papel (cliente): a autorização é por **dono do recurso** (conta derivada do token, recurso alheio → 404). RBAC com perfis de equipe chega com o backoffice (Fase 3). | 4–6 |
| Princípio do menor privilégio | ✅ | Banco: papel `nextbank_app` sem atributos especiais, sem DDL, só os `GRANT`s necessários (`db-roles.test.ts`, `db-*-schema.test.ts`, API-11, T-DB-13). CI: `GITHUB_TOKEN` só com leitura. | 2–3 |
| Força bruta e credential stuffing | ✅ | PIN: 5 erros → 30 min, e o 3º bloqueio em 24 h exige redefinir com a senha (#35, `CHECK` no banco). Login: 5 erros por conta em 1 min bloqueiam a conta por 1, 2, 4, 8 e até 15 min, de qualquer IP, contando também e-mails inexistentes; 10 tentativas por IP por minuto contra credential stuffing (`login-attempts.test.ts`, `login-route.test.ts`, AUTH-01). Mesmo corpo 401 e uma verificação Argon2id em todo caminho, com hash fictício para e-mail inexistente (AUTH-02). | 3 |
| Session fixation | ✅ | Impossível por desenho: a sessão e os tokens são sempre criados pelo servidor no login, nunca aceitos do cliente; cada login abre uma sessão nova (`login.test.ts`, `login-route.test.ts`). | 3 |
| Session hijacking | 🟡 | Access token de 15 min, reuso de refresh detectado (#34), tokens só no Keychain/Keystore (MOB-01, semana 3), só HTTPS (MOB-03). Vínculo do aparelho (device binding): 🔭. | 3 |
| Logout e invalidação de sessão | 🟡 | `POST /v1/auth/logout` (autenticado): revoga a sessão, idempotente, e o refresh token deixa de valer na hora (✅, AUTH-06). O access token expira em até 15 min (risco aceito, ADR 0004). Troca de senha revogando todas as sessões: semana 7. | 3, 7 |
| Autenticação por padrão | ✅ | Toda rota exige `Authorization: Bearer` válido, salvo as declaradas públicas (`/health`, cadastro, login, refresh); esquecer a marcação fecha a rota. 401 `Unauthenticated` com `WWW-Authenticate: Bearer` (`session-routes.test.ts`). | 3 |

## 2. Segurança da API

| Controle | Status | Como / evidência | Sem. |
|---|---|---|---|
| Validação rigorosa de entrada | 🟡 | Zod em toda rota (type provider), corpo máximo de 16 KB (`http-security.test.ts`), `x-request-id` validado. Schemas estritos (campo desconhecido → 422) em cada rota: cadastro ✅ (`register-route.test.ts`, inclusive nome com espaços nas pontas ou caracteres de controle). | 2+ |
| Rate limiting / throttling | 🟡 | Global: 100 requisições/min por IP, 429 no formato do catálogo (✅, F-05). Cadastro: 3 tentativas por IP por hora, falhas incluídas (✅, AUTH-09). Login: 10 por IP por minuto e bloqueio progressivo por conta (✅, AUTH-01). PIN, consulta de chave Pix e comandos financeiros entram com as rotas (PIX-07). Em memória na V1 (D3). | 3, 5 |
| CORS | ✅ | Negado por padrão: a API não registra plugin de CORS, então o navegador bloqueia chamadas de outras origens (o app mobile não precisa de CORS). Falta um teste explícito, que entra na semana 3. | 2 |
| CSRF | ➖ | A autenticação usa `Authorization: Bearer`, e não cookies, então o navegador não envia credenciais automaticamente. Reavaliar no backoffice (Fase 3) se ele usar cookies. | — |
| SQL injection | ✅ | Só queries parametrizadas com `pg` (ADR 0009), sem ORM e sem SQL montado com strings; regra própria do Semgrep no CI (API-01). | 2+ |
| XSS | ➖ | A API só responde JSON (`Content-Type` explícito, com CSP do helmet), e o app Flutter não renderiza HTML. Reavaliar no backoffice web (Fase 3). | — |
| SSRF | ➖ | A API não faz requisições para URLs vindas do cliente. Regra: se isso surgir, só com lista de destinos permitidos. | — |
| IDOR / BOLA | ⏳ | Conta sempre derivada do token; **todo recurso tem teste de IDOR** (CLAUDE.md, READ-01, PIX-01). | 4–6 |
| Command injection | ➖ | A API não executa comandos do sistema. O único uso (`execFileSync` no setup dos testes) tem argumentos fixos e não usa shell. | — |
| Path traversal | ➖ | Nenhuma leitura ou escrita de arquivo a partir de entrada do cliente. | — |
| Headers de segurança | 🟡 | helmet (HSTS, CSP, `nosniff`…). `http-security.test.ts` verifica HSTS, `nosniff` e a ausência de `x-powered-by`. `Cache-Control: no-store` em toda resposta (✅, F-06). | 2, 3 |
| Versionamento de API | ⏳ | Prefixo `/v1` a partir das rotas de autenticação. | 3 |
| Contratos e schemas | ✅ | OpenAPI gerado dos schemas Zod, cliente Dart gerado e gate de divergência no CI (ADR 0008, job `Contracts`). | 2 |
| Idempotência em operações financeiras | ⏳ | `Idempotency-Key` com escopo (usuário, chave), validade de 24 h, hash do payload e resposta guardada (ADR 0007, PIX-02, T-DB-06). | 5 |

## 3. Dados e banco

| Controle | Status | Como / evidência | Sem. |
|---|---|---|---|
| Criptografia em trânsito (TLS) | 🟡 | App: tráfego em texto puro desligado no Android e bloqueado pelo ATS padrão do iOS, sem exceções (MOB-03). Publicado: HTTPS no Render e `sslmode=verify-full` no Neon. Localmente, o banco só aceita conexões da própria máquina (`127.0.0.1`). | 2, 8 |
| Criptografia em repouso | 🟡 | Disco cifrado pelo provedor (Neon), mais CPF cifrado **na aplicação** com AES-256-GCM e índice cego HMAC: colunas prontas (#32) e adaptador testado contra adulteração e chave errada (`aes-gcm-cpf-protector.test.ts`); o cadastro grava só o CPF cifrado (`register-route.test.ts`, API-06). Chaves em KMS/HSM: 🔭. | 3 |
| Senhas com Argon2id | ✅ | Política de senha (#33), Argon2id com os parâmetros da OWASP (`argon2id-hasher.test.ts`) e cadastro recusando senha comum (AUTH-07) e senha gigante na borda, antes do hash (AUTH-08) (`register-route.test.ts`). | 3 |
| Segredos fora do código | ✅ | Só variáveis de ambiente; configuração validada sem ecoar valores (`config.test.ts`); `.gitignore` cobre `.env`, chaves e keystores; gitleaks no CI e no `pre-commit` (#31). | 2 |
| Privilégios mínimos no banco | ✅ | Ver seção 1. Ledger e auditoria só aceitam `INSERT`. | 2–4 |
| Prepared statements / ORM seguro | ✅ | Ver SQL injection. | 2+ |
| Auditoria de operações sensíveis | 🟡 | Tabela `audit.audit_events` append-only, protegida por `GRANT` **e** trigger, até contra o dono da tabela (#32, T-DB-04). Os eventos passam a ser gravados com cada caso de uso. | 3–5 |
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
| Proteção contra captura de tela | 🔭 | Risco aceito (baixo impacto na demo); há a opção de ocultar o saldo (MOB-05). | — |
| Ofuscação | ⏳ | Build de release ofuscado; busca por segredos no binário (MOB-04). | 8 |
| Integridade do app (Play Integrity / App Attest) | 🔭 | Risco aceito: exige contas de loja e configuração de backend. | — |
| Deep links seguros | ➖ | Não há deep links na V1. | — |
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
| `LOGIN_SUCCESS` / `LOGIN_FAILED` | `LOGIN_SUCCEEDED` / `LOGIN_FAILED` | ⏳ | 3 |
| `USER_CREATED` | `USER_REGISTERED` | ⏳ | 3 |
| `TOKEN_REVOKED` | `SESSION_REVOKED`, `REFRESH_REUSE_DETECTED` | ⏳ | 3 |
| `PASSWORD_CHANGED` | `PASSWORD_CHANGED` | ⏳ | 7 |
| — | `PIN_CREATED`, `PIN_LOCKED`, `PIN_CHANGED` | ⏳ | 3, 7 |
| `PAYMENT_CREATED` / `FAILED` / `COMPLETED` | `PIX_CREATED`, `PIX_FAILED`, `PIX_COMPLETED`, `PIX_CANCELLED` | ⏳ | 5 |
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
| Idempotency-Key | ⏳ | ADR 0007; T-DB-06. | 5 |
| Controle de concorrência | ⏳ | `SELECT … FOR UPDATE` em ordem fixa por ID; `lock_timeout` e `statement_timeout` no papel da API (✅, API-12). | 5 |
| Prevenção de gasto duplo | ⏳ | Locks + `CHECK (available_balance >= 0)`; teste de 2 Pix de R$ 80 sobre R$ 100 (T-DB-08). | 5 |
| Transações ACID | ⏳ | Uma transação Postgres por caso de uso (Unit of Work), inclusive a auditoria. | 3+ |
| Ledger imutável | ⏳ | Partidas dobradas; mesmo padrão de `GRANT` + trigger já provado na auditoria (T-DB-03). | 4 |
| Reconciliação | ⏳ | Σ débitos = Σ créditos por lançamento (constraint diferida, T-DB-02) e reconciliação de saldos (T-DB-14). O job periódico é extra. | 4, 8 |
| Limites transacionais | ⏳ | Limite noturno com o horário do servidor (PIX-10). É item extra da semana 5. | 5 |
| Antifraude | 🔭 | Na V1 há rate limits, limites e PIN. Motor de regras antifraude fica para depois. | — |
| Step-up authentication | 🟡 | Ver seção 1 (PIN em todo Pix). | 3, 5 |
| Auditoria de alterações | 🟡 | Ver seção 3. | 3–5 |
| Segregação de funções | ➖ | Não há equipe operando o sistema na V1. Entra com os perfis do backoffice (Fase 3). | — |
| Proteção contra replay | ⏳ | Idempotência, máquina de estados do Pix e `UNIQUE` de um lançamento por Pix (PIX-02, T-DB-05). | 5 |
| Controle de estado das transações | ⏳ | Máquina de estados no domínio e `CHECK`s de coerência entre status e datas (PIX-08, T-DB-10). | 5 |

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

## 11. Como manter este documento

- Todo PR que implementa um controle muda o status aqui e aponta a evidência (arquivo de teste ou PR).
- Todo `/security-review` com achado acrescenta uma linha na seção 10.
- Na semana 8, este documento e o `checklist-asvs-masvs.md` são conferidos item a item antes da tag `v1.0.0`.
