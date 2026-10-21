# next bank — Checklist OWASP ASVS e MASVS (V1)

- **Status:** Aprovado (2026-10-05)
- **Uso:** status consolidado, com evidências e achados, em `controles-de-seguranca.md`. Cada item tem a semana em que é implementado ou a justificativa de estar fora da V1. Os IDs entre parênteses apontam para as ameaças do `threat-model.md`.
- **Nota:** os itens estão organizados pelos capítulos do OWASP ASVS (nível 2) e pelas categorias do OWASP MASVS v2, descritos com palavras próprias. A verificação formal requisito a requisito é feita na semana 8, contra a versão vigente dos padrões.

Legenda: ⏳ planejado · ✅ feito · 🚫 fora da V1 (risco aceito no threat model) · ➖ não se aplica

**Conferido item a item em 2026-10-13, antes da `v1.0.0`.** A evidência de cada item (teste, gate do CI ou verificação) está na matriz `controles-de-seguranca.md`.

## OWASP ASVS — API (nível 2)

### Arquitetura e design
| Item | Status | Sem. |
|---|---|---|
| Threat model mantido e revisado a cada feature | ✅ | 1+ |
| Controles de segurança centralizados (auth, autorização, validação) e não espalhados | ✅ | 2 |
| Fronteiras entre módulos verificadas automaticamente | ✅ | 2 |

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
| Operações idempotentes e resistentes a concorrência (PIX-02, PIX-03) | ✅ | 5 |

### API e serviços web
| Item | Status | Sem. |
|---|---|---|
| CORS negado por padrão (o app mobile não precisa) | ✅ | 2 |
| Documentação OpenAPI sem dados reais | ✅ | 2 |

### Configuração e cadeia de suprimentos
| Item | Status | Sem. |
|---|---|---|
| Dependências com lockfile e varredura de vulnerabilidades (API-09) | ✅ | 2 |
| Segredos fora do repositório; varredura de segredos (API-08) | ✅ | 2 |
| Pipeline com permissões mínimas e actions fixadas por SHA (API-09) | ✅ | 2 |
| Modo debug e endpoints de diagnóstico desligados em produção (conferido na API publicada: sem rota de documentação ou diagnóstico, erros sem detalhe interno) | ✅ | 8 |

## OWASP MASVS v2 — App Flutter

| Categoria | Item | Status | Sem. |
|---|---|---|---|
| **STORAGE** | Tokens só em Keychain/Keystore (MOB-01) | ✅ | 3 |
| | Nada sensível em logs, cache ou preferências (MOB-02) | ✅ | 2+ |
| **CRYPTO** | Nenhuma criptografia caseira; nenhuma chave embutida no app (MOB-04) | ✅ | 2+ |
| **AUTH** | Autenticação e autorização decididas no servidor | ✅ | 3 |
| | PIN validado no servidor; biometria só como conveniência local (PIX-06) | ✅ | 3, 6 (biometria: extra, D4) |
| | Desbloqueio após tempo em segundo plano (D5) | ✅ | 5, 6 (F-16, F-21) |
| **NETWORK** | Só HTTPS; tráfego em texto puro desabilitado (MOB-03) | ✅ | 2 |
| | Certificate pinning | 🚫 | — |
| **PLATFORM** | Sem deep links na V1: desligados no Android e no iOS (MOB-06) | ✅ | 3 |
| | Proteção de telas sensíveis contra captura: o app inteiro no release (MOB-14) | ✅ | v1.1.0 (tarefa 7) |
| | Opção de ocultar saldo (MOB-05) | ✅ | 4 |
| **CODE** | Dependências atualizadas e verificadas (API-09) | ✅ | 2 |
| | Validação de dados vindos da API antes do uso | ✅ | 2, 4, 6 |
| **RESILIENCE** | Build de release ofuscado (MOB-04) | ✅ | 8 |
| | Verificação de integridade do app (Play Integrity / App Attest) | 🚫 | — |
| **PRIVACY** | Coleta mínima de dados; Sentry sem PII (MOB-02) | ✅ | 2 |
