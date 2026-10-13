# Operação: publicar e manter a demo

Este documento descreve como a V1 é publicada e mantida, com custo zero: Neon (banco), Render (API) e GitHub Actions (deploy e reset) e UptimeRobot (despertador). A decisão e as consequências estão no [ADR 0012](adr/0012-hospedagem-da-v1.md).

> **Regra de ouro:** senhas, chaves e URLs de banco são criadas **na sua máquina** e coladas direto no Neon, no Render ou nos segredos do GitHub. Nunca entram no git, em issue, em chat ou em log. Segredo vazado é segredo comprometido: troque na hora.

## Visão geral

| Peça | Onde | O que guarda |
|---|---|---|
| Banco | Neon, projeto `next-bank`, AWS `us-east-1`, Postgres 17 | Branch `clean` (raiz: papéis e banco vazio) e branch `demo` (filho: a demo de verdade) |
| API | Render, serviço web `next-bank-api`, região Virginia, plano gratuito | Chaves da API e `DATABASE_URL`, só nas variáveis de ambiente do Render |
| Deploy | `.github/workflows/deploy.yml` | Migrations → deploy hook → espera o commit novo → smoke test |
| Despertador | UptimeRobot, monitor `next bank API` | Chama o `/health` a cada 5 min e avisa por e-mail se a API cair |
| Reset diário | `.github/workflows/demo-reset.yml` | `demo` volta a `clean` → migrations → seed → smoke test, às 06:00 UTC |

## 1. Neon: projeto e branch limpo

1. Crie a conta em <https://neon.tech> e um projeto: nome `next-bank`, **Postgres 17**, região **AWS US East 1 (N. Virginia)**.
2. Renomeie o branch padrão para `clean`. Ele nunca recebe dados.
3. Gere as duas senhas **direto em variáveis** e guarde-as no gerenciador de senhas (nunca no chat, no git ou num arquivo):
   ```powershell
   $mig = node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
   $app = node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
   "migrator: $mig"; "app: $app"
   ```
4. No **Connect** do Neon, escolha branch `clean`, banco `neondb`, role `neondb_owner`, **pooling desligado** (o bootstrap usa `SET ROLE`, que o pooler em modo transação quebra), e clique no ícone de copiar. **Não cole a URL em lugar nenhum**: o PowerShell a lê da área de transferência, inclusive se vier no formato `psql '...'`:
   ```powershell
   $owner = [regex]::Match(((Get-Clipboard) -join ''), "postgresql://[^'`"\s]+").Value.TrimEnd(':')
   $owner.StartsWith("postgresql://neondb_owner:")   # True
   $owner.Contains("-pooler")                        # False
   docker run --rm -i -v "${PWD}/infra/neon:/sql" postgres:17 psql $owner -v ON_ERROR_STOP=1 -v migrator_password=$mig -v app_password=$app -f /sql/bootstrap.sql
   Remove-Variable owner; Set-Clipboard -Value " "
   ```
   Isso cria `nextbank_migrator`, `nextbank_app` e o banco `nextbank` **por SQL**. As últimas linhas da saída devem ser `SET`, `REVOKE`, `GRANT`, `RESET`, `REVOKE ROLE` e `DO`; o `DO` final confere as permissões e interrompe com erro se elas não valeram (F-28). Nunca crie esses papéis pelo painel, porque papéis do painel ignoram os `GRANT`s (ADR 0009).

## 2. Neon: branch da demo

1. Em **Branches › New branch**: nome `demo`, pai `clean`, **Branch data and schema** (traz os papéis e as permissões), **Auto-delete desligado** (senão a demo some em um dia) e com compute.
2. Monte as duas URLs do branch `demo` (banco `nextbank`), sempre com `sslmode=verify-full`, a partir dos hosts do compute (o com `-pooler` e o direto):
   ```powershell
   $apiUrl = "postgresql://nextbank_app:$app@<host-com-pooler>/nextbank?sslmode=verify-full"
   $migUrl = "postgresql://nextbank_migrator:$mig@<host-direto>/nextbank?sslmode=verify-full"
   ```
3. Teste as duas conferindo o certificado. A imagem `postgres:17` vem sem os certificados raiz, por isso o teste os instala antes; a API (Node) e o dbmate (no runner do GitHub) já trazem os seus e usam as URLs como estão:
   ```powershell
   docker run --rm -e PGURL=$apiUrl postgres:17 sh -c 'apt-get update -qq >/dev/null && apt-get install -yqq ca-certificates >/dev/null 2>&1 && psql "$PGURL&sslrootcert=system" -Atc "select current_user"'   # nextbank_app
   docker run --rm -e PGURL=$migUrl postgres:17 sh -c 'apt-get update -qq >/dev/null && apt-get install -yqq ca-certificates >/dev/null 2>&1 && psql "$PGURL&sslrootcert=system" -Atc "select current_user"'   # nextbank_migrator
   ```
4. Guarde as duas URLs no gerenciador de senhas (`Set-Clipboard -Value $apiUrl`, cole; depois o mesmo com `$migUrl`) e limpe: `Remove-Variable mig, app, apiUrl, migUrl; Set-Clipboard -Value " "`.
5. Anote o **Project ID** e os IDs dos branches `clean` e `demo`, em Settings › General e na lista de branches. Eles não são segredo.
6. Crie uma **API key** do Neon (Account settings › API keys). Ela **é** segredo.

## 3. Render: o serviço da API

1. Crie a conta em <https://render.com> e um **Web Service** a partir do repositório `renatomf/next-bank`:
   - **Region:** Virginia (US East).
   - **Branch:** `main`.
   - **Runtime:** Node.
   - **Build command:** `corepack pnpm install --frozen-lockfile` (o `corepack enable` falha no Render, onde o `/usr/bin` é somente leitura)
   - **Start command:** `cd apps/api && node src/server.ts`
   - **Instance type:** Free.
   - **Health check path:** `/health`.
   - **Auto-Deploy:** **Off**, porque quem faz o deploy é o `deploy.yml`, depois das migrations.
2. Gere as chaves de produção **na sua máquina** e cole cada linha nas variáveis do Render. Não salve em arquivo:
   ```powershell
   node apps/api/scripts/generate-dev-keys.ts
   ```
   Troque o `JWT_KEY_ID` por `prod-AAAA-MM-DD`.
3. Variáveis de ambiente do serviço:

   | Variável | Valor |
   |---|---|
   | `NODE_ENV` | `production` (exige `sslmode=verify-full`) |
   | `NODE_VERSION` | `24` |
   | `HOST` | `0.0.0.0` |
   | `TRUST_PROXY` | `3` (Cloudflare e dois proxies do Render; ver a verificação no passo 6) |
   | `DATABASE_URL` | a URL da **API** do passo 2 |
   | `JWT_PRIVATE_KEY`, `JWT_KEY_ID`, `PII_ENCRYPTION_KEY`, `PII_HMAC_KEY`, `PII_KEY_VERSION`, `PIN_PEPPER` | do `generate-dev-keys.ts` |

4. Em Settings, copie o **Deploy Hook**. Ele é segredo: quem tem a URL consegue disparar deploys.

## 4. GitHub: segredos e variáveis

Em **Settings › Environments**, crie o ambiente `production` com estes **secrets**:
- `MIGRATION_DATABASE_URL`: a URL de **migrations** do passo 2;
- `RENDER_DEPLOY_HOOK`: o deploy hook do passo 3;
- `NEON_API_KEY`: a API key do passo 2.

Em **Settings › Secrets and variables › Actions › Variables**, no nível do repositório, crie estas **variáveis**:
- `API_URL`: o endereço do serviço, ex. `https://next-bank-api.onrender.com`;
- `NEON_PROJECT_ID`, `NEON_CLEAN_BRANCH_ID`, `NEON_DEMO_BRANCH_ID`.

