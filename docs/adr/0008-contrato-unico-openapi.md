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

## Resultado do spike (2026-10-06)

Rota de exemplo com os casos difíceis (centavos inteiros, enum, campo opcional, campo nulo, erro RFC 7807), Fastify 5 + Zod 4 + `fastify-type-provider-zod` 7 + `@fastify/swagger` 9, e cliente gerado com `openapi-generator` 7.25.0 (`dart-dio`, `serializationLibrary=json_serializable`).

| Critério | Resultado |
|---|---|
| Nenhuma edição manual no código gerado | ✅ (só configuração; ver abaixo) |
| Centavos como `int`, nunca `double` | ✅ |
| Enums tipados, inclusive o código de erro do RFC 7807 | ✅ |
| Opcional e nulo viram tipos anuláveis; campo obrigatório ausente é recusado | ✅ |
| Desserializa a resposta real da API (`fastify.inject`) | ✅ |
| Regenerar sem mudanças produz diff vazio (base do gate do CI) | ✅ |
| `dart analyze` sem avisos | ✅ |

**Plano B não foi necessário.** Configuração que torna isso possível:
- **O gerador só escreve em `lib/`.** O `pubspec.yaml` (o gerado declara Dart `>=3.5`, incompatível com o código que o `json_serializable` atual emite) e o `analysis_options.yaml` são nossos, protegidos por `.openapi-generator-ignore`.
- **Código gerado fora do lint** (`lib/src/**` excluído da análise): ele traz um import não usado que não controlamos. O lint estrito vale para o código escrito à mão.
- **Fixar versões:** imagem `openapitools/openapi-generator-cli:v7.25.0` (nunca `latest`) e dependências do pacote com restrição explícita (o `pubspec` gerado usa `build_runner: any`).
- **No `jsonSchemaTransformObject`** do `fastify-type-provider-zod`: sem ele, o OpenAPI sai com `$ref` para schemas inexistentes.

**Pontos de atenção para a Tarefa 3:**
- Cada schema aparece duplicado (`Balance` e `BalanceInput`, entrada e saída do Zod), gerando classes a mais no cliente.
- O suporte do gerador a OpenAPI 3.1 está em beta; avaliar emitir 3.0.3 se aparecer limitação.
- O gerador exige Java; no CI e localmente roda pela imagem Docker.
- Classes de autenticação não usadas (API key, OAuth) são geradas junto.

## Consequências

- ➕ Uma única definição: o que a API valida é exatamente o que os clientes esperam
- ➕ Mudança incompatível na API quebra o build do cliente, não o app em produção
- ➕ Documentação da API sempre atualizada (é gerada)
- ➖ Geradores de código Dart para OpenAPI têm limitações (tipos união, formatos especiais) e podem exigir ajustes
- ➖ Código gerado no repositório aumenta o tamanho das PRs (mitigação: revisar só a especificação, não o código gerado)
- ➖ Acoplamento a Zod e ao gerador escolhido

## Referências

- [Roadmap](../roadmap.md), seção 6.8 (contrato único)
