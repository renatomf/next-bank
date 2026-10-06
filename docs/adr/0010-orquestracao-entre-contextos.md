# 0010 — Orquestração entre contextos e transação compartilhada

- **Status:** Aceito
- **Data:** 2026-10-06

## Contexto

O cadastro (`domain-model.md`, seção 8) é um único caso de uso que atravessa quatro contextos numa só transação: cria o usuário (Identity), abre a conta (Accounts), grava o lançamento inicial (Ledger) e cria a chave Pix CPF (Payments), com auditoria (Audit). Ou tudo acontece, ou nada.

Na semana 3, o `RegisterCustomer` nasceu **dentro do Identity**, com uma unidade de trabalho que só conhece os repositórios do Identity (`IdentityUnitOfWork`). Isso funciona enquanto o cadastro só cria usuário e sessão, mas não escala para a semana 4:

- O Identity não pode importar o interior de Accounts, Ledger e Payments: a regra `modules-talk-through-public-api` do dependency-cruiser barra, e com razão (ADR 0002).
- Se o Identity orquestrasse os outros, o contexto mais sensível do sistema passaria a depender de todos, e os outros acabariam dependendo dele: um ciclo.
- Uma transação por módulo não garante o "tudo ou nada" entre módulos.

O Pix tem uma situação diferente: o fluxo **pertence** ao Payments, que já chama o Ledger por uma porta que ele mesmo define (mapa de contextos, `domain-model.md`, seção 2). O que falta ali é só a transação compartilhada.

## Opções consideradas

1. **O Identity orquestra o cadastro.** Simples hoje; mas o Identity passa a depender de Accounts, Ledger e Payments, as regras de fronteira precisam de exceções e o contexto de autenticação vira o centro do sistema.
2. **Eventos de domínio com consistência eventual** (Identity publica `UserRegistered`; os outros reagem, via outbox). Desacopla os módulos; mas o cadastro deixa de ser atômico (usuário sem conta por um tempo, ou para sempre se um consumidor falhar), exige outbox, reprocessamento e compensação. Desproporcional para a V1, em que tudo roda no mesmo processo e no mesmo banco.
3. **Juntar os contextos num módulo só.** Acaba com o problema de transação, mas também com as fronteiras do ADR 0002.
4. **Camada de aplicação acima dos módulos + unidade de trabalho compartilhada.** Casos de uso que não pertencem a um contexto ficam numa camada própria, que só chama cada módulo pela API pública; todos os módulos trabalham sobre a mesma transação.

## Decisão

**Opção 4**, com três regras.

**1. Quem é dono do fluxo orquestra.**
- Fluxo que pertence a um contexto fica nele, e o contexto chama os outros por portas que ele mesmo define (como já previsto: Payments → Ledger no Pix).
- Fluxo que **não pertence a nenhum contexto** fica em `apps/api/src/application/<fluxo>/` (ex.: `application/onboarding/register-customer.ts`). Essa camada **só sequencia** chamadas: regra de negócio continua nos módulos. Se aparecer um `if` de regra de negócio no orquestrador, ele está no lugar errado.

**2. Uma unidade de trabalho para todos os módulos.**
- `shared/application` define a porta `UnitOfWork`, que entrega um `Transaction` opaco ao trabalho.
- Cada módulo expõe, pelo `index.ts`, operações que recebem esse `Transaction` (ex.: `identity.registerUser(tx, …)`, `accounts.openAccount(tx, …)`). Por dentro, o módulo monta os próprios repositórios sobre a mesma conexão; quem chama não vê SQL nem repositórios alheios.
- A implementação Postgres (`withTransaction`, já existente) é a única: um `BEGIN`, um `COMMIT`.
- A raiz de composição (`app.ts`) liga as implementações, como hoje.

**3. Falha de negócio não é rollback.** A unidade de trabalho desfaz tudo em qualquer exceção. Por isso, operações que precisam **gravar uma falha** (tentativa de PIN, Pix `FAILED`, `LOGIN_FAILED`) devolvem o resultado como valor, e o erro é lançado depois do commit (`domain-model.md`, seção 2). Os agregados já foram desenhados assim (`Session.refresh`, `TransactionPin.recordVerification`).

**Regras verificadas no CI (dependency-cruiser):**
- `src/application/` só importa `modules/*/index.ts`, `shared/domain` e `shared/application`.
- Nenhum módulo importa `src/application/`.
- As regras atuais dos módulos continuam valendo.

**Migração:** no PR da rota de cadastro, o `RegisterCustomer` vai para `application/onboarding/`; o Identity passa a expor `registerUser(tx, …)` (usuário, sessão, hash do refresh token e auditoria), e o `IdentityUnitOfWork` dá lugar à `UnitOfWork` compartilhada. Os testes atuais migram junto.

## Consequências

- ➕ O cadastro continua atômico, agora entre módulos, sem outbox nem compensação
- ➕ Nenhum contexto depende de outro além do que o mapa de contextos já prevê; sem ciclos
- ➕ Cada módulo continua testável sozinho, com uma transação real ou falsa
- ➕ Caminho de evolução claro: se um módulo for extraído (Fase futura), a chamada direta vira evento + outbox só naquele ponto
- ➖ Uma camada a mais para entender, e o risco de ela engordar com regra de negócio (mitigação: a regra "só sequencia", conferida em revisão)
- ➖ Módulos acoplados ao mesmo banco e à mesma transação: aceito no monólito modular, mas extrair um módulo exigirá saga ou outbox
- ➖ O `Transaction` opaco precisa ser convertido para a conexão `pg` dentro da infraestrutura de cada módulo (um ponto de conversão por módulo, coberto pelos testes de integração)
- ➖ Transações mais longas no cadastro (vários módulos na mesma conexão); mitigado pelos timeouts do papel da aplicação (API-12)

## Referências

- ADR 0002 (monólito modular, DDD e hexagonal), ADR 0007 (idempotência e concorrência), ADR 0009 (SQL puro)
- `docs/architecture/domain-model.md` (seções 2 e 8)
- `docs/architecture/database.md` (seção 1: sem chave estrangeira entre schemas; integridade pela Unit of Work)
