# 0003 — Flutter + Riverpod no app mobile

- **Status:** Aceito
- **Data:** 2026-10-05

## Contexto

O app precisa rodar em Android e iOS com uma única base de código, ter UI altamente customizada (Design System próprio, card de saldo com efeitos) e uma camada de estado testável, com estados de carregamento, erro e regras de negócio bem definidos.

## Opções consideradas

**Framework**
1. **Nativo (Kotlin + Swift)** — melhor integração com a plataforma; mas duas bases de código para uma pessoa manter.
2. **React Native** — ecossistema JavaScript/TypeScript e reaproveitamento de conhecimento web; mas a UI depende de componentes nativos de cada plataforma, o que torna um Design System pixel a pixel mais trabalhoso, e o desempenho de animações complexas exige mais cuidado.
3. **Flutter** — motor de renderização próprio (a UI é idêntica nas duas plataformas), ótimo desempenho de animação, tipagem forte com Dart e ferramentas de teste de widget maduras.

**Gerência de estado**
1. **Bloc** — padrão consolidado e explícito; mas mais verboso (eventos, estados e classes para cada fluxo).
2. **Provider / setState** — simples; mas não escala bem e mistura estado com a árvore de widgets.
3. **Riverpod (com geração de código)** — estado fora da árvore de widgets, injeção de dependências embutida, `AsyncNotifier` para estados assíncronos e substituição fácil de dependências nos testes.

## Decisão

**Flutter com Riverpod**, em arquitetura feature-first com Clean Architecture (`domain/`, `data/`, `presentation/` por feature). Estados imutáveis com Freezed; falhas modeladas como `sealed class`.

## Consequências

- ➕ Uma base de código; UI idêntica nas duas plataformas, alinhada ao Design System
- ➕ Notifiers testáveis sem widgets; dependências trocadas por implementações falsas nos testes
- ➕ Componentes visuais isolados no pacote `design_system`
- ➖ Dart é menos comum que TypeScript; o time (ou quem avalia o projeto) precisa conhecer o ecossistema
- ➖ Geração de código (Riverpod, Freezed) adiciona um passo de build e arquivos gerados para revisar
- ➖ Recursos nativos específicos (ex.: Secure Enclave) dependem de plugins ou de código nativo

## Referências

- Spec, seção 6.7 (Flutter — feature-first + Clean Architecture)
- `docs/design/brief.md`
