# Plano — Semana 3: Identity

- **Roadmap:** `docs/roadmap.md` (seção 8, semana 3)
- **Base:** ADR 0004 (autenticação), `domain-model.md` (3.1, 8 e 9), `database.md` (5.1 e 6), threat model (AUTH-01 a 09, API-06, MOB-01, DEMO-01)
- **Carga:** ~30h (5 dias × 6h)
- **Objetivo:** cliente se cadastra, entra, mantém a sessão com refresh seguro e cria o PIN de transação, com cada ameaça de autenticação coberta por um teste escrito antes da defesa.
- **Pronto quando:** testes de domínio e de API verdes; itens de autenticação do threat model mitigados; `/security-review` sem achados abertos; app faz cadastro, login e restaura a sessão.

## Como trabalhamos nesta semana

- **Primeiro módulo hexagonal da API.** O Identity define o molde que os próximos módulos copiam: `domain/`, `application/`, `infrastructure/`, `http/`.
- **Backend antes do app.** Se a semana estourar, o que sobra é tela, nunca segurança.
- **Ataque antes da defesa:** o teste de reuso de refresh, de força bruta ou de enumeração vem antes do código que o impede (CLAUDE.md, seção 5).
- **Simplicidade:** cada peça entra com o código que a usa; nada de antecipar Accounts, Ledger ou Pix.

## Decisões a confirmar (com padrão recomendado)

Manutenção ativa, licença e tamanho de cada biblioteca são conferidos na Tarefa 1, antes da instalação (CLAUDE.md: dependência nova exige justificativa).

| # | Decisão | Padrão recomendado |
|---|---|---|
| D1 | Biblioteca de Argon2id | `@node-rs/argon2`: binários prontos, sem compilação nativa no Windows e no CI; parâmetros OWASP (19 MiB, 2 iterações) |
| D2 | JWT | `jose`; chave Ed25519 em variável de ambiente (PEM), com `kid`; script local para gerar o par |
| D3 | Armazenamento do rate limit | Em memória (uma instância na V1). Risco aceito e registrado: com mais de uma instância, migrar para Postgres ou Redis |
| D4 | Lista de senhas comuns | 10 mil senhas mais comuns da SecLists (licença MIT), versionada como arquivo |
| D5 | Identificadores | UUIDv7 gerado na aplicação, porta `IdGenerator` (biblioteca `uuid`) |
| D6 | Criptografia do CPF (API-06) | AES-256-GCM com chave atrás da porta `KeyProvider` (variável de ambiente), mais índice cego HMAC para a unicidade |
| D7 | Navegação no app | GoRouter entra agora: login é a segunda tela e o redirect de sessão é o motivo de existir |

## Fora desta semana

- Conta, saldo inicial e chave Pix no cadastro: entram no mesmo caso de uso `RegisterCustomer` nas semanas 4 e 5.
- Verificação do PIN dentro do Pix: o caso de uso `VerifyPin` fica pronto e testado; quem o chama é a autorização do Pix (semana 5).
- Troca de senha e de PIN, lista de sessões ativas: semana 7 (tela Segurança).
- Biometria (extra), Sentry (extra).

---

## Tarefa 1 — Fundação do módulo (dia 1)

- [ ] Estrutura `src/modules/identity/{domain,application,infrastructure,http}` e núcleo compartilhado mínimo: `Clock`, `IdGenerator`, transação (unidade de trabalho)
- [ ] **dependency-cruiser no CI:** domínio sem framework; módulos só se falam pela API pública (`index.ts`)
- [ ] **Gate de cobertura de 90%** em `domain/` e `application/` (Vitest)
- [ ] Primeiras migrations reais: schema `identity` (`users`, `sessions`, `refresh_tokens`, `transaction_pins`) e `audit.audit_events`, com `GRANT`s, `CHECK`s e triggers de imutabilidade da auditoria; `REVOKE EXECUTE … FROM PUBLIC` nas funções
- [ ] Mapeamento de erro de domínio → resposta RFC 9457 com `code` do catálogo (`domain-model.md`, seção 9)
- [ ] `EXPLAIN ANALYZE` de cada query nova, com o índice que a sustenta

## Tarefa 2 — Domínio Identity, TDD estrito (dia 1–2)

