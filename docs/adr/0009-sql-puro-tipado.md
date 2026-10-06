# 0009 — Acesso a dados com SQL puro tipado (sem ORM)

- **Status:** Aceito
- **Data:** 2026-10-05

## Contexto

O acesso a dados do next bank não é CRUD comum. O caso mais crítico, postar um lançamento no ledger, exige locks explícitos em ordem determinística (`SELECT … FOR UPDATE ORDER BY id`), constraint triggers diferidas, permissões por papel (`GRANT`), um schema por contexto e controle fino de transações. As migrations já seriam escritas e revisadas à mão em SQL (ver `database.md`). Num ledger, o SQL é o código mais crítico do sistema e precisa ser lido exatamente como roda.

## Opções consideradas

1. **Prisma** — o ORM mais popular, ótima experiência no dia a dia; mas abstrai o SQL a ponto de locks e triggers exigirem SQL puro com frequência. É o menos adequado para um ledger.
2. **Drizzle** — API próxima do SQL e boa tipagem; mas a versão 1.0 ainda está em beta, a linha 0.x muda com frequência, e o principal ganho (gerar migrations a partir do schema em TypeScript) seria pouco usado, já que as migrations críticas são escritas à mão.
3. **Kysely** — construtor de SQL estável e bem tipado; mas o SQL é montado em TypeScript, uma camada a mais entre o revisor e o que roda no banco.
4. **SQL puro tipado** — queries em SQL, executadas pelo driver `pg`, com tipos gerados a partir do banco real.

## Decisão

**Opção 4.**

- **Driver:** `pg` (node-postgres). Transações, locks e savepoints em SQL explícito.
- **Tipagem:** **pgTyped**. Lê as queries e o schema do banco real e gera os tipos TypeScript de parâmetros e resultados. Uma query incompatível com o schema **quebra o build**. No CI, a geração roda contra um Postgres criado do zero pelas migrations.
- **Migrations:** **dbmate**, com arquivos `.sql` puros, numerados, revisados à mão e só para frente. Executadas pelo papel `nextbank_migrator`, nunca pela API.
- **Segurança:** só parâmetros (`$1`, `$2`…), nunca concatenação; uma regra do Semgrep no CI bloqueia SQL montado com interpolação de strings (ameaça API-01).
- **Isolamento:** todo SQL fica na camada `infrastructure/` de cada módulo, atrás das portas dos repositórios. O domínio não sabe que existe SQL.

Um spike curto no início da semana 2 valida a cadeia de ferramentas (pgTyped + dbmate + Neon) com o caso do ledger. Se pgTyped não atender, o plano B é **Kysely**, trocando só a camada de infraestrutura.

## Consequências

- ➕ O revisor lê exatamente o SQL que roda; `EXPLAIN ANALYZE` corresponde ao código
- ➕ Locks, CTEs, triggers e `GRANT`s sem contorno nem abstração no meio
- ➕ Tipagem vinda do banco real, não de uma descrição paralela do schema
- ➕ Menos dependências e nenhuma em beta (menor superfície de cadeia de suprimentos)
- ➖ Mais código de mapeamento entre linhas do banco e objetos de domínio
- ➖ Consultas dinâmicas (filtros do extrato) exigem cuidado para não concatenar SQL
- ➖ A geração de tipos depende de um banco rodando no CI e em desenvolvimento
- ➖ Menos produtivo que um ORM para operações simples

## Referências

- `docs/architecture/database.md` (seções 6, 7 e 9)
- `docs/security/threat-model.md` (API-01)
- ADR 0002 (arquitetura hexagonal: repositórios isolam o acesso a dados)
