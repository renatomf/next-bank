# next bank — Checklist OWASP ASVS e MASVS (V1)

- **Status:** Aprovado (2026-10-05)
- **Uso:** status consolidado, com evidências e achados, em `controles-de-seguranca.md`. Cada item tem a semana em que é implementado ou a justificativa de estar fora da V1. Os IDs entre parênteses apontam para as ameaças do `threat-model.md`.
- **Nota:** os itens estão organizados pelos capítulos do OWASP ASVS (nível 2) e pelas categorias do OWASP MASVS v2, descritos com palavras próprias. A verificação formal requisito a requisito é feita na semana 8, contra a versão vigente dos padrões.

Legenda: ⏳ planejado · ✅ feito · 🚫 fora da V1 (risco aceito no threat model) · ➖ não se aplica

**Conferido item a item em 2026-11-03, antes da `v1.3.0`**, com a seção nova do backoffice (as anteriores, de 2026-11-01, 2026-10-21 e 2026-10-13, foram antes da `v1.2.0`, da `v1.1.0` e da `v1.0.0`). A evidência de cada item (teste, gate do CI ou verificação) está na matriz `controles-de-seguranca.md`.

## OWASP ASVS — API (nível 2)

### Arquitetura e design
| Item | Status | Sem. |
|---|---|---|
| Threat model mantido e revisado a cada feature | ✅ | 1+ |
| Controles de segurança centralizados (auth, autorização, validação) e não espalhados | ✅ | 2 |
| Fronteiras entre módulos verificadas automaticamente | ✅ | 2 |
| O parceiro simulado isolado: só HTTP e webhook assinado, papel próprio no banco, sem ler os schemas da API (EXT-09, ADR 0017) | ✅ | v1.2.0 |

### Autenticação
| Item | Status | Sem. |
|---|---|---|
| Senha com mínimo de 10 e máximo de 128 caracteres; lista de senhas comuns; sem regras de composição (AUTH-07) | ✅ | 3 |
| Hash de senha com Argon2id nos parâmetros recomendados (AUTH-08) | ✅ | 3 |
| Proteção contra força bruta e credential stuffing (AUTH-01) | ✅ | 3 |
| Mesma resposta e tempo para usuário inexistente e senha errada (AUTH-02) | ✅ | 3 |
| Troca de senha exige a senha atual e encerra as outras sessões (AUTH-06) | ✅ | 7 |
| Segundo fator de autenticação | 🚫 | — |

### Sessão
| Item | Status | Sem. |
|---|---|---|
| Tokens com alta entropia; refresh guardado como hash (AUTH-03) | ✅ | 3 |
| Rotação de refresh token com detecção de reuso (AUTH-03) | ✅ | 3 |
| Expiração por inatividade e absoluta (D5) | ✅ | 3 |
| Logout e revogação efetivos no servidor (AUTH-06) | ✅ | 3 |
| Cliente vê e encerra as próprias sessões (tela Segurança; `GET /v1/me/sessions` e `POST /v1/me/sessions/{id}/revoke`, com teste de IDOR) | ✅ | 7 |
| JWT com algoritmo fixo e validação completa de claims (AUTH-05) | ✅ | 3 |

### Controle de acesso
| Item | Status | Sem. |
|---|---|---|
| Negar por padrão; toda rota declara sua regra de acesso | ✅ | 2 |
| Verificação de dono em todo recurso; recurso alheio → 404 (PIX-01, READ-01) | ✅ | 4–6 |
| Identificadores de conta nunca vêm do cliente (PIX-04, READ-01) | ✅ | 4–6 |
| Operações sensíveis exigem nova verificação (PIN no servidor) (PIX-05, PIX-06) | ✅ | 3, 5 |

### Validação de entrada e codificação
| Item | Status | Sem. |
|---|---|---|
| Schemas estritos em toda entrada; campos desconhecidos recusados (PIX-04) | ✅ | 2+ |
| Valores monetários como inteiros validados (PIX-04) | ✅ | 4–5 |
| Só queries parametrizadas (API-01) | ✅ | 2+ |
| Limite de tamanho de corpo (API-02) | ✅ | 2 |

### Criptografia em repouso
| Item | Status | Sem. |
|---|---|---|
| Dados pessoais sensíveis cifrados com AES-256-GCM (API-06) | ✅ | 3 |
| Chaves fora do código e com versão para rotação | ✅ | 3 |
| Chaves em KMS/HSM | 🚫 | — |
| Só bibliotecas criptográficas consolidadas; geração de aleatórios segura | ✅ | 3 |

### Erros, logs e auditoria
| Item | Status | Sem. |
|---|---|---|
| Erros genéricos ao cliente (RFC 7807), sem detalhes internos (API-03) | ✅ | 2 |
| Logs estruturados sem dados sensíveis (API-04, API-10) | ✅ | 2 |
| Eventos de segurança auditados (login, falhas, PIN, sessões, Pix) (PIX-09) | ✅ | 3–5 |
| Auditoria imutável (API-05) | ✅ | 4 |
| Trace de ponta a ponta sem dado pessoal: atributos por lista de permitidos, só os spans da API e do simulador, `traceparent` de fora só de parceiro; nada exportado em produção (EXT-07, EXT-10) | ✅ | v1.2.0 (tarefa 8) |

