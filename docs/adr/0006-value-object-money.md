# 0006 — Dinheiro como inteiro em centavos (Value Object `Money`)

- **Status:** Aceito
- **Data:** 2026-10-05

## Contexto

Valores monetários atravessam o banco de dados, a API (JSON), o TypeScript e o Dart. Números de ponto flutuante não representam valores decimais com exatidão (`0.1 + 0.2 !== 0.3`), e erros de arredondamento em dinheiro são inaceitáveis.

## Opções consideradas

1. **Ponto flutuante (`number` / `double`)** — nativo e simples; mas impreciso por definição.
2. **Decimal de precisão arbitrária** (`numeric` no Postgres, bibliotecas decimais no código, string no JSON) — exato e flexível; mas exige biblioteca em cada linguagem e conversões cuidadosas em toda borda.
3. **Inteiro na menor unidade da moeda (centavos)** — `bigint` no Postgres, inteiro no JSON, `bigint`/inteiro no TypeScript e `int` no Dart.

## Decisão

**Opção 3**, encapsulada no Value Object `Money` (`amount` em centavos + `currency`).

- `Money` é imutável; só soma e subtrai com a mesma moeda; nunca aceita fração de centavo.
- No JSON da API, os valores trafegam como inteiro em centavos (ex.: `"amount": 35000` para R$ 350,00), com a moeda explícita.
- Formatação para exibição (`R$ 350,00`) acontece **somente** no Design System do app.
- Usar `number`/`double` para valores monetários é proibido pelos padrões do projeto.

## Consequências

- ➕ Aritmética exata em todas as camadas, sem biblioteca decimal
- ➕ Comparações e somas simples e rápidas; `CHECK` no banco direto sobre inteiros
- ➖ Conversão obrigatória nas bordas (entrada do usuário e exibição)
- ➖ Moedas com outra quantidade de casas decimais (ex.: iene com 0, dinar do Bahrein com 3) exigiriam uma tabela de expoente por moeda; fora do escopo enquanto só houver BRL
- ➖ Operações que geram frações (juros, câmbio) exigirão uma política de arredondamento explícita quando existirem

## Referências

- `CLAUDE.md` (Padrões de engenharia — Correção financeira)
- `docs/architecture/database.md` (seção 3, convenções)
