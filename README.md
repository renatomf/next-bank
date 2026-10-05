# next bank

**Um banco digital simulado, construído com práticas de engenharia de um banco real.**

> ⚠️ **Projeto fictício de portfólio.** Não tem relação com o banco digital *next* (Bradesco) nem com qualquer instituição financeira. Nenhuma transação movimenta dinheiro real, e todos os dados usados são fictícios.

> 🚧 **Status: em construção** — semana 1 de 8 da V1 (arquitetura e segurança).

## O que é

Uma plataforma bancária full stack que simula o essencial de um banco digital brasileiro: conta, saldo, Pix e extrato. O foco não é a quantidade de funcionalidades, e sim a qualidade da engenharia por trás delas:

- **Integridade financeira:** ledger de partidas dobradas que só aceita inclusões, idempotência em toda operação financeira e controle de concorrência que impede saldo negativo.
- **Segurança desde o projeto:** threat model, OWASP ASVS L2 e MASVS como referência, PIN de transação validado no servidor, rotação de tokens com detecção de reuso.
- **Arquitetura:** DDD, arquitetura hexagonal e monólito modular, com fronteiras verificadas no CI.
- **Qualidade:** TDD no domínio, testes de integração contra Postgres real, testes de segurança e de concorrência, gates de segurança no CI.

## Stack planejada

| Camada | Tecnologias |
|---|---|
| Mobile | Flutter, Riverpod, GoRouter, Dio, Freezed |
| API | Node.js, TypeScript, Fastify, Zod, Drizzle, PostgreSQL |
| Backoffice (Fase 3) | Next.js, TypeScript |
| Infra | Docker, GitHub Actions, Sentry |

## Roadmap

| Fase | Entrega |
|---|---|
| **1 — V1 Core** | Cadastro, login, conta, ledger, Pix interno, extrato, testes, CI e deploy |
| **2 — Pix assíncrono** | Simulador do Bacen com falhas injetadas, conta transitória e conciliação |
| **3 — Backoffice** | Painel interno com perfis de acesso e dupla aprovação |

## Documentação

- [Roadmap e design de arquitetura](docs/superpowers/specs/2026-10-05-next-bank-roadmap-design.md)
- [Modelo de domínio](docs/architecture/domain-model.md)
- [Brief visual e design tokens](docs/design/brief.md)
- [Plano da semana atual](docs/superpowers/plans/2026-10-05-semana-1-arquitetura-seguranca.md)

Threat model, ADRs e diagramas de arquitetura serão publicados ao longo da semana 1.

## Autor

Renato Marques — [github.com/renatomf](https://github.com/renatomf)
