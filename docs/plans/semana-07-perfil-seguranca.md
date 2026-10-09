# Plano — Semana 7: Perfil, Segurança e polimento

- **Status:** Aprovado (2026-10-09), com as decisões D1 a D10 nos padrões recomendados
- **Roadmap:** `docs/roadmap.md` (seção 8, semana 7; telas 13 e 14 da tabela 7.1)
- **Base:**
  - ADRs 0003 (Flutter + Riverpod) e 0004 (tokens, sessão e PIN no servidor);
  - `domain-model.md`: 3.1 (`User.ChangePassword`, `Session.Revoke`/`RevokeAll`, `TransactionPin.Change` exige senha), 9 (catálogo), 10 (navegação inferior) e 11 (estados das telas 13 e 14);
  - `database.md` 5.1 (índice de sessões ativas por usuário);
  - threat model: AUTH-01, AUTH-04, AUTH-06, PIX-05, PIX-06, MOB-01, MOB-02, MOB-06;
  - checklist ASVS (sessão: "cliente vê e encerra as próprias sessões"; autenticação: "troca de senha exige a senha atual e encerra as outras sessões") e MASVS;
  - brief (seções 7 e 8) e mockup `home-dark.png` (navegação flutuante);
  - plano da semana 6: D6 (redefinição do PIN em Perfil > Segurança) e D12 (navegação flutuante na semana 7).
- **Carga:** ~30h (5 dias × 6h)
- **Objetivo:** o cliente vê e encerra as próprias sessões, troca e redefine o PIN com a senha, troca a senha encerrando as outras sessões, e navega pelas cinco áreas do app numa barra flutuante. As 14 telas da V1 ficam completas, acessíveis e com os estados de erro revisados.
- **Pronto quando:**
  - um cliente encerra a sessão de outro aparelho, e o refresh daquele aparelho recebe 401;
  - um PIN bloqueado por segurança (`PinResetRequired`) volta a funcionar só depois da senha correta;
  - a troca de senha encerra todas as outras sessões (AUTH-06);
  - todas as telas passam no teste de 1.3x num celular pequeno e têm rótulos para o leitor de tela;
  - `/security-review` sem achados abertos.

## Como trabalhamos nesta semana

- **Começa pela API, outside-in:** o teste HTTP contra o Postgres vem antes de cada rota.
- **Ataque antes da defesa:**
  - o IDOR (cliente A encerrando a sessão de B) é escrito antes da rota;
  - a força bruta na senha pela troca de PIN, antes do limite;
  - o refresh depois da troca de senha, antes da revogação.
- **App em TDD nos controllers e repositórios.** Telas e componentes recebem testes de widget depois.
- **Checkpoint no aparelho** antes de fechar a semana, com emulador e celular (lição do F-22 e do F-23).

## Fontes conferidas

| Fonte | Regra | Teste |
|---|---|---|
| ASVS: sessão | Cliente vê e encerra as próprias sessões | Rota: lista só as sessões ativas do token; encerrar uma → o refresh dela dá 401 |
| ASVS: controle de acesso / CLAUDE.md | Todo recurso tem teste de IDOR | A encerra uma sessão de B → 404, e a sessão de B continua ativa |
| AUTH-04 | Operação sensível confere se a sessão do token ainda está ativa | Trocar PIN ou senha com o token de uma sessão encerrada → 401 |
| AUTH-06 | Troca de senha revoga **todas** as outras sessões | Depois da troca, o refresh de outra sessão → 401; a sessão atual continua |
| AUTH-01 | Força bruta na senha | Senha errada na troca de PIN ou de senha conta no mesmo bloqueio progressivo do login; a 6ª em 1 min → 429 |
| AUTH-07, AUTH-08 | Política da nova senha | Senha comum ou maior que 128 → 422 antes do hash |
| PIX-05 / `domain-model.md` 3.1 | `TransactionPin.Change` exige a senha e limpa o bloqueio e o `resetRequired` | Domínio e rota: senha certa → PIN novo, tentativas zeradas; senha errada → nada muda |
| `domain-model.md` 9 | Erros do catálogo | Um teste por código novo (ver "Contratos") |
| `domain-model.md` 10 | Navegação inferior: Início · Extrato · **Pix** · Segurança · Perfil | Testes do router: cada destino abre a sua tela; o desbloqueio continua barrando todos |
| `domain-model.md` 11 | Tela 13: pronto. Tela 14: lista de sessões · encerrando (confirmação) · trocar PIN | Teste de widget de cada estado |
| MOB-01, MOB-02 | Senha e PIN nunca guardados nem logados | O estado dos controllers não tem campo de senha nem de PIN; o campo é limpo depois do envio |
| Brief 8 | Acessibilidade: rótulos, contraste AA, fonte até 1.3x | Teste de 1.3x em celular pequeno e de semântica em **cada** tela |
| Auditoria (`domain-model.md` 3.5) | `PIN_CHANGED`, `PASSWORD_CHANGED`, `SESSION_REVOKED` na mesma transação | Teste de que cada comando grava o evento, sem senha nem PIN no `metadata` |

