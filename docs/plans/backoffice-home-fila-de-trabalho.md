# Plano — Home do backoffice: a fila de trabalho

- **Status:** Aprovado (2026-11-07), com as decisões H1 a H5 nos padrões recomendados; implementado na branch `feat/backoffice-home`
- **Roadmap:** `docs/roadmap.md`, seção 11, "Backoffice, depois da `v1.3.0`" (item novo)
- **Base:**
  - plano da `v1.3.0` (`v1.3.0-backoffice.md`): B5 (equipe de demonstração), B6 (quem pede não aprova), K4 (o pedido vence em 24 h), C2 (o termo da busca nunca vai numa URL);
  - threat model: STF-02, STF-07, STF-11 e STF-16;
  - ADR 0020 e `test/architecture.test.ts`: onde mora cada parte da UI, e uma feature não importa outra;
  - CLAUDE.md: desenho antes do código, paginação sempre, `EXPLAIN ANALYZE` em toda query nova.
- **Carga:** ~3 a 4 dias.
- **Objetivo:** a home deixa de repetir a sidebar e passa a responder "o que espera por mim agora?", de acordo com o papel de quem entrou. É o que uma ferramenta de operação bancária mostra primeiro: a fila, com o prazo de cada item, e o que a conciliação do dia deixou.
- **Pronto quando:**
  - o analista abre o backoffice e vê os pedidos pendentes, do mais antigo para o mais novo, cada um com o tempo que falta para vencer, e chega a um deles com um clique;
  - o operador vê os pedidos que **ele** abriu: os pendentes e os decididos por último, com o resultado;
  - quem lê exceções vê quantas estão em aberto e a mais antiga;
  - nenhum bloco aparece para quem não tem a permissão dele, e a equipe de demonstração só vê o que é de demonstração;
  - um bloco que não carrega mostra o aviso dele, e os outros continuam;
  - o E2E prova o caminho: Olívia pede, o pedido aparece na home de Diogo, Diogo aprova pela home, e Olívia vê "Aprovado" na dela.

## O que cada papel vê

| Papel | Blocos | Permissão de cada bloco |
|---|---|---|
| Operador | Saudação; botão "Buscar cliente"; **Seus pedidos** (pendentes e decididos por último); **Conciliação** | `requests.create`, `exceptions.read` |
| Analista | Saudação; **Aguardando sua decisão**; **Conciliação** | `requests.decide`, `exceptions.read` |
| Admin | Saudação e os atalhos de hoje (Equipe, Auditoria) | — (H5) |

Esboço da home do analista:

```
Bom dia, Diogo · Analista
quarta-feira, 4 de novembro · 3 pedidos esperam sua decisão

┌ Aguardando sua decisão (3) ───────────────────── Ver todos →┐
│ Estorno de Pix   Ana Demo     R$ 10,00  Olívia   [vence em 2 h]  > │
│ Desbloqueio      Carla Demo             Olívia   [vence em 9 h]  > │
│ Resolução        Bruno Demo   R$ 25,00  Olívia   [vence em 20 h] > │
└────────────────────────────────────────────────────────────┘
┌ Conciliação ─────────────────────────────────────────────── ┐
│ 2 exceções em aberto · a mais antiga, de 2 de novembro    > │
└────────────────────────────────────────────────────────────┘
```

Fila vazia: um estado próprio, "Nada esperando por você", com o ícone de check no verde da marca.

## Decisões