## 5. Primeiro deploy e primeira demo

1. Em **Actions › Deploy › Run workflow**: aplica as migrations no branch `demo`, faz o deploy e espera o `/health` mostrar o commit.
2. Em **Actions › Demo reset › Run workflow**: cria Ana e Bruno. O smoke test confirma o login de Ana.
3. Abra `<API_URL>/health` no navegador. A resposta deve ser `{"status":"ok","release":"<commit>"}`.

## 6. Verificação do IP do cliente (API-14), obrigatória a cada mudança de hospedagem

Entre o cliente e a API há **três** saltos: a Cloudflare e dois proxies do Render. `TRUST_PROXY=3`, verificado em 2026-10-13. Com `1`, a API enxergava um endereço interno do Render (`10.x`) como cliente; com `2`, um servidor da Cloudflare (`104.x`, `172.70.x`), diferente a cada requisição. Nos dois casos, os visitantes dividiam contadores de tentativas que não eram deles (F-29).

A verificação é feita **do computador**, e não do celular: na rede móvel (CGNAT), a operadora pode mostrar um IP diferente para cada site, e a comparação não serve. Em Git Bash:

```sh
ts=$(date +%s)
curl -4 -s -o /dev/null -w "%{http_code}\n" -X POST "$API_URL/v1/auth/login" \
  -H 'content-type: application/json' -H "x-request-id: api14-plain-$ts" \
  -d '{"email":"ana.demo@example.com","password":"wrong-on-purpose"}'
curl -4 -s -o /dev/null -w "%{http_code}\n" -X POST "$API_URL/v1/auth/login" \
  -H 'content-type: application/json' -H "x-request-id: api14-spoof-$ts" \
  -H 'x-forwarded-for: 203.0.113.66' \
  -d '{"email":"ana.demo@example.com","password":"wrong-on-purpose"}'
curl -4 -s https://api.ipify.org; echo; echo "$ts"
```

Nos logs do Render, busque `api14-plain-<ts>` e `api14-spoof-<ts>` e confira o `remoteAddress` das duas linhas `incoming request`:
- **As duas com o IPv4 público do computador:** certo.
- **`10.x` ou outro endereço interno:** há mais saltos. Suba o `TRUST_PROXY` em 1 (máximo 3) e repita.
- **`203.0.113.66` na linha forjada:** o cliente escolhe o próprio IP. Desça o `TRUST_PROXY` em 1 e repita.

