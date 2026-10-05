# 0001 — Monorepo com pnpm workspaces e pub workspaces

- **Status:** Aceito
- **Data:** 2026-10-05

## Contexto

O next bank tem quatro aplicações (app Flutter, API, simulador do Bacen, backoffice Next.js) e pacotes compartilhados (contratos da API, Design System). O contrato entre API e clientes muda junto com as features; se API e app ficarem em repositórios separados, uma mudança de contrato vira duas PRs coordenadas e o risco de dessincronia cresce.

## Opções consideradas

1. **Um repositório por aplicação** — isolamento total e CI simples por repo; mas mudanças de contrato exigem PRs coordenadas, versionamento de pacotes e publicação em registry.
2. **Monorepo com Nx ou Turborepo** — cache de build e grafo de dependências avançados; mas adiciona uma ferramenta pesada e com suporte limitado ao Dart.
3. **Monorepo com pnpm workspaces (TypeScript) + pub workspaces (Dart)** — usa só as ferramentas nativas de cada ecossistema.

## Decisão

**Opção 3.** Um único repositório com `apps/` e `packages/`, gerenciado por pnpm workspaces no lado TypeScript e por pub workspaces (nativo do Dart 3) no lado Flutter, sem ferramenta de orquestração extra. O CI usa filtros de caminho para rodar só o que mudou.

## Consequências

- ➕ Mudança de contrato, API e app numa única PR, revisada e testada junto
- ➕ Uma única fonte de verdade para documentação, ADRs e CI
- ➕ Sem ferramenta extra para aprender e manter
- ➖ Duas cadeias de ferramentas (Node e Flutter) no mesmo repositório e no mesmo CI
- ➖ Sem cache de build distribuído; o CI pode ficar mais lento conforme o projeto cresce (mitigação: filtros de caminho; reavaliar Turborepo se o tempo de CI passar de ~10 min)
- ➖ Permissões são do repositório inteiro, não por aplicação

## Referências

- Spec, seção 5 (estrutura do monorepo)