Cada invariante e cada erro do catálogo vira teste, com `Clock` controlável:

- [ ] `Cpf` (dígitos verificadores → `InvalidCpf`), `Email` (normalizado), política de senha (10 a 128 caracteres, lista comum → `WeakPassword`)
- [ ] `Session`: rotação a cada refresh; reuso fora de 10 s revoga a família (`RefreshTokenReuseDetected`); reapresentação dentro de 10 s devolve o mesmo par; expiração por inatividade (7 dias) e absoluta (30 dias) → `SessionExpired`
- [ ] `TransactionPin`: 4 dígitos sem sequências triviais; 5 erros bloqueiam por 30 min (`PinLocked`); acerto zera as tentativas

## Tarefa 3 — Casos de uso e API, outside-in (dia 2–3)

O teste HTTP (Postgres real) vem antes da rota. Testes de segurança antes das defesas:

| Ameaça | Teste escrito antes |
|---|---|
| AUTH-01 | 6ª tentativa de login em 1 min → 429; contador por conta independe do IP |
| AUTH-02 | Mesma mensagem e tempo equivalente para e-mail inexistente e senha errada (hash fictício) |
| AUTH-03 | Refresh antigo reapresentado após 10 s → 401 e sessão inteira revogada |
| AUTH-04 | Token de sessão revogada recusado onde a sessão é verificada no banco |
| AUTH-05 | Tokens com `alg: none`, HS256, chave errada, `iss`/`aud` errados ou expirados → 401 |
| AUTH-06 | Refresh após logout → 401 |
| AUTH-07 | Senha da lista comum → 422 |
| AUTH-08 | Parâmetros do Argon2id conferidos; senha de 129 caracteres → 422 |
| AUTH-09 | 4º cadastro do mesmo IP em 1 h → 429 |
| API-06 | Coluna do CPF não contém o CPF em claro |

- [ ] Rotas: `POST /v1/auth/register`, `POST /v1/auth/login`, `POST /v1/auth/refresh`, `POST /v1/auth/logout`, `POST /v1/me/pin`
- [ ] Autenticação negando por padrão: toda rota exige token, exceto as públicas declaradas explicitamente
- [ ] Auditoria: `USER_REGISTERED`, `LOGIN_FAILED`, `SESSION_REVOKED`, `REFRESH_TOKEN_REUSE_DETECTED`, na mesma transação da operação
- [ ] Contrato atualizado: esquema de segurança Bearer no OpenAPI; cliente Dart regenerado

## Tarefa 4 — App (dia 4–5)

- [ ] GoRouter com redirect: sem sessão → login; sessão válida → Home
- [ ] Tokens só no Keychain/Keystore (`flutter_secure_storage`, MOB-01); verificação no CI contra `SharedPreferences` para tokens
- [ ] Interceptor de refresh com **fila única** (TDD): várias requisições com 401 ao mesmo tempo disparam um só refresh; reuso detectado → volta ao login
- [ ] `x-request-id` gerado no app e enviado em toda requisição
- [ ] Telas: cadastro (com **CPF fictício gerado no app** e aviso de demo, DEMO-01), login e criação do PIN; restauração e expiração de sessão
- [ ] Falhas como `sealed class`, mapeadas a partir do `code` do erro da API
- [ ] Primeiros componentes do `design_system` (botão, campo de texto) com as telas que os usam; pub workspace nasce com o pacote

## Tarefa 5 — Fechamento

- [ ] `/security-review` (obrigatório: auth, sessão e PIN)
- [ ] Threat model: novos riscos registrados (ex.: rate limit em memória, D3)
- [ ] ADR se alguma decisão D1–D7 mudar; CHANGELOG e roadmap

---

## Checkpoint de fim de semana

- [ ] Ameaças AUTH-01 a 09, API-06, MOB-01 e DEMO-01 com teste verde
- [ ] Cobertura ≥ 90% em `domain/` e `application/`
- [ ] App: cadastro, login, restauração de sessão e criação do PIN no emulador
- [ ] Se a semana estourar: telas do app passam para o início da semana 4; backend e segurança não são cortados
- [ ] Próximo passo: plano da semana 4 (Accounts + Ledger)
