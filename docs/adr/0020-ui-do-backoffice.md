# 0020 — UI do backoffice: Tailwind, shadcn e os tokens do app

- **Status:** Aceito
- **Data:** 2026-11-02

## Contexto

A tarefa 2 da `v1.3.0` decidiu por CSS próprio, sem biblioteca de componentes (D2): poucas telas, e cada dependência a menos é uma a menos para manter. Depois da tarefa 3, o backoffice tinha quatro telas num `globals.css` único, só em modo escuro, sem as fontes do app. As tarefas 4 a 8 trazem formulários, confirmações, tabelas e filtros, e o desenvolvedor quer a mesma identidade do app (tokens, modo claro e escuro) com componentes organizados. Pesa também a CSP estrita do backoffice (STF-05), sem `unsafe-inline`, que qualquer escolha precisa manter.

## Opções consideradas

1. **Continuar com CSS próprio, em CSS Modules**, com componentes nossos. Zero dependência e CSP intocada, mas a acessibilidade de foco, teclado e ARIA fica toda por nossa conta, componente a componente, e cada peça nova (confirmação, menu, seletor) é escrita do zero.
2. **Uma biblioteca fechada (MUI, Chakra).** Componentes prontos, mas com o visual e o motor de estilos delas: CSS-in-JS injeta `<style>` em tempo de execução, o que pede `unsafe-inline` ou nonce em cada estilo, e a identidade do app vira sobrescrita de tema.
3. **Tailwind 4 e shadcn sobre Radix.** O shadcn copia o código dos componentes para o repositório (ficam nossos, editáveis), o Radix dá a acessibilidade, e o Tailwind gera CSS estático no build, que a CSP já aceita. Os tokens do app viram variáveis CSS, nos dois modos.

## Decisão

**Opção 3.** É a que dá a identidade do app sem brigar com ela: os tokens do `tokens.dart` são espelhados em `styles/tokens.css` (um teste compara os dois), e os nomes do shadcn apontam para eles. O tema segue o sistema até a pessoa escolher, guardado num cookie que o servidor lê, sem script no navegador. As fronteiras repetem a ADR 0014: `components/ui` (genérico, o papel do `design_system`), `components/nb` (conceitos do banco, o do `core/ui`) e `features/` (o das features), com testes que leem o código. Só entram os componentes que uma tela usa, e nenhum que dependa de `style=` no HTML do servidor.

## Consequências

- ➕ O backoffice tem a cara do app, nos dois modos, e uma cor muda num lugar só
- ➕ Acessibilidade dos componentes interativos vem do Radix, mantido e testado por outros
- ➕ Os componentes são código do repositório: nada fica preso a uma versão de biblioteca de UI
- ➖ Sete dependências novas onde havia zero, e o código gerado pelo shadcn passa a ser nosso para manter (sem atualização automática)
- ➖ Os tokens existem em dois arquivos (Dart e CSS); o teste impede que divirjam, mas uma mudança de cor é feita duas vezes
- ➖ Cada componente do Radix precisa ser conferido contra a CSP antes de entrar: alguns põem `style=` no HTML do servidor
- ➖ O `class-variance-authority` não tem versão nova desde 2024; se for abandonado de vez, as variantes passam a ser escritas à mão

## Referências

- `docs/plans/v1.3.0-backoffice.md`, tarefas 2 (D2) e 3.5
- `docs/design/brief.md`, seções 2 a 5 e 8
- ADR 0014 (fronteiras de UI) e ADR 0011 (BFF)
