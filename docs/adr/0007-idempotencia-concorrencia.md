# 0007 — Idempotência e controle de concorrência

- **Status:** Aceito
- **Data:** 2026-10-05

## Contexto

Redes móveis falham: uma requisição de Pix pode chegar ao servidor e a resposta se perder, levando o app a repetir o pedido. Ao mesmo tempo, duas requisições simultâneas podem tentar gastar o mesmo saldo. Nos dois casos, o resultado errado é perda de dinheiro.

## Opções consideradas

**Repetição de requisições**
1. **Deduplicação só no app** — o app evita reenviar; mas não protege contra falhas de rede depois que o servidor processou.
2. **Chave de idempotência no servidor** — o cliente envia um UUID por operação; o servidor garante que a mesma chave produz um único efeito e devolve a mesma resposta.

**Concorrência sobre o saldo**
1. **Isolamento `SERIALIZABLE`** — o banco detecta conflitos; mas as transações perdedoras precisam ser repetidas por inteiro, o que complica operações com efeitos auditados.
2. **Lock otimista (versão)** — sem bloqueio; mas sob disputa gera muitas falhas e repetições.
3. **`READ COMMITTED` com locks explícitos (`SELECT … FOR UPDATE`) em ordem determinística**, mais `CHECK` no banco como última barreira.

## Decisão

**Chave de idempotência no servidor + locks explícitos ordenados.**

- Header `Idempotency-Key` (UUID) obrigatório em comandos financeiros; escopo **(usuário, chave)**; validade de **24 h**; hash do payload guardado.
- Mesma chave e mesmo payload → devolve a resposta original. Mesma chave e payload diferente → `422`. Requisição ainda em andamento → `409`.
- **Segunda camada:** `UNIQUE (reference_type, reference_id, kind)` no ledger impede dois lançamentos para o mesmo Pix, independentemente da chave do cliente.
- Contas de cliente travadas com `FOR UPDATE` **sempre em ordem de ID**, evitando deadlock entre transferências opostas (A→B e B→A).
- `CHECK (available_balance >= 0)` no banco como barreira final.
- Erros de negócio também são gravados (tentativas de PIN, status `FAILED`, resposta idempotente); só falhas técnicas desfazem a transação.

## Consequências

- ➕ Repetir uma requisição é sempre seguro, para o app e para qualquer cliente da API
- ➕ Gasto duplo impossível mesmo com bug na aplicação (barreira no banco)
- ➕ Comportamento previsível e testável (T-DB-05, T-DB-06, T-DB-08, T-DB-09)
- ➖ Uma tabela a mais, com escrita em toda operação financeira e job de limpeza
- ➖ Locks serializam operações sobre a mesma conta (aceitável: um cliente raramente faz Pix simultâneos)
- ➖ O cliente da API precisa gerar e reaproveitar a chave corretamente nas novas tentativas

## Referências

- `docs/architecture/database.md` (seção 7, concorrência)
- `docs/security/threat-model.md` (PIX-02, PIX-03)