| # | Decisão | Recomendado | Alternativa e por que não |
|---|---|---|---|
| H1 | Como saber quais pedidos são do operador | **Um filtro `mine=true` em `GET /admin/v1/requests`**, resolvido no servidor pelo membro da sessão. O `/admin/v1/me` não devolve o id do membro, e filtrar a primeira página de todos os pedidos esconderia os do operador num dia movimentado | Filtrar no BFF a primeira página de `status=ALL`: sem API nova, mas a lista "Seus pedidos" mentiria assim que houvesse mais de 20 pedidos de outras pessoas |
| H2 | Ordem da fila do analista | O BFF lê a primeira página de pendentes (20) e a ordena do mais antigo para o mais novo. Se a página vier cheia, o título mostra "20+" e o "Ver todos" leva à fila completa | Um parâmetro de ordem na API: só compensa com mais de 20 pendentes ao mesmo tempo, o que a demo não tem |
| H3 | Cor do prazo | Pelo tempo que **falta para vencer** (o pedido vence em 24 h, K4): verde com mais de 12 h, âmbar entre 4 h e 12 h, vermelho com menos de 4 h. Sempre com o texto ("vence em 2 h"), nunca só a cor | Pela idade fixa (há 2 h, há 1 dia): ignora que o pedido vence, e um pedido de 23 h pareceria igual a um de 13 h |
| H4 | A busca de cliente na home do operador | Um botão "Buscar cliente" que leva a `/customers`, com o campo já focado. O formulário de busca mora em `features/customers`, e uma feature não importa outra | Copiar o formulário para a home: duplica a Server Action da busca, que leva o termo por POST (C2) |
| H5 | A home do admin | Fica como está nesta fatia (saudação e atalhos). Um painel da equipe vem depois, com desenho próprio | Fazer junto: dobra o escopo e a demo quase não usa o admin |

## Fontes conferidas

| Fonte | Regra | Como se prova |
|---|---|---|
| STF-02 | Negar por padrão; papel lido do banco a cada comando | Cada bloco só é montado com a permissão dele; as rotas de lista já conferem a permissão no servidor. Teste da home por papel: o admin não chama nenhuma lista de pedidos nem de exceções |
| STF-07 | Minimização de dados | A home mostra só o nome do cliente, como a lista de pedidos já mostra; nenhum CPF, e-mail ou saldo. Teste de componente confere que a linha não traz outro dado pessoal |
| STF-11 | A equipe de demonstração só vê dados de demonstração | O `mine=true` soma uma condição ao `WHERE` existente, sem tirar o filtro `demo_scope`. Teste de integração: a equipe demo com `mine=true` não vê pedido fora do escopo |
| STF-16 | Nenhuma leitura sem escopo | A home não lê a trilha de auditoria |
| B6, STF-03 | Quem pede não aprova | Só o operador tem `requests.create`, e o analista não abre pedidos: a fila do analista nunca traz pedido dele. A decisão pela home usa a mesma página do pedido, que já recusa a autoaprovação |
| K4 | O pedido vence em 24 h, pelo relógio | A cor do prazo usa o `expiresAt` que a API devolve; os testes da função usam um relógio fixo |
| C2 | O termo da busca nunca vai numa URL | H4: a home não tem campo de busca, só um link |
| ADR 0020 e teste de arquitetura | Uma feature não importa outra | O selo de situação do pedido (`request-status-badge.tsx`) sai de `features/requests` para `components/nb`, porque passa a servir duas telas; o selo do prazo nasce em `components/nb` |
| CLAUDE.md, performance | Paginação sempre; índice para toda query nova | A home lê no máximo uma página de cada lista; a query com `mine=true` ganha o índice `requests_requester_idx`, conferido com `EXPLAIN ANALYZE` |
| "Pronto quando" desta fatia | Cada item com o teste que o prova | Tabela de testes abaixo |

**Ameaças novas:** nenhuma. O `mine=true` só **estreita** uma lista que o membro já pode ler: não abre nada que antes estava fechado. Fica uma linha de teste para provar isso: `mine=false` e a ausência do parâmetro devolvem a mesma lista de hoje.

**Consequências negativas dos ADRs citados:** o ADR 0020 obriga a mover o selo de situação, um arquivo só, com a tabela de → para na entrega. O ADR 0012 (servidor gratuito que dorme) faz a primeira abertura da home esperar a API acordar, como qualquer outra tela; nada muda aqui.