### Proteção de dados
| Item | Status | Sem. |
|---|---|---|
| Respostas só com campos necessários; documentos mascarados (READ-02) | ✅ | 4–6 |
| Dados sensíveis fora de URLs e de cache HTTP (`Cache-Control: no-store`) | ✅ | 2 |
| Minimização de dados pessoais (LGPD) | ✅ | 1+ |

### Comunicação
| Item | Status | Sem. |
|---|---|---|
| TLS em todas as conexões, inclusive com o banco (`verify-full`) (API-07) | ✅ | 2 |
| HSTS e headers de segurança | ✅ | 2 |

### Lógica de negócio
| Item | Status | Sem. |
|---|---|---|
| Fluxos em ordem e sem pular etapas (máquina de estados do Pix) (PIX-08) | ✅ | 5 |
| Limites de negócio no servidor, com horário do servidor (PIX-10) | ✅ | 5 |
| Proteção contra automação abusiva (rate limits) (AUTH-09, PIX-07) | ✅ | 3, 5 |
| Operações idempotentes e resistentes a concorrência (PIX-02, PIX-03); a recarga com o saldo e o limite do dia sob requisições simultâneas (TOP-02) | ✅ | 5, v1.1.0 |
| Limite diário da recarga somado no dia de São Paulo, com o relógio do servidor (TOP-02) | ✅ | v1.1.0 (tarefa 5) |
| Pix agendado: PIN ao agendar, cada ocorrência paga uma vez só e nunca depois de cancelada (EXT-05, EXT-06) | ✅ | v1.2.0 (tarefa 7) |

### API e serviços web
| Item | Status | Sem. |
|---|---|---|
| CORS negado por padrão (o app mobile não precisa) | ✅ | 2 |
| Documentação OpenAPI sem dados reais | ✅ | 2 |

### Integrações com parceiros (v1.2.0)
| Item | Status | Sem. |
|---|---|---|
| Webhook autenticado por HMAC com carimbo de tempo, comparado em tempo constante (EXT-01) | ✅ | v1.2.0 (tarefa 4) |
| Webhook repetido ou fora de ordem aplicado uma vez (inbox, estado final) (EXT-02) | ✅ | v1.2.0 (tarefa 4) |
| Timeout não reenvia às cegas: consulta de status pelo id de ponta a ponta (EXT-03) | ✅ | v1.2.0 (tarefas 3 e 4) |
| Entrega com novas tentativas e limite; estorno só com a recusa confirmada (EXT-08, D6) | ✅ | v1.2.0 (tarefas 2 a 4) |
| Conciliação diária contra o arquivo do parceiro; toda divergência vira exceção (EXT-04) | ✅ | v1.2.0 (tarefa 6) |
| Chamada ao parceiro com chave própria, só para o `127.0.0.1` ou por HTTPS (EXT-09) | ✅ | v1.2.0 (tarefa 3) |
| Teste de caos: falhas injetadas não duplicam nem perdem dinheiro (job obrigatório no CI) | ✅ | v1.2.0 (tarefa 9) |

### Configuração e cadeia de suprimentos
| Item | Status | Sem. |
|---|---|---|
| Dependências com lockfile e varredura de vulnerabilidades (API-09) | ✅ | 2 |
| Segredos fora do repositório; varredura de segredos (API-08) | ✅ | 2 |
| Pipeline com permissões mínimas e actions fixadas por SHA (API-09) | ✅ | 2 |
| Modo debug e endpoints de diagnóstico desligados em produção (conferido na API publicada: sem rota de documentação ou diagnóstico, erros sem detalhe interno) | ✅ | 8 |

## OWASP ASVS — Backoffice web (nível 2, v1.3.0)

O backoffice da equipe (Next.js na Vercel) e as rotas `/admin/v1` da API (plano `v1.3.0-backoffice.md`). As ameaças estão no threat model, seção 5.9 (STF-01 a STF-16).

### Arquitetura
| Item | Status | Sem. |
|---|---|---|
| O servidor do backoffice é o BFF: a chave da API e o token da equipe nunca chegam ao navegador, e o cliente da API não compila para o navegador (B2, STF-08) | ✅ | v1.3.0 |
| Contrato próprio das rotas da equipe (`openapi-admin.json`), com o mesmo gate de divergência do app (B8) | ✅ | v1.3.0 |

### Autenticação
| Item | Status | Sem. |
|---|---|---|
| MFA obrigatório para toda a equipe (TOTP), com uma só resposta para qualquer fator errado e cada código valendo uma vez (STF-01) | ✅ | v1.3.0 |
| Senha em Argon2id e segredo TOTP cifrado; bloqueio progressivo por tentativas (STF-01) | ✅ | v1.3.0 |
| Credenciais de um membro novo mostradas uma vez, fora dos logs e de qualquer registro guardado (STF-15) | ✅ | v1.3.0 |

