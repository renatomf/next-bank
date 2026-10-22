# Architecture Decision Records (ADRs)

Cada ADR registra **uma** decisão de arquitetura: o contexto, as alternativas consideradas, a escolha e as consequências, **inclusive as negativas**. ADRs não são editados depois de aceitos; uma mudança de rumo gera um novo ADR que substitui o anterior.

## Índice

| # | Decisão | Status |
|---|---|---|
| [0001](0001-monorepo.md) | Monorepo com pnpm workspaces, Turborepo e pub workspaces | Aceito |
| [0002](0002-monolito-modular-ddd-hexagonal.md) | Monólito modular com DDD e arquitetura hexagonal | Aceito |
| [0003](0003-flutter-riverpod.md) | Flutter + Riverpod no app mobile | Aceito |
| [0004](0004-autenticacao.md) | Autenticação com JWT EdDSA, refresh rotativo e PIN no servidor | Aceito |
| [0005](0005-ledger-partidas-dobradas.md) | Ledger de partidas dobradas append-only | Aceito |
| [0006](0006-value-object-money.md) | Dinheiro como inteiro em centavos (Value Object `Money`) | Aceito |
| [0007](0007-idempotencia-concorrencia.md) | Idempotência e controle de concorrência | Aceito |
| [0008](0008-contrato-unico-openapi.md) | Contrato único: Zod → OpenAPI → clientes gerados | Aceito |
| [0009](0009-sql-puro-tipado.md) | Acesso a dados com SQL puro tipado (sem ORM) | Aceito |
| [0010](0010-orquestracao-entre-contextos.md) | Orquestração entre contextos e transação compartilhada | Aceito |
| [0011](0011-bff.md) | Backend for Frontend (BFF): fora da V1, revisto no backoffice | Aceito |
| [0012](0012-hospedagem-da-v1.md) | Hospedagem da V1: Render gratuito e Neon, sem custo | Aceito |
| [0013](0013-rosto-so-para-abrir-o-app.md) | Rosto (biometria fraca) só para abrir o app | Aceito |
| [0014](0014-fronteiras-de-ui.md) | Fronteiras de UI: design system, `core/ui` e features | Aceito |
| [0015](0015-idempotencia-compartilhada.md) | Idempotência compartilhada entre os módulos | Aceito |
| [0016](0016-outbox-e-inbox.md) | Outbox transacional e inbox | Aceito |

## Template

```markdown
# NNNN — Título da decisão

- **Status:** Proposto | Aceito | Substituído por NNNN
- **Data:** AAAA-MM-DD

## Contexto
Qual problema precisa ser resolvido e quais forças estão em jogo.

## Opções consideradas
1. Opção A — prós e contras
2. Opção B — prós e contras

## Decisão
O que foi escolhido e por quê.

## Consequências
- ➕ Positivas
- ➖ Negativas (obrigatório: toda decisão tem custo)

## Referências
Documentos relacionados.
```
