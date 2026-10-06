# 0009 — Acesso a dados com SQL puro tipado (sem ORM)

- **Status:** Aceito
- **Data:** 2026-10-05

## Contexto

O acesso a dados do next bank não é CRUD comum. O caso mais crítico, postar um lançamento no ledger, exige locks explícitos em ordem determinística (`SELECT … FOR UPDATE ORDER BY id`), constraint triggers diferidas, permissões por papel (`GRANT`), um schema por contexto e controle fino de transações. As migrations já seriam escritas e revisadas à mão em SQL (ver `database.md`). Num ledger, o SQL é o código mais crítico do sistema e precisa ser lido exatamente como roda.

## Opções consideradas

1. **Prisma** — o ORM mais popular, ótima experiência no dia a dia; mas abstrai o SQL a ponto de locks e triggers exigirem SQL puro com frequência. É o menos adequado para um ledger.
2. **Drizzle** — API próxima do SQL e boa tipagem; mas a versão 1.0 ainda está em beta, a linha 0.x muda com frequência, e o principal ganho (gerar migrations a partir do schema em TypeScript) seria pouco usado, já que as migrations críticas são escritas à mão.
3. **Kysely** — construtor de SQL estável e bem tipado; mas o SQL é montado em TypeScript, uma camada a mais entre o revisor e o que roda no banco.
4. **SQL puro tipado** — queries em SQL, executadas pelo driver `pg`, com tipos das linhas escritos à mão e verificados por testes de integração contra o banco real.

## Decisão

**Opção 4.**

- **Driver:** `pg` (node-postgres). Transações, locks e savepoints em SQL explícito.
- **Tipagem:** tipos das linhas **escritos à mão** ao lado de cada query, no formato exato que o `pg` devolve (`bigint` chega como `string`), e convertidos para o domínio no repositório. Uma query incompatível com o schema **quebra o teste de integração**, que roda no CI contra um Postgres criado do zero pelas migrations. (Decisão revista após o spike; ver "Resultado do spike".)
- **Migrations:** **dbmate**, com arquivos `.sql` puros, numerados, revisados à mão e só para frente. Executadas pelo papel `nextbank_migrator`, nunca pela API.
- **Segurança:** só parâmetros (`$1`, `$2`…), nunca concatenação; uma regra do Semgrep no CI bloqueia SQL montado com interpolação de strings (ameaça API-01).
- **Isolamento:** todo SQL fica na camada `infrastructure/` de cada módulo, atrás das portas dos repositórios. O domínio não sabe que existe SQL.

## Resultado do spike (2026-10-06)

Validado no Postgres 17 local (Docker) e no Neon (Postgres 17, `sa-east-1`), com o caso do ledger:

| Critério | Resultado |
|---|---|
| Papéis `nextbank_migrator` (dono do banco) e `nextbank_app`, sem superusuário | ✅ |
| Lançamento desbalanceado rejeitado no `COMMIT` (constraint trigger diferida) | ✅ |
| `UPDATE`, `DELETE`, `TRUNCATE` e DDL negados ao `nextbank_app` | ✅ |
| Trigger de imutabilidade barra alteração até pelo dono do schema | ✅ |
| `SELECT … ORDER BY id FOR UPDATE` | ✅ |
| dbmate aplica e reverte migrations como `nextbank_migrator` | ✅ |
| Mesmo comportamento no Neon (incluindo timeouts do papel da aplicação) | ✅ |
| pgTyped gera tipos confiáveis | ❌ |

**pgTyped descartado:**
- sem release desde março de 2025 e sem commits no código desde agosto de 2025 (o CLAUDE.md exige manutenção ativa);
- aceita só TypeScript ≤ 5: a instalação com o TypeScript atual é recusada, o que prenderia o projeto numa versão antiga;
- tipos gerados fracos: `bigint` vira `string`, centavos viram `NumberOrString`, colunas com `CHECK` viram `string` em vez de união, e o código gerado tem `any`. O mapeamento manual seria necessário de qualquer forma.

**Alternativas avaliadas:** Kysely (SQL montado em TypeScript, contra o motivo central deste ADR), Drizzle (1.0 ainda em *release candidate*), sqlc (ferramenta em Go com plugin TypeScript imaturo), Slonik (camada extra de validação em tempo de execução). Escolhidos os tipos escritos à mão: nenhuma dependência a mais, e os testes de integração contra Postgres real já são obrigatórios.

**Reavaliar quando:** a divergência entre SQL e tipos virar problema real. Primeira opção: SafeQL (plugin do ESLint que confere o SQL contra o banco), sem mudar os repositórios.

**Achados no Neon:**
- Papéis criados pelo painel ou pela API do Neon entram no `neon_superuser`, que tem `pg_write_all_data` e `BYPASSRLS`: **ignoram os `GRANT`s**. No teste, um papel assim leu o ledger e criou uma conta de cliente com saldo arbitrário sem nenhum `GRANT`; só o trigger de imutabilidade barrou a alteração de lançamentos. Por isso os papéis da aplicação são criados via SQL (API-11).
- O `REVOKE ALL ON DATABASE nextbank FROM PUBLIC` impede até o papel administrativo do Neon de se conectar ao banco da aplicação.
- No Postgres 16+, criar o banco com dono `nextbank_migrator` exige que o papel administrativo possa assumir esse papel: `GRANT … WITH SET TRUE` temporário, revogado logo depois. O bootstrap do Neon difere do local nesse passo.
- Migrations pelo host direto; a API pode usar o *pooler*. `sslmode=require` funciona; `verify-full` fica para o deploy (semana 8).

**Observação:** o `schema.sql` do dbmate exige `pg_dump`; por ora as migrations rodam com `--no-dump-schema`.

## Consequências

- ➕ O revisor lê exatamente o SQL que roda; `EXPLAIN ANALYZE` corresponde ao código
- ➕ Locks, CTEs, triggers e `GRANT`s sem contorno nem abstração no meio
- ➕ Tipos de domínio precisos (uniões, `Money`), sem código gerado nem `any`
- ➕ Só o driver `pg` e o dbmate: nenhuma dependência em beta ou sem manutenção
- ➖ Mais código de mapeamento entre linhas do banco e objetos de domínio
- ➖ Consultas dinâmicas (filtros do extrato) exigem cuidado para não concatenar SQL
- ➖ Divergência entre query e tipo aparece no teste de integração, não na compilação
- ➖ Os testes de integração dependem de um Postgres rodando no CI e em desenvolvimento
- ➖ Menos produtivo que um ORM para operações simples

## Referências

- `docs/architecture/database.md` (seções 6, 7 e 9)
- `docs/security/threat-model.md` (API-01)
- ADR 0002 (arquitetura hexagonal: repositórios isolam o acesso a dados)
