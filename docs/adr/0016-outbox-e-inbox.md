# 0016 — Outbox transacional e inbox

- **Status:** Aceito
- **Data:** 2026-10-22

## Contexto

Até a v1.1.0, tudo acontecia numa transação só: o Pix interno debitava um cliente e creditava o outro no mesmo `COMMIT`. A v1.2.0 leva o Pix para fora do next bank, por um simulador do Bacen que responde depois e que falha de propósito (plano `v1.2.0-pix-assincrono.md`). Duas perguntas aparecem:

1. Como avisar o mundo de fora de uma decisão, sem avisar o que não foi gravado nem gravar o que nunca foi avisado?
2. Como receber as respostas de fora, que podem chegar repetidas, fora de ordem ou nunca, sem aplicá-las duas vezes?

## Opções consideradas

1. **Chamar o parceiro de dentro da transação.** É simples, mas uma resposta lenta segura as travas do saldo. Se a chamada passa e o `COMMIT` falha, o parceiro recebeu um pagamento que o banco não tem.
2. **Chamar depois do `COMMIT`, no mesmo pedido.** Não segura travas, mas se o processo cai entre o `COMMIT` e a chamada, a decisão fica gravada e nunca é avisada.
3. **Fila externa** (Redis, SQS, RabbitMQ). É robusta, mas é mais um serviço para hospedar e pagar (o plano gratuito comporta um só, ADR 0012), e gravar no banco e na fila ao mesmo tempo continua sem garantia.
4. **CDC** (ler o log de replicação do Postgres). Não toca o código dos comandos, mas pede infraestrutura que a hospedagem gratuita não tem.
5. **Outbox transacional e inbox no próprio Postgres.**

## Decisão

**Opção 5** (plano da v1.2.0, D3 e tarefa 2).

- **Outbox:** o comando grava a mensagem em `platform.outbox_messages` na mesma transação do que decidiu. Ela existe exatamente quando a decisão existe.
- **Worker:** dentro do processo da API, ele entrega as mensagens **pelo menos uma vez**. Reserva as mensagens com `FOR UPDATE SKIP LOCKED` e um prazo (`locked_until`), roda o tratador sem transação aberta (nenhuma trava esperando a rede, lição do F-40) e registra o resultado em outra transação.
- **Falhas:** a nova tentativa vem depois de esperas que dobram a partir de 1 s. Depois da décima, a mensagem fica `DEAD` e é relatada, e uma pessoa decide (EXT-08).
- **Conteúdo:** a mensagem leva só ids e códigos. O tratador lê o resto do banco.
- **Inbox** (tarefa 4): a resposta de fora é aceita só com assinatura válida, e o id do evento é gravado numa tabela própria com `ON CONFLICT DO NOTHING`. Um evento repetido não faz nada, e um estado final nunca é desfeito.

## Consequências

- ➕ Nenhuma decisão se perde nem é avisada sem ter sido gravada, com uma transação só por comando (ADR 0010)
- ➕ Sem serviço novo: o Postgres que já existe faz a fila
- ➕ Uma resposta repetida, atrasada ou perdida não muda o dinheiro duas vezes; a perdida é coberta pela consulta de status e pela conciliação
- ➖ **Pelo menos uma vez:** um worker que cai depois do tratador e antes de registrar faz a mensagem ser entregue de novo. Por isso todo tratador precisa ser idempotente, com o id da mensagem ou do pagamento como chave
- ➖ Atraso de até ~1 s entre a decisão e o aviso, o intervalo do laço do worker
- ➖ A tabela cresce: as mensagens entregues ficam até um job de limpeza, que ainda não existe
- ➖ O worker no processo da API divide a CPU fraca da instância gratuita com as requisições

## Referências

ADR 0007 (idempotência e concorrência), ADR 0010 (unidade de trabalho), ADR 0012 (hospedagem gratuita), ADR 0015 (idempotência compartilhada); `database.md`, seção 5.4 (`platform.outbox_messages`); threat model EXT-02, EXT-03 e EXT-08; plano da v1.2.0, tarefas 2 e 4.