## Estrutura

```
apps/api/src/modules/identity/
├── application/  list-sessions.ts, revoke-session.ts, change-pin.ts, change-password.ts
├── domain/       session.ts, transaction-pin.ts (+ change), user.ts (+ changePassword)
└── http/         me-sessions-routes.ts, me-pin-route (+ change), me-password-route.ts

apps/mobile/lib/
├── app/          shell com a navegação flutuante (raiz de composição)
├── features/profile/presentation/      tela 13
└── features/security/
    ├── domain/   SecurityRepository, ActiveSession
    ├── data/     HttpSecurityRepository
    └── presentation/ sessions/, change_pin/, change_password/

packages/design_system/   FloatingNavBar, ConfirmDialog (e o que cada tela pedir)
```

- **Sessões e senha ficam no Identity**, como o PIN. A conta do perfil vem do `core/account`, já existente.
- **O app não guarda nada novo** no aparelho (MOB-01). A identificação do aparelho sai do próprio sistema (D2).

## Concorrência

| Cenário | O que acontece | Teste |
|---|---|---|
| Encerrar uma sessão enquanto ela faz refresh | A sessão é travada (`FOR UPDATE`), como no refresh da semana 3: ou o refresh termina antes e a revogação vem depois, ou o refresh encontra a sessão revogada e dá 401 | Integração: os dois em paralelo, e no fim a sessão está revogada e nenhum token dela renova |
| Troca de senha com várias sessões refrescando | As sessões são revogadas na mesma transação da troca; um refresh concorrente espera a trava e recebe 401 | Integração com 5 sessões refrescando em paralelo |
| Duas trocas de PIN em paralelo | A linha do PIN é travada, como na verificação: uma vence, a outra lê o PIN novo | Integração |
| Senha errada em paralelo na troca de PIN | A tentativa é contada antes de qualquer `await`, como no login (F-11) | 10 tentativas paralelas → no máximo 5 conferidas |

## Contratos

**Rotas novas** (todas autenticadas, conta e usuário só do token):

| Rota | Entrada | Resposta | Erros |
|---|---|---|---|
| `GET /v1/me/sessions` | — | 200 `SessionList` `{ items: ActiveSession[] }` | 401 |
| `POST /v1/me/sessions/{sessionId}/revoke` | ID no caminho | 204 | 401; 404 `NotFound` (sessão de outro cliente, encerrada ou inexistente); 422 `InvalidRequest` (ver D3) |
| `POST /v1/me/pin/change` | `{ password, newPin }` | 204 | 401; 422 `PasswordIncorrect`, `InvalidPin`; 409 `PinNotCreated`; 429 `TooManyAttempts` |
| `POST /v1/me/password/change` | `{ currentPassword, newPassword }` | 204 | 401; 422 `PasswordIncorrect`, `WeakPassword`; 429 `TooManyAttempts` |

- **`ActiveSession`:** `{ id, deviceLabel: string | null, createdAt, lastUsedAt, current: boolean }`. Sem IP nem token.
- **Erro novo no catálogo:** `PasswordIncorrect` (422): "Senha incorreta." É 422, e não 401: um 401 faria o app tentar o refresh e sair da conta.
- **Schemas OpenAPI novos:** `SessionList`, `ActiveSession`, `ChangePinRequest`, `ChangePasswordRequest`. Cliente Dart regenerado.
- **Banco:** nenhuma migration. A lista usa o índice `sessions (user_id) WHERE revoked_at IS NULL`, que já existe (`EXPLAIN ANALYZE` no PR).
- **App, rotas do GoRouter:** `/profile`, `/security`, `/security/change-pin`, `/security/change-password`; as rotas de Início, Extrato e Pix passam a viver dentro do shell da navegação.

## Dependências novas

Nenhuma (ver D2 e D9).

## Decisões a confirmar (com padrão recomendado)

