# Operação: publicar e manter a demo

Este documento descreve como a V1 é publicada e mantida, com custo zero: Neon (banco), Render (API) e GitHub Actions (deploy, despertador e reset). A decisão e as consequências estão no [ADR 0012](adr/0012-hospedagem-da-v1.md).

> **Regra de ouro:** senhas, chaves e URLs de banco são criadas **na sua máquina** e coladas direto no Neon, no Render ou nos segredos do GitHub. Nunca entram no git, em issue, em chat ou em log. Segredo vazado é segredo comprometido: troque na hora.

## Visão geral

| Peça | Onde | O que guarda |
|---|---|---|
| Banco | Neon, projeto `next-bank`, AWS `us-east-1`, Postgres 17 | Branch `clean` (raiz: papéis e banco vazio) e branch `demo` (filho: a demo de verdade) |
| API | Render, serviço web `next-bank-api`, região Virginia, plano gratuito | Chaves da API e `DATABASE_URL`, só nas variáveis de ambiente do Render |
| Deploy | `.github/workflows/deploy.yml` | Migrations → deploy hook → espera o commit novo → smoke test |
| Despertador | `.github/workflows/keep-awake.yml` | Chama o `/health` a cada ~10 min |
| Reset diário | `.github/workflows/demo-reset.yml` | `demo` volta a `clean` → migrations → seed → smoke test, às 06:00 UTC |

## 1. Neon: projeto e branch limpo

1. Crie a conta em <https://neon.tech> e um projeto: nome `next-bank`, **Postgres 17**, região **AWS US East 1 (N. Virginia)**.
2. Renomeie o branch padrão para `clean`. Ele nunca recebe dados.
3. Gere duas senhas fortes na sua máquina (uma para cada papel):
   ```powershell
   node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
   ```
4. Copie a connection string do **dono** do projeto (`neondb_owner`), do branch `clean`, banco `neondb`, e rode o bootstrap com o `psql` do container local:
   ```powershell
   docker run --rm -i -v ${PWD}/infra/neon:/sql postgres:17 psql "<URL do dono>" -v ON_ERROR_STOP=1 -v migrator_password="<senha 1>" -v app_password="<senha 2>" -f /sql/bootstrap.sql
   ```
   Isso cria `nextbank_migrator`, `nextbank_app` e o banco `nextbank` **por SQL**. Nunca crie esses papéis pelo painel, porque papéis do painel ignoram os `GRANT`s (ADR 0009).

## 2. Neon: branch da demo

1. Crie um branch **filho de `clean`** chamado `demo`, com compute.
2. Monte as duas URLs do branch `demo` (banco `nextbank`), sempre com `sslmode=verify-full`:
   - **API** (`nextbank_app`, host com `-pooler`):
     `postgresql://nextbank_app:<senha 2>@<host-pooler>/nextbank?sslmode=verify-full`
   - **Migrations** (`nextbank_migrator`, host **direto**, sem `-pooler`):
     `postgresql://nextbank_migrator:<senha 1>@<host-direto>/nextbank?sslmode=verify-full`
3. Anote o **Project ID** e os IDs dos branches `clean` e `demo`, em Settings › General e na lista de branches. Eles não são segredo.
4. Crie uma **API key** do Neon (Account settings › API keys). Ela **é** segredo.

## 3. Render: o serviço da API

1. Crie a conta em <https://render.com> e um **Web Service** a partir do repositório `renatomf/next-bank`:
   - **Region:** Virginia (US East).
   - **Branch:** `main`.
   - **Runtime:** Node.
   - **Build command:** `corepack enable && pnpm install --frozen-lockfile`
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
   | `TRUST_PROXY` | `1` (ver a verificação no passo 6) |
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

## 6. Verificação do IP do cliente (API-14), obrigatória no primeiro deploy

O `TRUST_PROXY=1` supõe um único proxy do Render na frente da API.

1. Pelo celular, fora do Wi-Fi de casa, faça um login de propósito com a senha errada.
2. Nos logs do Render, procure a requisição `POST /v1/auth/login` e compare o `remoteAddress` com o IP público do celular (por exemplo, em um site de "qual é meu IP").
   - **Iguais:** está certo.
   - **IP interno do Render:** há mais saltos. Ajuste o `TRUST_PROXY` e repita a verificação.

## Rotina

- **Deploy:** automático depois de cada merge na `main` com o CI verde, ou manual pelo workflow.
- **Reset:** todo dia às 06:00 UTC, ou manual. As contas de visitantes somem, e Ana e Bruno voltam com o saldo de demonstração.
- **Despertador:** a cada ~10 min. Se o GitHub atrasar, a primeira abertura pode levar até 1 minuto.
- **Trocar uma chave da API:** gere de novo na sua máquina, atualize no Render e faça um deploy manual. Trocar `PII_*` ou o `PIN_PEPPER` invalida os CPFs e PINs já gravados. Na demo, rode o reset logo em seguida.
- **Segredo vazado:** troque-o na origem (Neon, Render ou GitHub) na hora. Apagar um commit não basta, porque o repositório é público.
