# 0018 — Pix assíncrono e conciliação diária

- **Status:** Aceito
- **Data:** 2026-10-27

## Contexto

Até a v1.1.0, todo Pix era entre clientes do next bank e terminava na mesma transação da autorização. A v1.2.0 leva o Pix para outros bancos (fictícios) por um SPI simulado, que responde depois e falha de propósito (plano `v1.2.0-pix-assincrono.md`). Um Pix externo agora tem uma vida longa:

1. É autorizado e debitado para `system:pix_clearing`.
2. É enviado pelo outbox (ADR 0016).
3. Termina quando o SPI responde, por webhook ou pela consulta de status.

Nesse caminho, uma resposta pode se perder, chegar repetida, ou o next bank e o SPI podem discordar sem que ninguém perceba (EXT-04).

## Opções consideradas

1. **Confiar só no webhook.** É simples, mas um webhook perdido deixa o dinheiro preso em `pix_clearing` para sempre.
2. **Estornar por tempo**, se o SPI não responder em X minutos. Fecha o caso, mas pode devolver ao cliente um dinheiro que saiu, se o SPI liquidou e a resposta se perdeu.
3. **Webhook, consulta de status e conciliação diária**, cada um cobrindo o que o anterior deixa passar.

## Decisão

**Opção 3** (plano da v1.2.0, D6, D7 e tarefas 3 a 6).

- **Envio:** o débito, o Pix em `PROCESSING` com o id de ponta a ponta e a mensagem do outbox são gravados na mesma transação. O envio carrega sempre o mesmo id, e o SPI recebe cada id uma vez só (EXT-03).
- **Resposta:**
  - O webhook assinado (EXT-01) e a consulta de status dos Pix parados há mais de 2 minutos levam ao mesmo caso de uso, que trava o Pix e grava o evento no inbox (EXT-02).
  - Liquidado, o dinheiro vai para `system:bacen_settlement`. Recusado, volta ao cliente. **Nunca há estorno sem recusa confirmada** (D6).
- **Conciliação:**
  - Uma vez por dia, às 03:00 de São Paulo, o arquivo de liquidação do SPI do dia anterior é comparado com os Pix e o ledger do next bank, casando pelo id de ponta a ponta (R1).
  - Toda divergência vira uma `ReconciliationException`: pagamento faltando de um lado, valor diferente, estado diferente, Pix parado há mais de um dia, ou saldo de `pix_clearing` diferente da soma dos Pix em espera.
  - As exceções só são registradas. Uma pessoa resolve cada uma, no backoffice da v1.3.0 (D7).
- **Fronteira:** a conciliação é um contexto próprio (`reconciliation`), com schema próprio. Ela lê Payments e o Ledger só pelos módulos deles, nunca move dinheiro e só inclui exceções (R5).

## Consequências

- ➕ Nenhum dinheiro some nem é devolvido duas vezes: cada caminho que pode falhar tem outro que o cobre, e o que nenhum cobre vira exceção para uma pessoa
- ➕ A conciliação refeita para um dia não duplica nada, e um dia perdido (deploy, instância dormindo) é refeito na hora seguinte
- ➕ O Sentry só sabe que houve divergência e quantas; os detalhes ficam no banco
- ➖ **Dinheiro pode ficar dias em `pix_clearing`** quando o SPI não responde e nada confirma a recusa. É a escolha certa para um banco (D6), mas o cliente vê o Pix em processamento até uma pessoa agir
- ➖ A conciliação de um dia só roda no dia seguinte; uma divergência leva até um dia para aparecer
- ➖ Casar pelo id de ponta a ponta depende de o SPI devolver o mesmo id que recebeu; um parceiro que mude o id quebraria a conciliação
- ➖ Mais três laços no processo da API (webhooks, consulta de status, conciliação) dividindo a CPU fraca da instância gratuita

## Referências

ADR 0005 (ledger só por inclusão), ADR 0007 (idempotência), ADR 0016 (outbox e inbox), ADR 0017 (simulador no serviço da API); `domain-model.md`, seção 6; `database.md`, seções 5.4 e 5.6; threat model EXT-01 a EXT-04 e EXT-08; plano da v1.2.0, tarefas 3 a 6.
