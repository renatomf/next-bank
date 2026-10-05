# 0005 — Ledger de partidas dobradas append-only

- **Status:** Aceito
- **Data:** 2026-10-05

## Contexto

O saldo do cliente é o dado mais importante do sistema. Ele precisa ser correto sob concorrência, explicável (de onde veio cada centavo) e auditável. Também precisa suportar, no futuro, Pix externo assíncrono (conta transitória) e cartões (reservas).

## Opções consideradas

1. **Coluna de saldo atualizada com `UPDATE`** — simples e rápida; mas o histórico se perde, um bug corrompe o saldo sem deixar rastro e não há como provar que o saldo está certo.
2. **Event sourcing completo** — histórico total e reconstrução de qualquer estado; mas exige infraestrutura de eventos, projeções e versionamento, com custo alto para a V1.
3. **Ledger de partidas dobradas, append-only, com saldo materializado** — cada movimentação é um lançamento imutável com débitos e créditos que se anulam; o saldo é uma projeção atualizada na mesma transação e conferida por reconciliação.

## Decisão

**Opção 3.**

- Todo lançamento tem pelo menos duas partidas e **Σ débitos = Σ créditos** (garantido no domínio e por constraint trigger diferida no banco).
- Lançamentos nunca são editados nem apagados; correção é feita por **estorno** (um novo lançamento). O papel da aplicação no banco não tem permissão de `UPDATE`/`DELETE` nessas tabelas.
- **Plano de contas explícito:** contas de clientes e contas de sistema (`system:funding`; na Fase 2, `system:pix_clearing` e `system:bacen_settlement`).
- **Dois saldos por conta de cliente:** contabilizado (*posted*) e disponível (*available* = contabilizado − reservas), já preparando reservas de cartão.
- **Contas de sistema sem saldo materializado**, para não virarem gargalo (*hot account*).
- **Reconciliação:** um job confere que o saldo materializado é igual à soma dos lançamentos.

## Consequências

- ➕ Todo centavo é rastreável até a operação que o originou
- ➕ Um bug não apaga história; divergências são detectadas pela reconciliação
- ➕ O mesmo modelo suporta Pix externo, estornos e cartões sem mudança estrutural
- ➖ Mais escrita por operação (lançamento + partidas + saldo) que um simples `UPDATE`
- ➖ Mais conceitos para quem chega ao código (débito/crédito, plano de contas)
- ➖ A tabela de partidas cresce sem parar (mitigação futura: particionamento por mês)

## Referências

- `docs/architecture/domain-model.md` (seções 3.3, 5 e 6)
- `docs/architecture/database.md` (seções 5.3, 7 e 12)