| # | Decisão | Padrão recomendado |
|---|---|---|
| D1 | Prioridade, se a semana estourar | Na ordem: sessões (API + tela) → trocar/redefinir PIN → trocar senha → navegação flutuante → acessibilidade e estados de erro. Se estourar, a navegação flutuante e o tema vão para a semana 8. Testes de segurança nunca são cortados |
| D2 | Como o aparelho aparece na lista de sessões | O app envia no login e no cadastro um rótulo do sistema, como "Android 15" ou "iOS 18" (`dart:io`, sem dependência nova). Modelo do aparelho pediria o `device_info_plus` |
| D3 | Encerrar a sessão atual pela lista | A lista não oferece "Encerrar" na sessão atual: ela mostra "Este aparelho", e sair é pelo "Sair" do Perfil (logout, AUTH-06). A rota recusa a sessão do próprio token com 422 |
| D4 | Troca de senha nesta semana | Entra: o ASVS e o AUTH-06 a marcam para a semana 7, e o PIN bloqueado já manda o cliente para "Perfil > Segurança". Encerra todas as **outras** sessões e mantém a atual |
| D5 | Redefinir o PIN bloqueado | A mesma tela de trocar PIN: senha + PIN novo. Ela zera as tentativas, o bloqueio de 30 min e o `resetRequired`. O Desbloqueio com PIN bloqueado continua oferecendo só "Sair": o cliente entra com a senha e redefine |
| D6 | O que o Perfil mostra | Nome, agência e conta (já carregados), "Segurança" e "Sair". E-mail e CPF ficam fora: exigiriam campos novos na API (READ-02, minimização) |
| D7 | Navegação flutuante | Barra flutuante do mockup com os cinco destinos; o Pix é a ação central. Aparece em Início, Extrato, Segurança e Perfil, e some nos fluxos (Pix, revisão, comprovante, troca de PIN) para não sair no meio deles |
| D8 | Acessibilidade e estados de erro | Varredura das 14 telas: teste de 1.3x em 320 px, rótulos de leitor de tela e contraste AA de cada texto sobre o seu fundo, nos dois temas. Erros revisados contra o catálogo |
| D9 | Seletor de tema (extra) | Seguir o tema do sistema por padrão e oferecer "Claro" e "Escuro" no Perfil, guardando só a escolha diferente do padrão no secure storage (sem `SharedPreferences`, MOB-01). Entra só se D1 deixar folga; senão, "Próximos passos" |
| D10 | Animações (extra do roadmap) | Fora: vão para "Próximos passos" |

## Fora desta semana

- Biometria (D4 da semana 6), compartilhar comprovante (D9 da semana 6) e "Minhas chaves" (tela 15, extra).
- E-mail e CPF no Perfil (D6) e animações (D10).
- Deploy, E2E e DAST: semana 8.

---

## Tarefa 0 — Plano (antes do código)

- [x] Este plano aprovado; `PasswordIncorrect` no catálogo do `domain-model.md`; animações em "Próximos passos" (D10)

## Tarefa 1 — Sessões na API (dia 1)

- [ ] `GET /v1/me/sessions` e `POST /v1/me/sessions/{id}/revoke`, outside-in, com o IDOR e a concorrência com o refresh escritos antes
- [ ] App envia o rótulo do aparelho no login e no cadastro (D2)

## Tarefa 2 — PIN e senha na API (dia 2)

- [ ] `TransactionPin.Change` no domínio (TDD) e `POST /v1/me/pin/change`, com a força bruta na senha escrita antes
- [ ] `User.ChangePassword` e `POST /v1/me/password/change`, revogando as outras sessões (AUTH-06)
- [ ] Contrato e cliente Dart regenerados

## Tarefa 3 — Perfil e Segurança no app (dia 3–4)

- [ ] `features/security`: repositório e controllers (TDD); telas de sessões, trocar PIN e trocar senha
- [ ] `features/profile`: tela 13; navegação flutuante (D7)

## Tarefa 4 — Polimento (dia 4–5)

- [ ] Acessibilidade e estados de erro nas 14 telas (D8)
- [ ] Seletor de tema, se houver folga (D9)

## Tarefa 5 — Fechamento

- [ ] `/security-review` (obrigatório: sessão, PIN e senha)
- [ ] Threat model, matriz de controles e checklist ASVS/MASVS
- [ ] `domain-model.md`, CHANGELOG e checkpoint no aparelho

---

## Checkpoint de fim de semana

- [ ] As 14 telas implementadas, no emulador e no celular
- [ ] Sessão encerrada em outro aparelho deixa de funcionar; troca de senha encerra as outras sessões
- [ ] PIN bloqueado redefinido com a senha
- [ ] Todas as telas em 1.3x num celular pequeno, com rótulos de leitor de tela
- [ ] Cobertura ≥ 90% em `domain/` e `application/`; lint e `flutter analyze` sem warnings
- [ ] Próximo passo: plano da semana 8 (qualidade, deploy e demo pública)
