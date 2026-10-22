# 0017 — Simulador montado no serviço da API

- **Status:** Aceito
- **Data:** 2026-10-22

## Contexto

A v1.2.0 leva o Pix para outros bancos (fictícios) por um simulador do Bacen: o DICT diz de quem é a chave, o SPI recebe o pagamento e responde depois (plano `v1.2.0-pix-assincrono.md`, D2 e D13). Em produção, o simulador precisa estar publicado para a demo funcionar. A hospedagem é gratuita e comporta **um** serviço web (ADR 0012). Ao mesmo tempo, a API tem de tratar o simulador como um parceiro de fora: ele falha, demora e pode não responder.

## Opções consideradas

1. **Um segundo serviço no Render.** É o mais parecido com um parceiro real, mas é outro serviço gratuito que dorme, divide as 750 horas mensais e dobra o trabalho de deploy.
2. **Chamar o simulador como biblioteca, dentro do processo.** Não há rede: o timeout, a resposta perdida e a chave do participante deixam de existir, e os testes passam a provar menos do que a produção precisa.
3. **Montar o simulador como plugin no mesmo Fastify, sob `/simulator`, e chamá-lo por HTTP no `127.0.0.1`.**

## Decisão

**Opção 3** (plano da v1.2.0, D2; tarefa 3, P2).

- **Plugin:** o simulador é um plugin do Fastify (`simulatorPlugin`). Sozinho, ele roda pelo `buildSimulator` (desenvolvimento, CI e os seus testes); no serviço da API, o `mountSimulator` o registra sob `/simulator`.
- **Fronteira:** só `server.ts` e `mount-simulator.ts` importam o pacote `@nextbank/simulator`, regra que o dependency-cruiser verifica. O resto da API fala com ele pelo `HttpSpiClient`, por HTTP, com prazo de 2 s, como falaria com qualquer parceiro.
- **Autenticação:** as rotas do simulador ficam públicas para o token da API, porque o próprio simulador pede a chave do participante em cada uma (EXT-09). A API só envia essa chave para o `127.0.0.1` ou por HTTPS, e a configuração recusa outro endereço.
- **Dados:** o simulador usa o seu papel (`nextbank_simulator`), o seu schema e a sua tabela de migrations, no mesmo banco. A API não lê o schema dele, e ele não lê os da API.
- **Ligar e desligar:** `SIMULATOR_DATABASE_URL` monta o simulador; `EXTERNAL_PIX_ENABLED` liga o Pix para outros bancos, desligado em produção até a tarefa 4 (P1).

## Consequências

- ➕ Um serviço gratuito só, com um deploy só
- ➕ A API trata o simulador como parceiro: timeout, falha injetada e chave do participante são exercitados de verdade, inclusive em produção
- ➕ Trocar o simulador por um parceiro real é trocar a URL e a chave, sem mudar o código da API
- ➖ O simulador divide a CPU e a memória da instância gratuita com a API e o worker do outbox
- ➖ O rate limit global da API (100 por minuto por IP) também vale para as chamadas internas, que saem todas do `127.0.0.1`. Basta para a demo, mas o teste de caos (tarefa 9) vai precisar de outro limite para elas
- ➖ Uma queda do processo derruba a API e o simulador juntos, o que um banco real nunca teria; na demo, a consulta de status e a conciliação (tarefas 4 e 6) cobrem o que ficar pela metade
- ➖ O banco ganha um terceiro papel e mais um pool de conexões no mesmo plano gratuito

## Referências

ADR 0009 (papéis no Neon), ADR 0012 (hospedagem gratuita), ADR 0016 (outbox); `database.md`, seção 5.4.2 (schema do simulador); `operations.md`, passo 10; threat model EXT-03 e EXT-09; plano da v1.2.0, D2, D13 e tarefa 3.
