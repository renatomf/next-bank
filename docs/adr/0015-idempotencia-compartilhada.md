# 0015 — Idempotência compartilhada entre os módulos

- **Status:** Aceito
- **Data:** 2026-10-21

## Contexto

A ADR 0007 tornou idempotente todo comando financeiro: o cliente manda uma `Idempotency-Key`, e a mesma chave com a mesma requisição recebe a primeira resposta. Até a v1.1.0, só o Pix tinha comandos financeiros, e a idempotência nasceu dentro do módulo de pagamentos: o código em `modules/payments` e os registros em `payments.idempotency_records`. A recarga de celular (tarefa 5 do plano da v1.1.0) é o segundo módulo com comandos financeiros e precisa da mesma garantia. A ADR 0002 proíbe um módulo de escrever no schema de outro.

## Opções consideradas

1. **A recarga escreve em `payments.idempotency_records`.** Nenhuma mudança agora, mas um módulo passa a escrever no banco do outro, contra a ADR 0002, e cada módulo novo repetiria isso.
2. **Uma tabela por módulo**, com o código em `shared/`. Nenhum dado se move, mas a mesma estrutura, as mesmas restrições e o mesmo trabalho de limpeza se repetem a cada módulo.
3. **Código e tabela compartilhados:** o código em `shared/` e a tabela num schema comum, `platform`, que não pertence a módulo nenhum.

## Decisão

**Opção 3** (decisão do desenvolvedor, 2026-10-21). A classe `Idempotency`, as suas portas, os erros `IdempotencyKeyReused` e `RequestInProgress`, a impressão digital HMAC e o repositório Postgres vão para `apps/api/src/shared/`. Uma migração cria o schema `platform` e move a tabela com `ALTER TABLE … SET SCHEMA`, que mantém os registros, as restrições, os índices e as permissões. A coluna `operation` já separa os comandos, e o `CHECK` dela lista os conhecidos: cada módulo novo acrescenta os seus numa migração própria.

## Consequências

- ➕ Todo módulo com comando financeiro usa a mesma garantia, testada num lugar só
- ➕ Nenhum módulo escreve no schema de outro
- ➖ Um schema a mais, que não segue a regra de um schema por módulo: ele só existe para o que é de todos
- ➖ O `CHECK` de `operation` conhece os comandos de todos os módulos: cada módulo novo altera uma tabela que não é só dele
- ➖ A migração move a tabela em produção: os registros das últimas 24 horas continuam valendo, mas a troca precisa sair junto com o código que lê o schema novo

## Referências

ADR 0002 (monólito modular), ADR 0007 (idempotência e concorrência), `database.md`, seções 5.4, 6 e 7; plano da v1.1.0, tarefa 5, decisão R5.
