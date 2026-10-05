# 0008 — Contrato único: Zod → OpenAPI → clientes gerados

- **Status:** Aceito
- **Data:** 2026-10-05

## Contexto

A API é consumida por um app Dart (Flutter) e, na Fase 3, por um backoffice TypeScript (Next.js). Se os modelos de requisição e resposta forem escritos à mão em cada lado, eles se desencontram silenciosamente, e o erro só aparece em produção.

## Opções consideradas

1. **Modelos escritos à mão em cada cliente** — controle total; mas não há garantia de sincronia.
2. **OpenAPI escrito à mão (YAML) como fonte** — padrão de mercado; mas o YAML e a validação no servidor podem divergir.
3. **tRPC** — tipos de ponta a ponta sem geração; mas só funciona entre TypeScript, não atende o app Dart.
4. **GraphQL** — schema único e tipado; mas acrescenta complexidade (resolvers, cache, autorização por campo) sem necessidade para esta API.
5. **Schemas Zod na API como fonte única** → OpenAPI gerado → cliente Dart e cliente TypeScript gerados.

## Decisão

**Opção 5.** Os schemas Zod validam as requisições na API **e** geram o documento OpenAPI; a partir dele são gerados o cliente Dart (app) e o cliente TypeScript (backoffice), em `packages/contracts`. O CI regenera os clientes e **falha se o resultado divergir do que está commitado**.

**Plano B:** se o gerador Dart exigir mais de 1 dia de ajustes, os DTOs Dart passam a ser escritos à mão, e testes de contrato validam as respostas reais contra o OpenAPI.

## Consequências

- ➕ Uma única definição: o que a API valida é exatamente o que os clientes esperam
- ➕ Mudança incompatível na API quebra o build do cliente, não o app em produção
- ➕ Documentação da API sempre atualizada (é gerada)
- ➖ Geradores de código Dart para OpenAPI têm limitações (tipos união, formatos especiais) e podem exigir ajustes
- ➖ Código gerado no repositório aumenta o tamanho das PRs (mitigação: revisar só a especificação, não o código gerado)
- ➖ Acoplamento a Zod e ao gerador escolhido

## Referências

- Spec, seção 6.8 (contrato único)