### Sessão
| Item | Status | Sem. |
|---|---|---|
| Cookie da sessão `httpOnly`, `Secure` e `SameSite=Strict`, conferido no navegador (STF-06) | ✅ | v1.3.0 |
| 15 minutos sem uso e 8 horas no máximo; logout e desativação encerram a sessão no servidor (STF-06) | ✅ | v1.3.0 |

### Controle de acesso
| Item | Status | Sem. |
|---|---|---|
| Papel lido do banco a cada requisição, negar por padrão, permissão declarada por rota (STF-02) | ✅ | v1.3.0 |
| Segregação de funções: quem pede nunca aprova, na API e na tela (STF-03; E2E) | ✅ | v1.3.0 |
| Escopo da equipe demo: só clientes, pedidos, exceções e membros de demonstração; fora dele, 404 (STF-11) | ✅ | v1.3.0 |
| O admin não lê dados de cliente (C1); ninguém muda o próprio papel nem mexe num admin (STF-14) | ✅ | v1.3.0 |

### Validação, codificação e CSRF
| Item | Status | Sem. |
|---|---|---|
| Toda entrada das rotas `/admin` validada na borda (Zod), com corpos estritos | ✅ | v1.3.0 |
| Saída escapada pelo React; CSP com `nonce` e sem `unsafe-inline`; `dangerouslySetInnerHTML` recusado pelo Semgrep (STF-05) | ✅ | v1.3.0 |
| Server Actions com checagem de origem e nenhuma mutação por `GET`; outra origem recusada no navegador (STF-04; E2E) | ✅ | v1.3.0 |

### Logs e auditoria
| Item | Status | Sem. |
|---|---|---|
| Todo comando da equipe e toda leitura de dados de cliente na trilha, na mesma transação (STF-07, STF-10) | ✅ | v1.3.0 |
| Trilha consultável só por filtro e no escopo de quem lê (STF-16) | ✅ | v1.3.0 |

### Comunicação e configuração
| Item | Status | Sem. |
|---|---|---|
| HTTPS com HSTS (`max-age` de 2 anos, `preload`), `X-Frame-Options: DENY` e `Referrer-Policy: no-referrer` | ✅ | v1.3.0 |
| Prévias da Vercel sem as variáveis de produção: não alcançam a API (D3) | ✅ | v1.3.0 |
| ZAP baseline contra o backoffice publicado sem falhas (avisos explicados na matriz, seção 4) | ✅ | v1.3.0 |

## OWASP MASVS v2 — App Flutter

| Categoria | Item | Status | Sem. |
|---|---|---|---|
| **STORAGE** | Tokens só em Keychain/Keystore (MOB-01) | ✅ | 3 |
| | Nada sensível em logs, cache ou preferências (MOB-02); o número da recarga nunca vai para log nem para o Sentry (TOP-01) | ✅ | 2+, v1.1.0 |
| | Comprovante compartilhado com os mesmos dados mascarados da tela e o arquivo apagado logo depois (MOB-09) | ✅ | v1.1.0 (tarefa 1) |
| **CRYPTO** | Nenhuma criptografia caseira; nenhuma chave embutida no app (MOB-04) | ✅ | 2+ |
| **AUTH** | Autenticação e autorização decididas no servidor | ✅ | 3 |
| | PIN validado no servidor; biometria só como conveniência local que libera o PIN guardado com biometria forte, nunca o rosto (PIX-06, MOB-11, MOB-13) | ✅ | 3, 6; biometria na v1.1.0 (tarefa 2) |
| | Antes do desbloqueio, nenhum dado da conta além do primeiro nome (MOB-12) | ✅ | v1.1.0 (tarefa 2) |
| | Desbloqueio após tempo em segundo plano (D5) | ✅ | 5, 6 (F-16, F-21) |
| **NETWORK** | Só HTTPS; tráfego em texto puro desabilitado (MOB-03) | ✅ | 2 |
| | Certificate pinning | 🚫 | — |
| **PLATFORM** | Sem deep links na V1: desligados no Android e no iOS (MOB-06); o QR Code lido só preenche o Pix, nunca abre uma tela (PIX-13) | ✅ | 3, v1.1.0 |
| | Câmera pedida só ao abrir a leitura do QR Code; recusa leva ao "Copia e Cola" (MOB-10) | ✅ | v1.1.0 (tarefa 4) |
| | Proteção de telas sensíveis contra captura: o app inteiro no release (MOB-14) | ✅ | v1.1.0 (tarefa 7) |
| | Opção de ocultar saldo (MOB-05) | ✅ | 4 |
| **CODE** | Dependências atualizadas e verificadas (API-09) | ✅ | 2 |
| | Validação de dados vindos da API antes do uso; estado ou tipo desconhecido tolerado sem quebrar a tela | ✅ | 2, 4, 6, v1.2.0 (tarefa 5) |
| **RESILIENCE** | Build de release ofuscado (MOB-04) | ✅ | 8 |
| | Verificação de integridade do app (Play Integrity / App Attest) | 🚫 | — |
| **PRIVACY** | Coleta mínima de dados; Sentry sem PII (MOB-02) | ✅ | 2 |
