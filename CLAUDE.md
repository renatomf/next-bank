# next bank — Regras do projeto

- Roadmap: `docs/roadmap.md`
- Brief visual: `docs/design/brief.md`
- Modelo de domínio: `docs/architecture/domain-model.md`
- Responder sempre em português (pt-BR).

## Padrões de engenharia (inegociáveis)

O projeto é tratado como um **banco real em produção**. Nenhum padrão abaixo é relaxado por prazo: se não cabe, reduz-se o escopo, nunca a qualidade.

**Prioridade em caso de conflito:** Segurança > Correção financeira > Testes e qualidade > Performance > Velocidade de entrega.

**Escopo da V1 congelado** (desde 2026-10-05): funcionalidade, ferramenta ou serviço novo não entra até a `v1.0.0`; vai para "Próximos passos" no roadmap. Exceção: correções de segurança ou de integridade financeira. Documento novo só quando o código precisar dele.

**Simplicidade:** nenhuma estrutura, dependência ou configuração entra antes de existir código que precise dela. Na dúvida, a solução mais simples; o projeto evolui conforme a necessidade.

### 1. Segurança (prioridade máxima)

- **Security by design:** toda feature começa revisando o threat model (`docs/security/threat-model.md`). Ameaça nova vira uma linha no threat model **e** um teste.
- **Baseline:** OWASP ASVS L2 (API e backoffice) e OWASP MASVS (app).
- **Entrada:** toda entrada validada na borda (Zod no backend, validação no app); sem SQL concatenado (só queries parametrizadas, tipadas pelo pgTyped).
- **Autorização:** negar por padrão; todo endpoint verifica dono do recurso; **todo recurso tem teste de IDOR** (usuário A acessando dado de B → 404).
- **Autenticação e criptografia:** só bibliotecas consolidadas (argon2, jose); nunca criptografia caseira; comparação de segredos em tempo constante.
- **Segredos:** só em variáveis de ambiente / secret store; nunca em código, teste, log ou mensagem de erro.
- **Dados pessoais (LGPD):** redação automática de CPF, tokens, senhas e PIN nos logs (Pino `redact`) e no Sentry (`beforeSend`); minimização de dados em todas as respostas.
- **Erros:** respostas nunca expõem stack trace, SQL ou detalhes internos.
- **Headers e transporte:** HTTPS, HSTS, headers seguros, CORS restrito, rate limit em rotas sensíveis.
- **Mobile:** tokens só em Keychain/Keystore; nada sensível em logs, cache ou `SharedPreferences`; build de release ofuscado.
- **Dependências:** lockfile commitado; scanner de vulnerabilidades no CI; dependência nova exige justificativa (manutenção ativa, licença, tamanho).
- **Gates de CI que bloqueiam merge:** gitleaks (segredos), Semgrep (SAST), osv-scanner (dependências).
- **Revisão de segurança obrigatória** (`/security-review`) em toda mudança em auth, sessão, PIN, ledger, Pix, idempotência ou autorização.

### 2. Correção financeira

- Dinheiro só como `Money` (inteiro em centavos); `double`/`number` de ponto flutuante para valores é proibido.
- Todo comando financeiro é idempotente, transacional e usa locks em ordem determinística.
- Ledger só aceita inclusão; correção apenas por estorno.
- Toda regra financeira tem teste, incluindo **testes de concorrência** (requisições simultâneas sobre o mesmo saldo).

### 3. Arquitetura

- Fronteiras hexagonais e regras de import verificadas no CI (dependency-cruiser no TS, lint de imports no Dart). Violação quebra o build.
- Domínio sem dependência de framework.
- Toda decisão relevante vira ADR (`docs/adr/`), com alternativas e consequências negativas.
- Atalho "temporário" só com issue aberta e prazo.

### 4. Qualidade de código

- **TypeScript:** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; ESLint sem warnings; Prettier.
- **Dart:** lints estritos (`very_good_analysis` ou equivalente); zero warnings no `flutter analyze`.
- Sem `any`/`dynamic` sem justificativa em comentário; sem código morto; sem `print`/`console.log` (só o logger).
- Nomes seguem a linguagem ubíqua do modelo de domínio.
- Commits no padrão Conventional Commits; PRs pequenos e focados.

### 5. Testes

- **TDD (teste antes do código, ciclo vermelho → verde → refatorar):**
  - Domínio: TDD estrito. A lista de testes de cada fatia sai do modelo de domínio (cada invariante e cada erro do catálogo vira teste).
  - Casos de uso: TDD com portas falsas e `Clock` controlável.
  - API: outside-in — o teste HTTP (contra Postgres real) é escrito antes da rota.
  - Segurança: o teste do ataque (IDOR, reuso de token, força bruta no PIN) é escrito antes da defesa.
  - Flutter: TDD em notifiers e repositórios.
  - **Sem TDD:** layout de telas e componentes visuais (testes de widget depois), configuração (validada pelo CI) e código gerado.
  - Commits mostram a sequência: `test:` antes de `feat:`.