## 7. Sentry: erros inesperados

1. Crie a conta em <https://sentry.io> no plano gratuito (**Developer**) e dois projetos: `next-bank-api` (plataforma **Node.js**) e `next-bank-app` (**Flutter**). Nas perguntas iniciais, recuse rastreio de desempenho e replay de sessão.
2. Em cada projeto, copie o **DSN** (Settings › Client Keys). O DSN não é segredo em sentido estrito (vai dentro do APK), mas fica fora do git.
3. **API:** no Render, acrescente `SENTRY_DSN` (o DSN do `next-bank-api`) e `SENTRY_ENVIRONMENT=production`, e faça um deploy. Sem `SENTRY_DSN`, os erros ficam só nos logs.
4. **App:** o DSN do `next-bank-app` entra no build de release por `--dart-define=SENTRY_DSN=...` (tarefa 4, `release.yml`, como segredo do GitHub). Builds sem DSN não enviam nada.
5. O que chega ao Sentry: só erros inesperados (500 na API; falhas do Flutter no app), com o release e o ambiente. Nunca usuário, corpo de requisição, cabeçalhos de credencial, senha, PIN, tokens ou CPF: um removedor limpa cada evento antes de sair (`sentry-error-reporter.ts`, `error_reporting.dart`).

## 8. Release do app: chave de assinatura

O `release.yml` publica o APK na Release de cada tag `v*`, assinado com a chave do app. A chave é a identidade do app: **sem ela, nenhuma versão nova atualiza a instalada**, e quem a tiver pode publicar um APK que se passa pelo next bank. Ela vive só na sua máquina (com backup no gerenciador de senhas) e nos segredos do GitHub.

1. Gere a chave **fora do repositório**. O `keytool` vem com o JDK do Android Studio (`<Android Studio>\jbr\bin`) e pede as senhas sem mostrá-las; use a mesma senha para a chave e para o arquivo:
   ```powershell
   keytool -genkeypair -keystore "$env:USERPROFILE\next-bank-release.jks" -alias next-bank -keyalg RSA -keysize 4096 -validity 10000
   ```
   Guarde o arquivo `.jks` e a senha no gerenciador de senhas.
2. Em **Settings › Environments**, crie o ambiente `release` e, em **Deployment branches and tags**, permita só tags `v*`.
3. Crie os segredos do ambiente pelo `gh`, que lê da entrada sem mostrar nada na tela:
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:USERPROFILE\next-bank-release.jks")) | gh secret set ANDROID_KEYSTORE_BASE64 --env release
   gh secret set ANDROID_KEYSTORE_PASSWORD --env release   # cole a senha quando pedir
   gh secret set ANDROID_KEY_PASSWORD --env release        # a mesma senha
   gh secret set ANDROID_KEY_ALIAS --env release --body next-bank
   gh secret set SENTRY_DSN_APP --env release              # o DSN do next-bank-app (seção 7)
   ```
4. Publicar uma versão: crie e envie a tag (`git tag v1.0.0`, `git push origin v1.0.0`). O workflow recusa publicar sem a chave, sem o DSN ou sem `API_URL` em HTTPS. Os símbolos de ofuscação ficam como artefato privado da execução por 90 dias.
5. Quem baixa confere o APK pelo SHA-256 publicado junto: `Get-FileHash next-bank-v1.0.0.apk`.

## 9. UptimeRobot: despertador

O plano gratuito do Render dorme depois de 15 min sem uso. O UptimeRobot chama o `/health` a cada 5 min e mantém a API acordada; as 750 horas gratuitas por mês do Render cobrem um serviço ligado o mês todo.

1. Crie a conta em <https://uptimerobot.com>, no plano **Free**, e ative o 2FA (My Settings › Two-factor authentication).
2. **+ New monitor**: tipo **HTTP(s)**, URL `https://next-bank-api.onrender.com/health`, intervalo de **5 minutes**, nome `next bank API`.
3. Em notificações, deixe o seu e-mail: ele avisa se a API cair.

O monitor só conhece a URL pública do `/health`. Nenhum segredo vai para o UptimeRobot.

## Rotina

- **Deploy:** automático depois de cada merge na `main` com o CI verde, ou manual pelo workflow.
- **Reset:** todo dia às 06:00 UTC, ou manual. As contas de visitantes somem, e Ana e Bruno voltam com o saldo de demonstração.
- **Despertador:** a cada 5 min, pelo UptimeRobot. Se chegar o e-mail de que a API caiu, veja os logs do Render e o `/health`.
- **Trocar uma chave da API:** gere de novo na sua máquina, atualize no Render e faça um deploy manual. Trocar `PII_*` ou o `PIN_PEPPER` invalida os CPFs e PINs já gravados. Na demo, rode o reset logo em seguida.
- **Segredo vazado:** troque-o na origem (Neon, Render ou GitHub) na hora. Apagar um commit não basta, porque o repositório é público.
