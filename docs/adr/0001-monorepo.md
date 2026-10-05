# 0001 — Monorepo com pnpm workspaces, Turborepo e pub workspaces

- **Status:** Aceito
- **Data:** 2026-10-05

## Contexto

O next bank tem quatro aplicações (app Flutter, API, simulador do Bacen, backoffice Next.js) e pacotes compartilhados (contratos da API, Design System). O contrato entre API e clientes muda junto com as features; se API e app ficarem em repositórios separados, uma mudança de contrato vira duas PRs coordenadas e o risco de dessincronia cresce.

No lado TypeScript, há dependências de build entre pacotes (os contratos precisam ser gerados antes da API e do backoffice) e quatro pacotes cujo lint, typecheck e testes podem rodar em paralelo e ser reaproveitados quando nada mudou.

## Opções consideradas

1. **Um repositório por aplicação** — isolamento total e CI simples por repo; mas mudanças de contrato exigem PRs coordenadas, versionamento de pacotes e publicação em registry.
2. **Monorepo com Nx** — grafo de dependências, cache e geradores de código; mas é uma ferramenta grande, com convenções próprias e suporte limitado ao Dart.
3. **Monorepo só com pnpm workspaces e pub workspaces** — ferramentas nativas, sem nada extra; mas a ordem das tarefas entre pacotes TypeScript fica em scripts manuais, sem cache nem execução apenas do que mudou.
4. **pnpm workspaces + Turborepo (TypeScript) + pub workspaces (Dart)** — Turborepo é um executor de tarefas leve sobre o pnpm: entende a ordem entre pacotes, faz cache e roda só o que foi afetado.

## Decisão

**Opção 4.**

- **TypeScript** (`api`, `bacen-sim`, `backoffice`, `contracts`): pnpm workspaces + Turborepo, com o pipeline declarado em `turbo.json` (`generate` → `build` → `lint`/`typecheck`/`test`).
- **Dart/Flutter** (`mobile`, `design_system`): pub workspaces, nativo do Dart 3. **O Turborepo não orquestra o Flutter:** isso exigiria um `package.json` artificial dentro do projeto Dart só para chamar comandos `flutter`. Cada ecossistema fica com sua ferramenta nativa.
- **CI:** filtros de caminho decidem quais fluxos rodam (TypeScript, Flutter ou ambos); no lado TypeScript, `turbo run … --filter=...[origin/main]` executa só os pacotes afetados pela PR.
- **Cache entre execuções do CI:** o diretório `.turbo` é guardado pelo cache do próprio GitHub Actions. O cache remoto da Vercel foi descartado: exigiria um fornecedor e um segredo a mais no CI, e o ganho extra (compartilhar cache com a máquina local) não compensa num time de uma pessoa.

## Consequências

- ➕ Mudança de contrato, API e app numa única PR, revisada e testada junto
- ➕ Ordem de build entre pacotes TypeScript declarada, não escrita à mão em scripts
- ➕ Cache e execução apenas do que mudou reduzem o tempo de CI conforme o projeto cresce
- ➕ Ferramenta padrão do ecossistema Next.js, coerente com o backoffice
- ➕ Cache sem fornecedor nem segredo extra (fica no GitHub Actions)
- ➖ Duas cadeias de ferramentas (Node e Flutter) e duas formas de orquestrar no mesmo repositório
- ➖ Uma dependência a mais (`turbo`) e um arquivo de configuração para manter
- ➖ Permissões são do repositório inteiro, não por aplicação

## Referências

- Spec, seção 5 (estrutura do monorepo)
