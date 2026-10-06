# Changelog

Todas as mudanças relevantes do next bank são registradas aqui.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa [Versionamento Semântico](https://semver.org/lang/pt-BR/). Cada versão publicada recebe uma tag (`v1.0.0`, `v1.1.0`, `v1.2.0`).

## [Não publicado]

### Adicionado — Semana 3: Identity
- Primeiras migrations: schemas `identity` (usuários, sessões, refresh tokens, PIN) e `audit` (trilha append-only garantida por `GRANT` e trigger), com as invariantes também no banco
- Testes de integração sempre contra o schema real: o banco de testes é recriado e migrado a cada execução
- Matriz de controles de segurança (`docs/security/controles-de-seguranca.md`): o que está implementado, planejado ou descartado, com evidências e registro de achados
- Domínio Identity: CPF (dígitos verificadores, exibição mascarada) e política de senha (10 a 128 caracteres, lista de senhas comuns)
- Regras de arquitetura no CI (dependency-cruiser) e gate de cobertura de 90% em `domain/` e `application/`
- Domínio Identity: sessão com rotação de refresh token, janela de 10 s para resposta perdida, revogação da sessão inteira no reuso e expiração por inatividade (7 dias) e absoluta (30 dias)
- Domínio Identity: PIN de transação (4 dígitos, sem sequências triviais, novo erro `InvalidPin`) com bloqueio de 30 min após 5 erros seguidos

### Adicionado — Semana 2: esqueleto ponta a ponta
- Postgres 17 local (Docker Compose) com papéis de menor privilégio (`nextbank_migrator`, `nextbank_app`) e timeouts no papel da aplicação
- Threat model: API-11 (papel com privilégio do provedor) e API-12 (transação travando saldo)
- Workspace pnpm e migrations SQL com dbmate em `apps/api`
- Spike do contrato: cliente Dart gerado a partir do OpenAPI validado (ADR 0008)
- API base (Fastify 5, TypeScript 6 estrito): `/health`, erros RFC 9457 genéricos, limite de corpo, redação de dados sensíveis nos logs, `x-request-id` validado, headers de segurança e configuração validada na inicialização
- Banco `nextbank_test` para os testes de integração
- CI no GitHub Actions (API com Postgres real, mobile e gitleaks em todo o histórico), actions fixadas por SHA e Dependabot
- Contrato da API: OpenAPI gerado dos schemas Zod e cliente Dart em `packages/contracts`, com gate de divergência no CI
- App: Home exibe o status da API pelo cliente gerado (Riverpod + Dio); HTTP só para hosts locais em builds de debug (MOB-03)
- Gates de segurança completos no CI: osv-scanner (vulnerabilidades em todos os lockfiles) e Semgrep (incluindo regra própria contra SQL montado com strings, API-01)
- Teste de arquitetura no app (regra de dependência da Clean Architecture)
- Hook `pre-commit` com gitleaks: segredos barrados antes de sair da máquina (API-08)

### Adicionado — Semana 1: arquitetura e segurança
- Roadmap e design de arquitetura (V1 Core, Pix assíncrono, backoffice)
- Brief visual e design tokens (cor Paraíba, dark-first) e mockups de Home, Pix e Comprovante
- Modelo de domínio: contextos, agregados, máquina de estados do Pix, plano de contas, catálogo de erros, mapa de navegação
- Desenho do banco de dados: schema por contexto, restrições como última barreira, ledger e auditoria imutáveis, criptografia de dados pessoais, estratégia de concorrência, caminho de escala
- Threat model STRIDE com 42 ameaças (incluindo a demo pública) e checklist OWASP ASVS/MASVS
- ADRs 0001–0009
- Diagramas C4 (contexto e containers) e de sequência (login com renovação de sessão e Pix interno)
- Padrões de engenharia, regras de TDD e convenções de Git
- Documento de evolução do projeto
- README em inglês e imagens dos mockups da V1
- Plano da demo pública: contas de demonstração, CPF fictício no cadastro, reset semanal

### Alterado
- Documentação reorganizada (`docs/roadmap.md`, `docs/plans/`)
- Monorepo com Turborepo no lado TypeScript; backoffice no Render com API administrativa privada
- Acesso a dados com SQL puro (`pg` + dbmate) no lugar do Drizzle; pgTyped descartado no spike da semana 2
- Escopo da V1 congelado até a `v1.0.0`
- App mobile sem o código de exemplo do template do Flutter
- Lints estritos no app mobile (`very_good_analysis`)

### Segurança
- `.gitignore` cobrindo segredos, chaves, certificados, credenciais e dumps
- Secret scanning, push protection e Dependabot ativados no repositório
- Licença com todos os direitos reservados
- `.gitattributes` padronizando quebras de linha
