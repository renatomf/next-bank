# 0014 — Fronteiras de UI: design system, `core/ui` e features

- **Status:** Aceito
- **Data:** 2026-10-20

## Contexto

A ADR 0003 isolou os componentes visuais no pacote `design_system`, e a regra de arquitetura proíbe uma feature de importar outra. Quando duas features passaram a usar a mesma peça do banco (o cartão de saldo na Home e no Extrato, o cartão de pagamento em Cartões e na Home), o único lugar compartilhado para UI era o design system. Ele acumulou oito componentes com conceitos do banco e textos em pt-BR, e o app ficou sem regra para decidir onde um componente novo mora. Ao mesmo tempo, as telas repetem estilos que o tema já poderia dar (100 usos de `NbType` direto; 11 caixas, 7 círculos e 2 etiquetas montados à mão), e duas cópias do mesmo interruptor já divergiram (0,8 e 0,75).

## Opções consideradas

1. **Manter tudo no design system**, só organizando pastas. Não muda nada que importa: o pacote continua sabendo o que é saldo, Pix e extrato, e nada impede o próximo componente do banco de entrar lá.
2. **Um segundo pacote** (`packages/nextbank_ui`) entre o design system e o app. Fronteira forte, mas mais um pacote no workspace, com `pubspec`, CI e versão, para servir a um único app.
3. **Cada componente na feature dona**, e a outra feature o recebe pela raiz de composição. Nenhuma pasta nova, mas a ligação fica indireta e difícil de seguir.
4. **`lib/core/ui/` no app** para a UI do banco que duas ou mais features usam, e o design system só com tokens, tema, componentes e padrões genéricos.

## Decisão

**Opção 4.** O `core/` já guarda o que as features compartilham (sessão, extrato, perfil) e já tem o teste que o impede de importar uma feature; a UI compartilhada ganha uma pasta dentro dele. Onde a peça mora depende do que ela faz: o que só compõe componentes fica na tela ou na feature; o que desenha (tokens, `BoxDecoration`, pintura) é um componente e mora no `core/ui`, se tem conceito do banco, ainda que uma feature só o use, ou no design system, se faria sentido num app que não é um banco. A primeira versão desta decisão separava pelo número de features que usam a peça; os componentes do banco que saem do design system desenham, e a revisão (F-36, 2026-10-20) trocou o critério. O design system se organiza em quatro camadas (`tokens` → `theme` → `components` → `patterns`), cada uma importando só as anteriores, e não guarda texto de interface: os textos chegam por parâmetro. As telas leem os estilos de texto do tema, por um `ThemeExtension` com os nomes do brief (`context.nbText.caption`), em vez de combinar tokens; os nomes do Material ficam para os widgets do Material. Testes que leem o código fonte (como o `architecture_test.dart`) barram a volta de cada problema.

## Consequências

- ➕ Um visual muda num lugar só (componente ou tema), e as inconsistências deixam de ter onde nascer
- ➕ O design system poderia servir a outro app sem levar o banco junto
- ➕ Componente novo tem endereço definido pela tabela da tarefa 4.17, verificado no CI
- ➖ Quatro PRs de refatoração antes da recarga (tarefa 5), sem funcionalidade nova
- ➖ Os testes de guarda leem texto, não a árvore de sintaxe: uma exceção legítima precisa entrar numa lista com o motivo
- ➖ Componentes do design system ficam um pouco mais verbosos de usar, com os textos obrigatórios por parâmetro
