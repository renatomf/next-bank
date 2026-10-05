# 0002 — Monólito modular com DDD e arquitetura hexagonal

- **Status:** Aceito
- **Data:** 2026-10-05

## Contexto

O domínio tem regras financeiras críticas (ledger, Pix, idempotência) que precisam ser testáveis sem infraestrutura e protegidas de acoplamento acidental. Ao mesmo tempo, o projeto é mantido por uma pessoa e precisa de deploy e operação simples. Bancos digitais em escala usam microsserviços, mas esse modelo resolve problemas de escala e de organização (muitos times) que a V1 não tem.

## Opções consideradas

1. **Microsserviços desde o início** — escala e deploy independentes; mas exige mensageria, observabilidade distribuída, consistência eventual e muito mais infraestrutura, com custo operacional alto para um time de uma pessoa.
2. **Monólito em camadas tradicional** (controllers → services → repositories) — simples de começar; mas regras de negócio tendem a vazar para controllers e para o ORM, e os módulos se acoplam com o tempo.
3. **Monólito modular com DDD e arquitetura hexagonal** — um único deploy, com módulos por bounded context, domínio puro no centro e infraestrutura nas bordas, atrás de portas.

## Decisão

**Opção 3.** Cada bounded context (Identity, Accounts, Ledger, Payments, Audit) é um módulo com `domain/`, `application/`, `infrastructure/` e `http/`, exposto só pelo seu `index.ts`. As fronteiras são verificadas por dependency-cruiser no CI: o domínio não importa framework, e um módulo não acessa as entranhas de outro. Cada contexto tem seu schema no Postgres, sem chave estrangeira entre schemas.

## Consequências

- ➕ Domínio testável em milissegundos, sem banco nem HTTP
- ➕ Transações ACID entre contextos (mesmo banco), essenciais para débito + crédito + auditoria
- ➕ Caminho claro para extrair um contexto como serviço no futuro (portas já definidas, dados já separados por schema)
- ➖ Mais arquivos e mais cerimônia que um CRUD simples (portas, adaptadores, mappers)
- ➖ Exige disciplina; sem a verificação no CI, as fronteiras se degradam
- ➖ Um único deploy: uma falha grave derruba todos os módulos; um módulo não escala sozinho

## Referências

- `docs/architecture/domain-model.md` (contextos e agregados)
- `docs/architecture/database.md` (um schema por contexto)
