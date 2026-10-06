# next bank

[🇧🇷 Português](README.md) · 🇺🇸 English

### Your money, one step ahead.

<p align="center">
  <img src="docs/design/mockups/home-dark.png" width="230" alt="Home screen with balance and recent transactions">
  <img src="docs/design/mockups/pix-dark.png" width="230" alt="Pix transfer screen">
  <img src="docs/design/mockups/comprovante-dark.png" width="230" alt="Pix receipt">
</p>
<p align="center"><sub>V1 visual concept — the final screens are built in Flutter.</sub></p>

**next bank** is a digital bank for people who want full control of their money: no queues, no fine print, no surprises.

Open an account in minutes, track every cent in real time and send Pix (Brazil's instant payment system) knowing that **every operation is recorded, reconciled and protected**, from the first tap to the receipt.

## Why next bank

- **⚡ Instant Pix, never duplicated.** Lost connection mid-transfer? Just retry: your Pix is processed exactly once.
- **🔒 Security in every layer.** Server-side transaction PIN, automatic lockout against suspicious attempts and sessions protected against credential theft.
- **📊 Every cent in the right place.** Balance and statement come from an append-only ledger. What the app shows always adds up.
- **✨ Simple outside, solid inside.** A light, dark-themed experience over engineering built not to fail.

> 🚧 **Work in progress:** week 1 of 8 of the first version.

---

## Under the hood

next bank is built with the practices of a production bank:

- **Financial integrity:** double-entry ledger, idempotency on every financial operation and concurrency control that prevents negative balances.
- **Security by design:** STRIDE threat model, OWASP ASVS L2 and MASVS as baselines, refresh-token rotation with reuse detection and protection of personal data (Brazil's LGPD).
- **Architecture:** DDD, hexagonal architecture and a modular monolith, with module boundaries enforced automatically.
- **Quality:** TDD, integration tests against a real database, security and concurrency tests, and security gates in CI.

### Stack

| Layer | Technologies |
|---|---|
| Mobile | Flutter, Riverpod, GoRouter, Dio, Freezed |
| API | Node.js, TypeScript, Fastify, Zod, PostgreSQL (plain SQL with `pg` and dbmate) |
| Back office | Next.js, TypeScript |
| Infra | Docker, GitHub Actions, Turborepo, Sentry |

### Roadmap

| Phase | Delivery |
|---|---|
| **1 — Core** | Sign-up, login, account, ledger, Pix, statement, tests, CI and deploy |
| **2 — Async Pix** | Integration with a simulated central-bank payment system, with injected failures and reconciliation |
| **3 — Back office** | Internal admin panel with role-based access and four-eyes approval |

### Documentation

The detailed documentation is written in Portuguese:

- [Project evolution](docs/evolucao.md)
- [Roadmap and architecture design](docs/roadmap.md)
- [Architecture Decision Records](docs/adr/README.md)
- [Domain model](docs/architecture/domain-model.md) · [Database design](docs/architecture/database.md)
- [C4 diagrams](docs/architecture/c4.md) · [Sequence diagrams](docs/architecture/sequences.md)
- [Threat model](docs/security/threat-model.md) · [OWASP ASVS/MASVS checklist](docs/security/checklist-asvs-masvs.md)
- [Visual brief and design tokens](docs/design/brief.md)
- [Changelog](CHANGELOG.md)

---

Built by **Renato Marques** · [github.com/renatomf](https://github.com/renatomf)

<sub>Portfolio project for study and demonstration purposes. It is not a financial institution, does not move real money and uses only fictitious data. See [LICENSE](LICENSE).</sub>