**Estado global:** nenhuma dependência nova. A data e a saudação usam o `Intl` do Node, com o fuso `America/Sao_Paulo` passado explicitamente, porque o servidor da Vercel roda em UTC: sem o fuso, "Bom dia" apareceria às 21 h de Brasília.

## Estrutura

```
apps/api/
├── db/migrations/<data>_add_requests_requester_index.sql   índice (requested_by, requested_at DESC, id DESC)
└── src/modules/operations/
    ├── http/request-routes.ts             querystring ganha mine: boolean (padrão false)
    ├── application/list-requests.ts       repassa o membro da sessão quando mine
    └── infrastructure/pg-operations-repositories.ts   LIST_SQL ganha a condição do solicitante

apps/backoffice/
├── app/(staff)/page.tsx                   compõe os blocos pelo papel; uma chamada por bloco, em paralelo
├── features/home/
│   ├── greeting.ts                        saudação e data, pelo relógio e no fuso de Brasília (puro)
│   ├── queue.ts                           ordena a fila, resume "3" ou "20+" (puro)
│   ├── awaiting-decision.tsx              bloco do analista
│   ├── my-requests.tsx                    bloco do operador
│   ├── reconciliation-summary.tsx         bloco da conciliação
│   └── block-error.tsx                    o aviso de um bloco que não carregou
├── components/nb/
│   ├── deadline.ts                        o tom do prazo pelo tempo que falta (puro, H3)
│   ├── deadline-badge.tsx                 selo do prazo, com o texto e a cor dos tokens
│   └── request-status-badge.tsx           movido de features/requests
└── lib/api.ts                             listRequests aceita { mine }
```

**Com quem conversa:** a página da home é um Server Component. Ela lê o membro (`signedInMember`), escolhe os blocos pela permissão e chama, em paralelo, só as listas desses blocos pelo `adminApi`, como as outras telas. Cada bloco recebe o resultado já lido: um bloco cuja chamada falhou mostra `block-error.tsx`, e os outros continuam. É um `Promise.allSettled`, e não um `Promise.all`, para que uma falha não derrube a home inteira.

## Concorrência

A home só lê. Um pedido decidido entre o carregamento da home e o clique abre a página do pedido, que mostra a situação atual e não oferece mais a decisão: é o comportamento de hoje, já testado (STF-09). A home é renderizada a cada visita (`no-store`), sem cache entre membros.

## Contratos

- **API** `GET /admin/v1/requests`:
  - entrada: `status` (`PENDING` ou `ALL`, como hoje), `cursor` (como hoje) e o novo `mine` (`true` ou `false`, padrão `false`), com o schema estrito, que recusa parâmetros desconhecidos;
  - saída: a mesma `ApprovalRequestsPage`;
  - erros: os de hoje (401, 403, 422); `mine` com outro valor → 422.
- **OpenAPI:** `openapi-admin.json` regenerado; o schema `ApprovalRequestsPage` não muda, só o parâmetro da operação `listRequests`. O contrato do app (`openapi.json`) não muda.
- **Banco:** o `LIST_SQL` ganha `AND ($7::uuid IS NULL OR r.requested_by = $7)`. O índice novo é `requests_requester_idx ON operations.requests (requested_by, requested_at DESC, id DESC)`, com o `EXPLAIN ANALYZE` registrado no PR.
- **Configuração:** nenhuma.

## Testes

