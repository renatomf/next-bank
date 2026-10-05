# next bank

🇧🇷 Português · [🇺🇸 English](README.en.md)

### Seu dinheiro, um passo à frente.

<p align="center">
  <img src="docs/design/mockups/home-dark.png" width="230" alt="Tela inicial com saldo e últimas movimentações">
  <img src="docs/design/mockups/pix-dark.png" width="230" alt="Tela de envio de Pix">
  <img src="docs/design/mockups/comprovante-dark.png" width="230" alt="Comprovante de Pix">
</p>
<p align="center"><sub>Conceito visual da V1 — as telas finais são construídas em Flutter.</sub></p>

O **next bank** é um banco digital pensado para quem quer controle total do próprio dinheiro, sem filas, sem letras miúdas e sem surpresas.

Abra sua conta em minutos, acompanhe cada centavo em tempo real e envie Pix com a tranquilidade de saber que **cada operação é registrada, conferida e protegida** do primeiro toque até o comprovante.

## Por que next bank

- **⚡ Pix na hora, sem duplicidade.** Caiu a internet no meio do envio? Tente de novo sem medo: o seu Pix é processado uma única vez.
- **🔒 Segurança em cada camada.** PIN de transação validado no servidor, bloqueio automático contra tentativas suspeitas e sessões protegidas contra roubo de credenciais.
- **📊 Cada centavo no lugar certo.** Saldo e extrato vêm de um livro-razão que nunca é editado, só acrescentado. O que aparece no app sempre fecha com a conta.
- **✨ Simples por fora, sólido por dentro.** Uma experiência leve e escura, com o brilho da cor Paraíba, sobre uma engenharia construída para não falhar.

> 🚧 **Em construção:** semana 1 de 8 da primeira versão.

---

## Por dentro da engenharia

O next bank é construído com as práticas de um banco em produção:

- **Integridade financeira:** ledger de partidas dobradas, idempotência em toda operação financeira e controle de concorrência que impede saldo negativo.
- **Segurança desde o projeto:** threat model, OWASP ASVS L2 e MASVS como referência, rotação de tokens com detecção de reuso e proteção de dados pessoais (LGPD).
- **Arquitetura:** DDD, arquitetura hexagonal e monólito modular, com fronteiras verificadas automaticamente.
- **Qualidade:** TDD, testes de integração contra banco real, testes de segurança e de concorrência, e gates de segurança no CI.

### Stack

| Camada | Tecnologias |
|---|---|
| Mobile | Flutter, Riverpod, GoRouter, Dio, Freezed |
| API | Node.js, TypeScript, Fastify, Zod, Drizzle, PostgreSQL |
| Backoffice | Next.js, TypeScript |
| Infra | Docker, GitHub Actions, Turborepo, Sentry |

### Roadmap

| Fase | Entrega |
|---|---|
| **1 — Core** | Cadastro, login, conta, ledger, Pix, extrato, testes, CI e deploy |
| **2 — Pix assíncrono** | Integração com um simulador do sistema de pagamentos, com falhas injetadas e conciliação |
| **3 — Backoffice** | Painel interno com perfis de acesso e dupla aprovação |

### Documentação

- [Evolução do projeto](docs/evolucao.md): como chegamos aqui e para onde a arquitetura vai
- [Roadmap e design de arquitetura](docs/roadmap.md)
- [Decisões de arquitetura (ADRs)](docs/adr/README.md)
- [Modelo de domínio](docs/architecture/domain-model.md)
- [Banco de dados](docs/architecture/database.md)
- [Diagramas C4](docs/architecture/c4.md) e [diagramas de sequência](docs/architecture/sequences.md)
- [Threat model](docs/security/threat-model.md) e [checklist OWASP ASVS/MASVS](docs/security/checklist-asvs-masvs.md)
- [Brief visual e design tokens](docs/design/brief.md)
- [Plano da semana atual](docs/plans/semana-01-arquitetura-seguranca.md)
- [Changelog](CHANGELOG.md)

---

Feito por **Renato Marques** · [github.com/renatomf](https://github.com/renatomf)

<sub>Projeto de portfólio com fins de estudo e demonstração. Não é uma instituição financeira, não movimenta dinheiro real e utiliza apenas dados fictícios. Veja a [LICENSE](LICENSE).</sub>
