# 0012 — Hospedagem da V1: Render gratuito e Neon, sem custo

- **Status:** Aceito
- **Data:** 2026-10-12

## Contexto

A V1 precisa de um ambiente publicado, para que quem avalia o projeto use a demo em menos de um minuto, sem instalar nada além do APK (`roadmap.md`, seção 8.2). O roadmap prevê um ambiente só, sem staging (seção 3).

Forças em jogo:

- **Custo zero:** o desenvolvedor decidiu não pagar hospedagem (plano da semana 8, D9 revista).
- **Orçamento de performance medido:** p95 abaixo de 200 ms nas leituras e de 400 ms no Pix (CLAUDE.md, seção 6). Cada consulta ao banco soma a distância entre a API e o banco.
- **Achados do ADR 0009 no Neon:** papéis criados pelo painel ignoram os `GRANT`s, e o `verify-full` ficou para o deploy.
- **Ordem do deploy:** uma migration precisa vir antes do código que a usa. O `is_demo` do DEMO-03 foi o primeiro caso.
- **Reset da demo:** a demo volta limpa todo dia (DEMO-02), e o ledger só aceita inclusão.
- **Atrás do proxy:** a API passa a receber os clientes por um proxy, e o limite de tentativas por IP depende de saber o IP real (API-14).

## Opções consideradas

1. **Render gratuito + Neon gratuito, os dois em `us-east-1`.** Sem custo e sem cartão. O Render gratuito dorme depois de 15 minutos sem requisições, e a CPU da instância é fraca.
2. **Render pago (Starter) + Neon gratuito.** Sempre acordado e com mais CPU, por cerca de US$ 7 por mês. Recusado pelo custo.
3. **Google Cloud Run + Neon em São Paulo.** Grátis dentro da cota e perto do Brasil, com boa CPU. Exige cartão cadastrado e um Dockerfile, e uma cota estourada vira cobrança.
4. **VM gratuita da Oracle.** Sempre ligada, mas o desenvolvedor passa a operar o servidor (atualizações, firewall, TLS), o que aumenta a superfície de ataque e o trabalho.
5. **Neon em São Paulo com o Render nos EUA.** Banco perto do cliente, mas cada consulta da API cruzaria o continente (cerca de 120 ms), o que torna o p95 inviável.

## Decisão

**Opção 1: Render gratuito e Neon gratuito, os dois em Virginia (`us-east-1`).**

**Neon**
- O branch raiz (`clean`) guarda só os papéis e o banco vazio, criados por SQL (`infra/neon/bootstrap.sql`).
- A demo roda num branch filho, para onde aponta a API.
- O reset diário restaura o filho a partir do pai e aplica de novo as migrations e o seed (`demo-reset.yml`). Nenhum código apaga lançamentos.

**Render**
- Um serviço web com o runtime de Node, sem Dockerfile, e com o deploy automático desligado.
- As chaves da API (JWT, PII, pepper do PIN) ficam só nas variáveis de ambiente do Render.
- `TRUST_PROXY=1`, para que o IP do cliente seja o salto antes do proxy (API-14).

**Deploy (`deploy.yml`)**
- Depois do CI verde na `main`, aplica as migrations com o papel de migração pelo host direto do Neon (`verify-full`).
- Em seguida chama o deploy hook do Render, espera o `/health` mostrar o commit novo e roda o smoke test com a conta de Ana.

**Despertador (`keep-awake.yml`)**
- A cada ~10 min, chama o `/health`, para a API não dormir.

## Consequências

**Positivas**
- ➕ Custo zero e nenhum cartão cadastrado.
- ➕ API e banco na mesma região: cada consulta fica local.
- ➕ A migration sempre vem antes do código, e o deploy só termina com a versão nova respondendo.
- ➕ As chaves de produção nunca vão para o GitHub: o reset diário faz o seed pela API publicada.
- ➕ O reset diário não escreve código de exclusão: o banco inteiro volta a um ponto limpo.

**Negativas**
- ➖ **Primeira abertura lenta:** o agendamento do GitHub pode atrasar e deixar a API dormir. A primeira requisição depois disso leva até 1 minuto. O README avisa.
- ➖ **CPU fraca:** o Argon2id do login e do PIN é pesado de propósito e não é afrouxado. O p95 do login e do Pix pode passar do orçamento de 400 ms. O número medido fica registrado no documento de performance como consequência desta decisão, e não como uma regressão escondida.
- ➖ **Distância para o Brasil:** um cliente no Brasil paga a ida e volta até os EUA uma vez por requisição, cerca de 120 ms.
- ➖ **Limites do plano gratuito:** o Render gratuito dá 750 horas por mês, o que basta para um serviço sempre ligado. Mudanças nos planos gratuitos podem exigir revisar esta decisão.
- ➖ **Sem staging:** um erro de deploy aparece na própria demo. O smoke test e o CI reduzem o risco, mas não o eliminam.

## Referências

- Plano da semana 8: D3, D4, D5, D9 e o "Desenho da tarefa 3".
- ADR 0009 (achados no Neon) e threat model: API-14, DEMO-02 e DEMO-03.
- `docs/operations.md`: o passo a passo de criação e operação.