| O que prova | Onde | Tipo |
|---|---|---|
| `mine=true` devolve só os pedidos do membro da sessão, pendentes ou todos | `request-routes.test.ts` | Integração, contra Postgres real, **antes da rota** |
| `mine=false` e sem `mine` devolvem a lista de hoje; `mine=talvez` → 422 | `request-routes.test.ts` | Integração |
| A equipe demo com `mine=true` continua só no escopo demo (STF-11) | `request-routes.test.ts` | Integração (segurança) |
| A query usa o índice | PR, `EXPLAIN ANALYZE` | Performance |
| Prazo: verde, âmbar e vermelho nos limites de 12 h e 4 h; vencido | `deadline.test.ts` | Unidade, TDD, relógio fixo |
| Saudação e data no fuso de Brasília, também às 23 h UTC | `greeting.test.ts` | Unidade, TDD |
| Fila: do mais antigo ao mais novo; "20+" quando a página vem cheia | `queue.test.ts` | Unidade, TDD |
| Blocos por papel: o operador não vê a fila de decisão, o analista não vê "Seus pedidos", o admin não chama nenhuma lista (STF-02) | `home.test.tsx` | Componente |
| A linha da fila não mostra CPF, e-mail nem saldo (STF-07) | `awaiting-decision.test.tsx` | Componente |
| Um bloco que falha mostra o aviso, e os outros aparecem | `home.test.tsx` | Componente |
| Fila vazia mostra "Nada esperando por você" | `awaiting-decision.test.tsx` | Componente |
| Olívia pede; a home de Diogo mostra o pedido; Diogo aprova a partir dela; a home de Olívia mostra "Aprovado" | `e2e/home.spec.ts` | E2E (Playwright) |

O layout dos blocos não tem TDD (CLAUDE.md); os testes de componente vêm depois do layout. Os commits mostram `test:` antes de `feat:` no filtro da API e nas funções puras.

## Tarefas

1. ✅ **API: o filtro `mine`.** Teste HTTP vermelho, migração do índice, query, rota, `EXPLAIN ANALYZE`, contrato regenerado.
2. ✅ **Funções puras** (`deadline`, `greeting`, `queue`), em TDD.
3. ✅ **Os blocos e a página.** Mover o selo de situação; o selo do prazo; os três blocos, o estado vazio e o aviso de erro; a página compondo pelo papel; os testes de componente.
4. ✅ **E2E** da fila de ponta a ponta.
5. ✅ **Documentação.** README (o passeio da equipe demo começa pela home), CHANGELOG em "Não publicado", roadmap (o item sai da seção 11) e a revisão do threat model registrada.

### O que mudou no caminho

- **H3, sem âmbar:** os tokens do design system não têm uma cor de atenção, e criar uma mexeria no `tokens.dart` do app, com a conferência de contraste, fora desta fatia. O selo do prazo distingue os tons pelo ícone e pelo peso, sempre com o texto: calmo em cinza com relógio, perto de vencer em texto forte com ampulheta, urgente em vermelho com alerta.
- **Testes do filtro num arquivo próprio** (`own-requests-routes.test.ts`): no arquivo das rotas de conta, os testes novos passaram do limite global de requisições do mesmo endereço (429). Cada arquivo de rota tem a sua instância da API e o seu limite.
- **O E2E da home estende o da dupla aprovação** (`approval.spec.ts`), em vez de um `home.spec.ts`: o pedido já nasce ali, e repetir o fluxo num arquivo novo seria só duplicação.
- **Os testes de componente** ficaram em `home-blocks.test.tsx` e `load-home.test.ts`, este com o que cada papel lê (STF-02).

`/security-review` antes do PR, porque a fatia mexe numa rota de autorização (o filtro de pedidos).

## Dependências novas

Nenhuma.

## Fora do escopo

- **Home do admin** (H5): um painel da equipe, com membros por papel e as mudanças recentes, pede desenho próprio.
- **Contagens exatas:** "20+" basta enquanto a demo tem poucos pedidos; uma contagem exata pede uma rota nova.
- **Gráficos e paleta de comandos (Ctrl+K):** são mais de ferramenta de gestão do que da tela de operação, e a paleta traria uma dependência nova.
- **Faixa de status dos sistemas:** a home não mostra a saúde da API; um bloco que não carrega já avisa.
- **Esconder "Bloquear" para Ana e Bruno:** continua em "Próximos passos", com fatia própria.
- **Versão:** a fatia entra em "Não publicado" no CHANGELOG, sem tag própria. Uma funcionalidade nova pediria uma versão minor, e a `v1.4.0` já é a das chaves Pix: ela sai junto com a próxima versão.
