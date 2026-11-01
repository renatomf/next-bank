# 0019 — Trace de ponta a ponta com OpenTelemetry

- **Status:** Aceito
- **Data:** 2026-11-01

## Contexto

Um Pix para outro banco passa por quatro momentos separados no tempo (ADR 0018): a autorização, a entrega pelo outbox segundos depois, o SPI do simulador e o webhook que volta. Até a tarefa 8 da v1.2.0, eles só se ligavam pelo `requestId` nos logs, juntados à mão. O plano (D8) pede um trace ponta a ponta, sem dado pessoal (EXT-07) e sem serviço externo novo em produção (ADR 0012).

Duas restrições do código pesam na escolha:

- O Sentry 10, que já reporta os erros, monta o OpenTelemetry dele no `init`. Dois donos registrariam dois provedores globais, e o segundo seria recusado sem aviso.
- A API roda em ESM pelo `node src/server.ts`. As instrumentações automáticas pedem um carregador (`--import`) antes de qualquer módulo.

## Opções consideradas

1. **`@opentelemetry/sdk-node` com as instrumentações automáticas** (http, Fastify, pg). Cobre tudo sem escrever spans, mas pede o carregador ESM, traz dezenas de pacotes e grava por padrão a URL e o SQL, que a lista de permitidos teria de apagar depois.
2. **O OpenTelemetry do próprio Sentry**, mandando os spans para o Sentry. Não traz pacote novo, mas manda o trace para um serviço externo e depende de um DSN, que o ambiente local não tem.
3. **Instrumentação manual com o SDK de trace**, nos pontos do caminho: a requisição, a transação, as rodadas, o outbox, o cliente do SPI, o simulador e o webhook. O contexto atravessa a espera numa coluna `trace_parent`.

## Decisão

**Opção 3** (plano da v1.2.0, tarefa 8, T1 a T6).

- **Um dono só:** o `tracing.ts` registra o provedor quando há `OTEL_EXPORTER_OTLP_ENDPOINT`. O Sentry sobe com `skipOpenTelemetrySetup: true`: ele só reporta erros, com as tags postas à mão.
- **Lista de permitidos:** todo span passa por um filtro antes de sair do processo. Ficam só ids, estados e o molde da rota; saem eventos, a mensagem de erro e todo o resto (EXT-07).
- **A espera:** o outbox e o pagamento do simulador guardam o `traceparent` de quem os gravou. O worker e o despachante de webhooks continuam o trace a partir dele.
- **De fora:** só o webhook do SPI e as rotas do simulador continuam um `traceparent` recebido. As rotas do app começam sempre um trace novo (EXT-10).
- **Produção:** sem coletor, nada é registrado. Localmente, o Jaeger do `docker-compose` (perfil `tracing`).

## Consequências

- ➕ Um Pix externo, ou uma ocorrência de agendamento, aparece num trace só, da autorização ao webhook
- ➕ O que sai do processo é decidido num lugar só, testado sozinho e de ponta a ponta
- ➕ Custo zero em produção, e nenhum pacote de instrumentação nem carregador ESM
- ➖ **Sem spans do Postgres nem do `fetch` em geral:** o trace mostra a transação inteira, não cada query. Se fizer falta, as instrumentações entram depois, passando pela mesma lista
- ➖ Cada ponto do caminho tem o seu span escrito à mão; uma rota ou um laço novo que chame o mundo de fora precisa lembrar de propagar o `traceparent`
- ➖ Mais uma coluna no outbox e no simulador, que guarda dado de observabilidade ao lado de dado de negócio
- ➖ Em produção não há trace nenhum: um problema lá ainda se investiga pelos logs e pelo `requestId`, até alguém decidir ligar um coletor

## Referências

ADR 0012 (hospedagem gratuita), ADR 0016 (outbox e inbox), ADR 0017 (simulador no serviço da API), ADR 0018 (Pix assíncrono); `database.md`, seções 5.4 e 5.4.2; threat model EXT-07 e EXT-10; `operations.md`, seção 11; plano da v1.2.0, tarefa 8.
