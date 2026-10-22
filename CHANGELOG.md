# Changelog

Todas as mudanças relevantes do next bank são registradas aqui.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa [Versionamento Semântico](https://semver.org/lang/pt-BR/). Cada versão publicada recebe uma tag (`v1.0.0`, `v1.1.0`, `v1.2.0`).

## [Não publicado]

## [1.1.0] — 2026-10-21

Produtos do dia a dia: o visitante já tem o que usar na primeira abertura, sempre com dinheiro, pessoas e empresas fictícios e sem nenhum provedor real (plano `v1.1.0-produtos-do-dia-a-dia.md`).

### Adicionado
- **Comprovante compartilhado:** o comprovante do Pix concluído sai como imagem, com os mesmos dados mascarados da tela e o aviso de que o next bank é fictício (MOB-09, DEMO-05).
- **Biometria:**
  - a digital desbloqueia o app e confirma o Pix e a recarga, liberando o PIN guardado com uma chave do aparelho que exige biometria forte; o servidor continua conferindo o PIN (ADR 0004, ADR 0013);
  - o rosto só destrava a tela, nunca move dinheiro;
  - novo Desbloqueio, com só o primeiro nome do cliente (MOB-11, MOB-12, MOB-13).
- **Pix por QR Code:**
  - receber: cada conta ganha uma chave aleatória, e o QR Code nunca leva o CPF (PIX-12);
  - pagar: pela câmera ou pelo "Copia e Cola". O código é conferido inteiro antes de qualquer tela, o nome do QR é descartado e o titular vem do servidor, e o valor fixo chega travado (PIX-11, PIX-13).
- **Recarga de celular:**
  - três operadoras fictícias (Onda Móvel, Pulso Celular e Rede Nova), valores de R$ 15, 20, 30 e 50 e limite de R$ 200 por dia;
  - só números do intervalo fictício `(DD) 90000-XXXX`;
  - PIN ou biometria, comprovante e a recarga no extrato;
  - o número fica cifrado com chave própria e aparece sempre mascarado (TOP-01, TOP-02).
- **Extrato redesenhado:** filtros de entradas, saídas, Pix e comprovantes, e busca pelo nome, feitos no servidor (READ-06).
- **Novas telas:**
  - Home com o box Pix, os atalhos e "Meus cartões";
  - perfil redesenhado;
  - nova barra de navegação.
- **Telas só de layout:** Ajuda, Notificações, Pix Automático, Minhas chaves, Transferir, Assistente, Menu, Cartões e Investimentos. Os valores inventados levam a etiqueta "Exemplo" (F-37).

### Alterado
- **Botões abaixo do saldo na Home:** "Extrato ›" e "Agendamentos ›" em pílulas de vidro como a do saldo, uma em cada ponta; "Agendamentos" é só layout por ora ("Em breve").
- **Fronteiras de UI** (ADR 0014):
  - o design system passa a ter só tokens, tema, componentes e padrões, sem texto de interface;
  - os componentes do banco vão para `core/ui`;
  - as features só compõem.
- **Idempotência compartilhada:** passa a ser de toda a API, num schema comum, para o Pix e a recarga usarem a mesma garantia (ADR 0015).
- **Filtro "Pix" do extrato:** mostra só Pix; uma recarga aparece em "Comprovantes".

### Segurança
- **Print bloqueado no app de release:** a gravação de tela mostra o app preto, e a miniatura dos recentes não mostra o conteúdo (MOB-14).
- **IP do cliente conferido a cada deploy:** o smoke test falha sozinho se o número de proxies na frente da API mudar (API-14).
- **Sentry e logs:** o termo buscado no extrato e o número da recarga não chegam a eles (F-35, MOB-02).
- **Recarga dupla:** uma recarga cuja resposta se perdeu nunca é feita duas vezes, nem saindo da tela e voltando (F-39).
- **Dependências:** `vite` atualizado para 8.3.4 (GHSA-698v-4r3x-3vcv), além das atualizações do Dependabot.

### Corrigido
- O ponto do logo "next." ficava acima do pé do "t" e colado nele; agora fica no mesmo nível (medido nos tamanhos do app) e um pouco afastado. O ícone do app não muda.
- O detalhe do extrato chamava de "CPF" todo documento da outra parte; uma recarga mostra "Celular" (F-38).
- O E2E falhava às vezes no login quando o teclado tirava o botão "Entrar" da tela pequena do emulador do CI.

## [1.0.1] — 2026-10-13

### Alterado
- **Despertador da API:** um monitor do UptimeRobot chama o `/health` a cada 5 min e avisa por e-mail se a API cair. O workflow agendado do GitHub (`keep-awake.yml`) rodou só 3 vezes no dia da `v1.0.0`, e a API dormia (ADR 0012, revisão).
- **README:** como passar pelo bloqueio do Play Protect ao instalar o APK.

> **Nota:** esta seção anunciava também um ajuste do ponto do logo, por engano: o PR dele (#121) ainda estava aberto quando a tag foi criada, e o app da `1.0.1` tem o mesmo logo da `1.0.0` (F-33). O ajuste entra na versão seguinte.

## [1.0.0] — 2026-10-13

Primeira versão publicada: o app Android ligado à API em produção, com a demo pública.

### Adicionado — Semana 8: Qualidade e produção
- **Demo pública:**
  - contas de demonstração Ana e Bruno, criadas pelas próprias rotas da API (`pnpm seed:demo`), com saldo e com a chave CPF de Bruno para um Pix entre elas;
  - as contas de demonstração não trocam senha nem PIN e não encerram sessões: `403 DemoAccountRestricted`, com o convite para criar a própria conta (DEMO-03).
- **Produção, sem custo** (ADR 0012):
  - API no Render e banco no Neon, os dois em `us-east-1`;
  - certificado do banco sempre conferido (`sslmode=verify-full`);
  - a API identifica o cliente atrás da Cloudflare e do Render (`TRUST_PROXY=3`), para o rate limit valer por cliente (API-14).
- **Workflows:**
  - `deploy.yml`: migrations, deploy e smoke test;
  - `demo-reset.yml`: a demo volta ao estado limpo todo dia;
  - `keep-awake.yml`: mantém a API gratuita acordada;
  - `release.yml`: APK assinado e ofuscado nas Releases, com SHA-256.
- **`/health` com o release:** mostra o commit publicado.
- **Sentry na API e no app:** só erros inesperados, sem usuário, corpo de requisição, credenciais, tokens nem CPF.
- **E2E do fluxo crítico:** login, Pix, comprovante e extrato num emulador Android, contra a API e o Postgres de verdade (`integration_test`, `e2e.yml`).
- **Mapa dos testes de segurança obrigatórios:** cada item aponta para o arquivo que o prova (`controles-de-seguranca.md`, seção 9.1).
- **Performance medida** ([performance.md](docs/performance.md)):
  - leituras com cerca de 10 ms no servidor;
  - abertura a frio do app em 0,7 s;
  - a autorização do Pix passa do orçamento por causa do Argon2id na CPU gratuita, desvio registrado no ADR 0012.
- **App de release:**
  - assinado com chave guardada só nos segredos do CI;
  - ofuscado (Dart e R8);
  - só HTTPS, e recusa certificados de usuário (conferido com um proxy de interceptação).
- **Ícone e abertura:** ícone adaptativo "n." desenhado pelo próprio logo, e splash nativa na cor da marca, nos temas claro e escuro.
- **Home e navegação revistas:**
  - barra de navegação embaixo, com rótulos e degradê no tom de cada tema;
  - logo ao lado da saudação, atalhos do mesmo tamanho e o olho escondendo só o saldo, escondido desde a abertura;
  - símbolo oficial do Pix (com o aviso de marca no README);
  - campo de senha com o botão de mostrar o que foi digitado.

### Corrigido — Semana 8
- Uma falha ao renovar a sessão mantém a tela e mostra um aviso por cima, em vez de trocar a tela.
- Atrás de um proxy de interceptação, o app dizia "Algo deu errado"; agora diz "Sem conexão" (F-31).
- No Neon, as permissões do banco não valiam quando aplicadas pelo dono do projeto; o bootstrap passa a agir como dono do banco e confere o resultado (F-28).
- Em produção, a API via um endereço interno ou da Cloudflare no lugar do cliente (F-29).

### Adicionado — Semana 7: Perfil, Segurança e polimento
- **Sessões na API:**
  - `GET /v1/me/sessions` lista as sessões ativas do cliente, com o rótulo do aparelho e qual é a atual;
  - `POST /v1/me/sessions/{id}/revoke` encerra outra sessão. O refresh token dela deixa de valer na hora, a própria sessão não pode ser encerrada por aí, e a sessão de outro cliente responde o mesmo 404.
- **Rótulo do aparelho:** o app envia "Android" ou "iOS" no login e no cadastro.
- **Troca de PIN** (`POST /v1/me/pin/change`): exige a senha. As senhas erradas contam no mesmo contador do login, e assim um PIN bloqueado é redefinido com a senha.
- **Troca de senha** (`POST /v1/me/password/change`): exige a senha atual e encerra as outras sessões na mesma transação (AUTH-06).
- **Novo erro:** `PasswordIncorrect` ("Senha incorreta.").
- **Segurança no app (tela 14):** sessões ativas, com confirmação antes de encerrar, e as telas de trocar PIN e trocar senha.
- **Perfil (tela 13):** nome, agência e conta mascarada, atalho para Segurança e o "Sair", que deixou a Home.
- **Navegação flutuante:** Início, Extrato, Pix, Segurança e Perfil. O Extrato virou destino da barra, e os fluxos (Pix, detalhes, trocas) abrem por cima, sem ela.
- **Tema:** o app segue o modo claro ou escuro do celular, e o Perfil oferece Sistema, Claro e Escuro. A escolha fica no secure storage (MOB-01).
- **Varredura de acessibilidade:** as 16 telas, nos dois temas, são conferidas quanto a rótulos de leitor de tela, áreas de toque de 48 dp e 44 pt, e contraste AA do texto sobre o fundo desenhado. Todas as telas também cabem num celular pequeno com fonte em 1.3x.
- **CI:** login no Docker Hub, para não esbarrar no limite de downloads anônimos.

### Corrigido — Semana 7
- **F-24:** um login com a senha antiga, ainda em verificação quando a senha era trocada, abria sessão depois da troca.
- **F-25:** os campos novos de senha e PIN das trocas não estavam na redação dos logs.
- **F-26:** o `PinNotCreated` só mostrava a mensagem; agora leva à criação do PIN.
- **Barra flutuante:** quebrava fora de um `Scaffold`, por falta de `Material`.
- **Perfil:** "Sair da conta" estourava a borda num celular pequeno com fonte grande.

### Adicionado — Semana 6: Pix no app + Extrato
- Extrato na API (`GET /v1/me/statement`): só da conta do token, página fixa de 20, do mais novo ao mais antigo, com cursor opaco `(created_at, id)` em microssegundos; Pix novo entre duas páginas não duplica nem pula (T-DB-12); índice `postings_statement_idx` verificado com `EXPLAIN ANALYZE`; `transferId` só num Pix enviado
- Desbloqueio (tela 5): o app abre travado com sessão guardada e trava de novo após 5 minutos em segundo plano, medidos pelo relógio monotônico e pela data do aparelho; o PIN é conferido no servidor, no mesmo contador do Pix; PIN bloqueado oferece só "Sair"; o login com senha vai direto à Home
- Pix no app (telas 7 a 10): valor digitado em centavos inteiros, chave CPF conferida no aparelho antes da consulta, revisão com o que o servidor gravou, PIN, processamento e comprovante; a resposta perdida da autorização é pedida de novo com a mesma `Idempotency-Key` e o mesmo PIN, mantido só em memória (MOB-07); voltar do comprovante leva à Home, nunca ao PIN
- Extrato no app (telas 11 e 12): lista com paginação por cursor e "puxar para atualizar", detalhe com "Ver comprovante" só num Pix enviado, e as três movimentações mais recentes na Home com "Ver extrato"
- "Ocultar saldo" esconde também os valores das movimentações e o saldo na tela do Pix
- A Home lê de novo o saldo e as movimentações ao voltar ao app e quando é puxada para baixo, para mostrar o dinheiro que chegou com o app aberto
- Design system: `AmountCard`, `ContactCard`, `SecureHint`, `ActionTile`, `StatusBadge`, `ReceiptCard`, `SecondaryButton`, `TransactionItem`, `EmptyState` e `ScreenHeader`, conferidos contra os mockups; card de saldo com 190 de altura e linha de movimentação mais compacta, ajustados no aparelho
- App organizado com uma pasta por tela em `presentation/`

### Corrigido — Semana 6
- F-20: cursor do extrato com data impossível respondia 500; agora 422
- F-21: o Desbloqueio não contava o tempo com o aparelho dormindo
- F-22: a verificação de dinheiro do app recusava toda resposta de Pix e de extrato, porque o `Money` vem sob o nome `amount`; os testes de repositório passam a usar os interceptors do app
- F-23: depois de um Pix, a Home mostrava o saldo de antes
- O comprovante mostrava um Pix concluído como "Processando"; a lista do extrato não pedia a página seguinte quando a primeira cabia na tela; títulos e valores da linha de movimentação quebravam ou estouravam em telas estreitas; o leitor de tela não anunciava o saldo oculto nem conseguia digitar o valor do Pix

### Adicionado — Semana 5: Pix (backend)
- Schema `payments`: chaves Pix com o valor cifrado e uma conta por chave; Pix com status coerente com as datas, o motivo de falha e o ID E2E no formato do Bacen; registros de idempotência por cliente e chave, válidos por 24 h. A API só altera o estado de um Pix, nunca o que foi pedido
- Chave Pix CPF criada no cadastro, na mesma transação do usuário, da conta e do saldo de demonstração; o valor é gravado cifrado e encontrado pelo índice cego
- Verificação do PIN para o Desbloqueio (`POST /v1/me/pin/verify`): o mesmo contador de tentativas do Pix, com a linha travada contra palpites paralelos; a resposta de erro passa a informar as tentativas restantes
- Consulta de chave Pix (`POST /v1/pix/key-lookups`): o recebedor com o nome completo e o CPF mascarado; 30 consultas por hora por cliente, chave inexistente conta em dobro
- Criação do Pix (`POST /v1/pix/transfers`) com `Idempotency-Key` obrigatória: conta ativa, chave, limite pelo relógio do servidor e saldo conferidos antes; a mesma requisição repetida recebe a mesma resposta e cria um Pix só, mesmo em paralelo
- Autorização com o PIN conferido no servidor (`POST /v1/pix/transfers/{id}/authorize`), numa transação com as travas em ordem fixa: o dinheiro se move uma vez, com um lançamento `PIX_INTERNAL` e a contraparte de cada lado para o extrato; PIN errado mantém o Pix aguardando, PIN bloqueado e Pix expirado o cancelam; saldo, limite e contas indisponíveis resultam num Pix `FAILED` com o motivo
- Comprovante (`GET /v1/pix/transfers/{id}`) e cancelamento (`POST .../cancel`): o ID vai no caminho, mas só o pagador encontra o Pix; os demais recebem o mesmo 404
- Limites por Pix: R$ 5.000,00 das 6h às 20h e R$ 1.000,00 das 20h às 6h, no fuso de São Paulo, conferidos na criação e de novo na autorização
- Integridade financeira provada pelo Pix contra o Postgres: o mesmo saldo é gasto uma vez (T-DB-08), Pix em direções opostas não travam (T-DB-09) e, depois de 1.000 Pix aleatórios, todo saldo bate com a soma das partidas e o dinheiro se conserva (T-DB-14)
- ADR 0011: BFF fora da V1, com a revisão marcada para o desenho do backoffice

### Corrigido — Semana 5
- Testes de PIN fora dos logs procuravam os 4 dígitos soltos e falhavam quando eles apareciam por acaso num tempo de resposta; agora procuram o PIN como valor JSON, como um vazamento real apareceria

### Adicionado — Semana 4: Accounts + Ledger
- Schemas `accounts` e `ledger`: conta única por cliente, numerada por sequência; ledger de partidas dobradas que o próprio banco protege (saldo de cliente nunca negativo, lançamento sempre balanceado no `COMMIT`, inclusive sem partidas, mesma referência nunca lançada duas vezes, histórico imutável até para o dono das tabelas) e `system:funding` sem saldo materializado; a API só altera status de conta e saldos
- Perfil do cliente (`GET /v1/me`): nome e se o PIN já foi criado, para o app retomar o cadastro interrompido antes do PIN; só esses dois campos saem da API, o usuário vem sempre do token e qualquer parâmetro é recusado; contrato OpenAPI e cliente Dart atualizados
- App: conta sem PIN sempre retoma o cadastro em "Criar PIN", seja na restauração da sessão, no login ou no cadastro; o perfil é lido uma vez por login, só em memória, e sem conexão a Splash oferece "Tentar de novo"
- Domínio de Accounts e Ledger: `Money` em centavos inteiros (`bigint`, recusando virar número JSON inexato), número de conta sequencial com dígito verificador módulo 11, conta contábil de cliente que nunca fica negativa (`InsufficientFunds`), conta de sistema sem saldo materializado e lançamento com pelo menos duas partidas positivas e Σ débitos = Σ créditos
- Lançamentos no ledger (`PostJournalEntry`): contas de cliente travadas sempre em ordem de ID e contas de sistema nunca travadas; saldo conferido antes de qualquer escrita; provado contra o Postgres que dois débitos de R$ 80 sobre R$ 100 gastam o saldo uma vez (T-DB-08) e que transferências opostas simultâneas não travam (T-DB-09); abertura, funding único e leitura de saldo da conta contábil do cliente
- Cadastro abre a conta corrente (número da sequência com dígito verificador, conta contábil aberta pela porta do Ledger, `ACCOUNT_OPENED` na auditoria) e deposita R$ 10.000,00 de demonstração, tudo na mesma transação do usuário; 20 cadastros simultâneos nunca repetem número de conta
- Conta do cliente (`GET /v1/me/account`): agência, número, status e saldo disponível em centavos inteiros; a conta vem sempre do token, qualquer parâmetro é recusado e nenhuma rota aceita ID de recurso no caminho (READ-01, nova ameaça READ-05); erro `NotFound` do catálogo; contrato OpenAPI e cliente Dart atualizados
- `design_system`: `MoneyText` (centavos inteiros formatados como reais, o único lugar onde dinheiro é formatado, e oculto sem nenhum dígito), `BalanceCard` (seda em gradientes, painel de vidro, conta mascarada e olho para ocultar o saldo, com AA mesmo sobre o brilho Menta), `IconCircleButton`, `Skeleton` e `ErrorState`
- App: Home com saudação pela hora e pelo nome, card de saldo com a conta mascarada nos quatro últimos dígitos e o saldo disponível de `GET /v1/me/account`; carregamento, saldo oculto só em memória (MOB-05) e erro com "Tentar de novo"; o "Sair" vai para o cabeçalho e a checagem de status da API da semana 2 sai do app

### Corrigido
- Leitor de tela: seis componentes do `design_system` se fundiam com os textos vizinhos dentro de listas (o "Entrar" do login era anunciado junto com o texto ao lado, um bloco inteiro virava título); cada um agora tem o próprio nó de semântica (F-17)
- Card de saldo e brilho da tela fiéis ao mockup da Home: gradientes com a geometria exata do CSS e granulado que esconde as faixas que o Impeller desenhava nos degradês (F-19); o saldo oculto mostra a máscara na Manrope, que tem o ponto, e o "R$" não se mexe ao tocar no olho
- App: o cliente gerado truncaria em silêncio um valor com fração (10,5 viraria 10 centavos); toda resposta com `amount` que não seja inteiro agora é recusada antes da leitura (F-18)

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