- **Cobertura mínima de 90%** em `domain/` e `application/` (gate no CI). Sem meta numérica para o resto: o que importa é testar comportamento, não linhas.
- Testes de integração contra **Postgres real** (Docker), nunca banco em memória.
- Testes de segurança obrigatórios: autorização/IDOR, idempotência, concorrência, rate limit, reuso de refresh token, bloqueio de PIN.
- E2E do fluxo crítico (login → Pix → comprovante → extrato).
- **Bug corrigido = teste que o reproduz antes da correção.**
- Desejável: testes de mutação (Stryker) no domínio de Ledger e Payments.

### 6. Performance

- **Orçamentos (medidos, não estimados):**
  - API: p95 < 200 ms nas leituras e < 400 ms no Pix (ambiente publicado, carga nominal)
  - App: início a frio < 2 s em aparelho intermediário; listas sem jank (60 fps)
- Toda query nova passa por `EXPLAIN ANALYZE` e tem índice que a sustente; sem N+1; paginação sempre.
- Medir antes de otimizar; regressões de performance são bugs.

### 7. Observabilidade

- `requestId` propagado do app ao banco; logs estruturados (JSON) sem dados sensíveis.
- Todo erro inesperado chega ao Sentry com release e ambiente.
- Health check na API.

### Definition of Done (toda tarefa)

- [ ] Threat model revisado; ameaças novas registradas e testadas
- [ ] Testes escritos (unitários, integração e segurança quando aplicável) e passando
- [ ] Lint, typecheck e analyze sem warnings
- [ ] Gates de segurança do CI verdes
- [ ] Sem segredos, dados reais ou PII no diff
- [ ] Queries novas com índice verificado
- [ ] ADR criado ou atualizado se houve decisão de arquitetura
- [ ] Documentação atualizada (README, diagramas, modelo de domínio)

## Git: branches, commits e PRs

- **`main` é protegida:** nunca recebe commit direto; só merge via Pull Request (com CI verde a partir da semana 2).
- **Uma branch por tarefa ou fatia**, de vida curta (até ~3 dias), criada a partir da `main` atualizada.
- **Nome da branch:** `<tipo>/<descricao-curta>` em kebab-case. Ex.: `feat/pix-authorize`, `docs/database-design`, `fix/refresh-token-race`.
- **Tipos** (branches e commits): `feat`, `fix`, `test`, `refactor`, `perf`, `security`, `docs`, `chore`, `ci`, `build`.
- **Commits (Conventional Commits, em inglês):**
  - Título: `tipo(escopo): resumo no imperativo`, até 72 caracteres. Ex.: `feat(payments): authorize Pix with PIN check`
  - Escopos: `api`, `mobile`, `backoffice`, `contracts`, `design-system`, `identity`, `accounts`, `ledger`, `payments`, `audit`, `infra`, `ci`, `docs`, `security`
  - Corpo (quando não for trivial): **o porquê** da mudança, não só o quê.
  - Commits atômicos: uma mudança lógica por commit; nada de "ajustes diversos".
  - TDD: o commit `test:` (vermelho) pode vir antes do `feat:` dentro da branch; o PR só é mergeado com tudo verde.
- **Pull Requests:**
  - Título no mesmo padrão dos commits; título e descrição em inglês.
  - Descrição: contexto, o que mudou, como testar, riscos/segurança e o checklist da Definition of Done.
  - Merge com **merge commit** (`--no-ff`), preservando a sequência de commits (inclusive o ciclo TDD).
- **Nunca** `push --force` na `main`; nunca reescrever histórico já publicado.
- **Tags SemVer** nos marcos: `v1.0.0`, `v1.1.0`, `v1.2.0`.

## Segurança do repositório (obrigatório)

O repositório `renatomf/next-bank` é **público**. Antes de qualquer commit:

- **Nada sensível entra no git.** Segredos, `.env`, chaves, certificados, keystores, tokens, credenciais de nuvem, arquivos do Firebase, dumps de banco e logs ficam no `.gitignore` desde o primeiro momento.
- **Ao adicionar uma ferramenta nova** (Firebase, Sentry, deploy, etc.), atualizar o `.gitignore` **antes** de gerar ou baixar seus arquivos de configuração.
- **Configuração versionada só como exemplo:** `.env.example` com valores falsos e comentários; nunca valores reais.
- **Conferir o que vai ser commitado** (`git status` / `git diff --cached`) e procurar por segredos antes de cada commit.
- **Nada de terceiros sem licença:** imagens de referência, marcas e assets de outros bancos ficam só localmente (`docs/design/references/` é ignorada).
- **Dados de exemplo são fictícios:** nenhum CPF, e-mail ou telefone real em código, testes, seeds ou documentação.
- **Push só com confirmação do desenvolvedor.**
