# Changelog

Todas as mudanças relevantes do next bank são registradas aqui.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa [Versionamento Semântico](https://semver.org/lang/pt-BR/). Cada versão publicada recebe uma tag (`v1.0.0`, `v1.1.0`, `v1.2.0`).

## [Não publicado]

### Adicionado — Semana 4: Accounts + Ledger
- Schemas `accounts` e `ledger`: conta única por cliente, numerada por sequência; ledger de partidas dobradas que o próprio banco protege (saldo de cliente nunca negativo, lançamento sempre balanceado no `COMMIT`, inclusive sem partidas, mesma referência nunca lançada duas vezes, histórico imutável até para o dono das tabelas) e `system:funding` sem saldo materializado; a API só altera status de conta e saldos
- Perfil do cliente (`GET /v1/me`): nome e se o PIN já foi criado, para o app retomar o cadastro interrompido antes do PIN; só esses dois campos saem da API, o usuário vem sempre do token e qualquer parâmetro é recusado; contrato OpenAPI e cliente Dart atualizados
- App: conta sem PIN sempre retoma o cadastro em "Criar PIN", seja na restauração da sessão, no login ou no cadastro; o perfil é lido uma vez por login, só em memória, e sem conexão a Splash oferece "Tentar de novo"
- Domínio de Accounts e Ledger: `Money` em centavos inteiros (`bigint`, recusando virar número JSON inexato), número de conta sequencial com dígito verificador módulo 11, conta contábil de cliente que nunca fica negativa (`InsufficientFunds`), conta de sistema sem saldo materializado e lançamento com pelo menos duas partidas positivas e Σ débitos = Σ créditos
- Lançamentos no ledger (`PostJournalEntry`): contas de cliente travadas sempre em ordem de ID e contas de sistema nunca travadas; saldo conferido antes de qualquer escrita; provado contra o Postgres que dois débitos de R$ 80 sobre R$ 100 gastam o saldo uma vez (T-DB-08) e que transferências opostas simultâneas não travam (T-DB-09); abertura, funding único e leitura de saldo da conta contábil do cliente
- Cadastro abre a conta corrente (número da sequência com dígito verificador, conta contábil aberta pela porta do Ledger, `ACCOUNT_OPENED` na auditoria) e deposita R$ 10.000,00 de demonstração, tudo na mesma transação do usuário; 20 cadastros simultâneos nunca repetem número de conta
- Conta do cliente (`GET /v1/me/account`): agência, número, status e saldo disponível em centavos inteiros; a conta vem sempre do token, qualquer parâmetro é recusado e nenhuma rota aceita ID de recurso no caminho (READ-01, nova ameaça READ-05); erro `NotFound` do catálogo; contrato OpenAPI e cliente Dart atualizados
- `design_system`: `MoneyText` (centavos inteiros formatados como reais, o único lugar onde dinheiro é formatado, e oculto sem nenhum dígito), `BalanceCard` (seda em gradientes, painel de vidro, conta mascarada e olho para ocultar o saldo, com AA mesmo sobre o brilho Menta), `IconCircleButton`, `Skeleton` e `ErrorState`

### Corrigido
- Leitor de tela: seis componentes do `design_system` se fundiam com os textos vizinhos dentro de listas (o "Entrar" do login era anunciado junto com o texto ao lado, um bloco inteiro virava título); cada um agora tem o próprio nó de semântica (F-17)
- Card de saldo e brilho da tela fiéis ao mockup da Home: gradientes com a geometria exata do CSS e granulado que esconde as faixas que o Impeller desenhava nos degradês (F-19); o saldo oculto mostra a máscara na Manrope, que tem o ponto, e o "R$" não se mexe ao tocar no olho

### Adicionado — Semana 3: Identity
- Primeiras migrations: schemas `identity` (usuários, sessões, refresh tokens, PIN) e `audit` (trilha append-only garantida por `GRANT` e trigger), com as invariantes também no banco
- Testes de integração sempre contra o schema real: o banco de testes é recriado e migrado a cada execução
- Matriz de controles de segurança (`docs/security/controles-de-seguranca.md`): o que está implementado, planejado ou descartado, com evidências e registro de achados
- Domínio Identity: CPF (dígitos verificadores, exibição mascarada) e política de senha (10 a 128 caracteres, lista de senhas comuns)
- Regras de arquitetura no CI (dependency-cruiser) e gate de cobertura de 90% em `domain/` e `application/`
- Domínio Identity: sessão com rotação de refresh token, janela de 10 s para resposta perdida, revogação da sessão inteira no reuso e expiração por inatividade (7 dias) e absoluta (30 dias)
- Domínio Identity: PIN de transação (4 dígitos, sem sequências triviais, novo erro `InvalidPin`) com bloqueio de 30 min após 5 erros seguidos e redefinição obrigatória no 3º bloqueio em 24 h (novo erro `PinResetRequired`)
- Infraestrutura do Identity: Argon2id (parâmetros OWASP), cifragem do CPF (AES-256-GCM + índice cego HMAC), UUIDv7 e lista de senhas comuns reproduzível e sem dados pessoais
- Caso de uso de cadastro (`RegisterCustomer`): usuário, sessão e auditoria numa só transação; hash da senha calculado antes de checar se a conta existe, para o tempo de resposta não revelar quem é cliente
- Persistência do cadastro em Postgres: transação única com usuário, sessão, hash do refresh token e auditoria; corrida de cadastros simultâneos resolvida pelas restrições `UNIQUE`; consulta de existência servida pelos índices únicos
- Respostas de erro com o `code` do catálogo (RFC 9457), validação com 422 `InvalidRequest`, `Cache-Control: no-store` em toda resposta e rate limit global por IP (100/min) com 429 `TooManyAttempts`
- Tokens: JWT EdDSA de 15 min (`jose`) com validação completa (AUTH-05), refresh token opaco de 256 bits guardado só como hash, e chaves (JWT e CPF) validadas na inicialização; script para gerar as chaves locais
- Orquestração entre contextos (ADR 0010): o cadastro passa para `src/application/onboarding/`, sobre uma unidade de trabalho compartilhada por todos os módulos, com as regras de dependência verificadas no CI
- Rota `POST /v1/auth/register`: cadastro com tokens na resposta (só os 4 campos necessários), limite de 3 tentativas por IP por hora, schema estrito e erros do catálogo; contrato OpenAPI e cliente Dart atualizados
- Login (`POST /v1/auth/login`): sessão nova a cada login, bloqueio progressivo por conta (1 a 15 min) e 10 tentativas por IP por minuto, mesma resposta e uma verificação Argon2id para e-mail inexistente, senha errada e conta bloqueada (hash fictício), e `LOGIN_FAILED` gravado na auditoria
- Refresh (`POST /v1/auth/refresh`) com rotação, janela de 10 s e revogação da sessão no reuso, sob lock da sessão e com um só token ativo por sessão garantido no banco; logout (`POST /v1/auth/logout`) idempotente; autenticação negando por padrão (rotas só públicas quando declaradas)
- Criação do PIN de transação (`POST /v1/me/pin`): uma vez só (`PinAlreadyCreated`), hash Argon2id com pepper do servidor contra quebra a partir de um dump (API-13, `PIN_PEPPER`), e verificação no banco de que a sessão segue ativa nas operações sensíveis (AUTH-04)
- Revisão consolidada do Identity: e-mail e nome passam a ser redigidos nos logs (F-13); caso de uso de cadastro do Identity renomeado para `RegisterUser`
- App: sessão guardada só no Keychain/Keystore, num único registro, sem iCloud e sem backup do Android (MOB-01); sessão restaurada ao abrir o app; `x-request-id` em toda requisição
- App: cliente de autenticação (cadastro, login, PIN, logout), falhas da API como tipo fechado e interceptor que anexa o token só às operações protegidas e renova a sessão com um único refresh para chamadas simultâneas
- App: pacote `design_system` (tokens do brief, temas claro e escuro, botão principal, campo de texto, campo de PIN, logo e aviso de demonstração) com contraste AA verificado em teste e fontes empacotadas; app e pacote num pub workspace com um único lockfile
- App: navegação com GoRouter e redirect pela sessão (sessão expirada ou revogada volta ao login de qualquer tela, dizendo o motivo), telas de Splash e Login, "Sair" na Home (revoga na API e apaga o token mesmo sem conexão), deep links desligados (MOB-06) e `accent` do modo claro trocado para o mintInk, com AA em todos os fundos (F-15)
- App: cadastro com CPF fictício somente leitura e "Gerar outro" (DEMO-01) e criação do PIN em duas etapas, com as regras da API espelhadas no app; tema com todos os estilos de texto, `DisplayTitle`, `FormErrorText`, campo somente leitura e envio pelo teclado; teste de arquitetura passa a proibir `core/` de importar features

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
- Brief visual e design tokens (cor Menta, dark-first) e mockups de Home, Pix e Comprovante
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
