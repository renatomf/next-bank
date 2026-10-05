# next bank — Diagramas de sequência

Os dois fluxos mais sensíveis da V1, passo a passo. As regras de cada passo estão no [modelo de domínio](domain-model.md), no [desenho do banco](database.md) e no [threat model](../security/threat-model.md).

## 1. Login e renovação de sessão (com detecção de reuso)

```mermaid
sequenceDiagram
    autonumber
    actor C as Cliente
    participant App as App Flutter
    participant API as API (Identity)
    participant DB as PostgreSQL

    C->>App: e-mail + senha
    App->>API: POST /auth/login
    API->>API: rate limit (IP e conta)
    API->>DB: busca usuário por e-mail
    alt usuário inexistente
        API->>API: Argon2id com hash fictício (mesmo tempo de resposta)
        API-->>App: 401 "E-mail ou senha incorretos"
    else senha incorreta
        API->>DB: auditoria LOGIN_FAILED
        API-->>App: 401 "E-mail ou senha incorretos"
    else senha correta
        API->>DB: cria sessão + refresh token (só o hash)
        API->>DB: auditoria LOGIN_SUCCEEDED, SESSION_CREATED
        API-->>App: access token (EdDSA, 15 min) + refresh token
        App->>App: guarda tokens no Keychain/Keystore
    end

    Note over App,API: 15 minutos depois, o access token expira

    App->>API: requisição com access token expirado
    API-->>App: 401
    App->>API: POST /auth/refresh (refresh token)
    API->>DB: busca o hash do token (FOR UPDATE)
    alt token atual e sessão ativa
        API->>DB: marca o token como substituído e cria um novo
        API-->>App: novo access token + novo refresh token
        App->>API: repete a requisição original
    else token já substituído, dentro da janela de 10 s
        API-->>App: devolve o mesmo par novo (falha de rede, não ataque)
    else token já substituído, fora da janela
        API->>DB: revoga a sessão inteira
        API->>DB: auditoria REFRESH_REUSE_DETECTED
        API-->>App: 401
        App->>C: "Por segurança, entre novamente"
    end
```

**Pontos de atenção**
- **Passos 5–6:** usuário inexistente e senha errada são indistinguíveis, inclusive no tempo de resposta (AUTH-02).
- **Refresh concorrente no app:** várias requisições com `401` disparam **um único** refresh (fila no interceptor); as demais esperam e reaproveitam o novo token.
- **Reuso detectado:** quem roubou o token e quem é o dono perdem a sessão; o dono entra de novo com a senha, o atacante não.

## 2. Pix interno: criar, autorizar com PIN e concluir

```mermaid
sequenceDiagram
    autonumber
    actor C as Cliente
    participant App as App Flutter
    participant API as API (Payments)
    participant LED as Ledger (porta)
    participant DB as PostgreSQL

    C->>App: chave Pix + valor
    App->>App: gera Idempotency-Key (UUID) para esta tentativa
    App->>API: POST /pix/transfers (Idempotency-Key)
    API->>API: valida schema (valor inteiro em centavos > 0)
    API->>DB: resolve a chave (índice cego) → conta recebedora
    API->>API: pré-checagem de saldo e limite (aviso antecipado)
    API->>DB: cria Pix em AWAITING_AUTH (expira em 10 min)
    API-->>App: 201 + nome do recebedor e documento mascarado
    App->>C: tela "Revisar Pix"

    C->>App: confirma com PIN (ou biometria, que libera o PIN guardado)
    App->>API: POST /pix/transfers/{id}/authorize (PIN, nova Idempotency-Key)

    rect rgba(0, 255, 200, 0.08)
    Note over API,DB: Uma única transação de banco
    API->>DB: registra a chave de idempotência (espera se houver outra igual em andamento)
    API->>DB: Pix FOR UPDATE (dono, status, expiração)
    API->>DB: PIN FOR UPDATE (verifica e conta tentativas)
    API->>DB: contas FOR SHARE (ambas ativas?)
    API->>LED: postar lançamento
    LED->>DB: contas contábeis FOR UPDATE, em ordem de ID
    LED->>LED: saldo disponível ≥ valor? limite de horário (relógio do servidor)
    LED->>DB: lançamento + partidas (débito A, crédito B) + saldos + versão
    API->>DB: Pix → COMPLETED
    API->>DB: auditoria PIX_COMPLETED + resposta guardada na idempotência
    API->>DB: COMMIT (verifica Σ débitos = Σ créditos)
    end

    API-->>App: 200 + comprovante (ID de ponta a ponta)
    App->>C: tela "Comprovante"
```

**Caminhos alternativos (todos gravam o efeito e fazem COMMIT, sem lançamento no ledger)**

| Situação | Resultado |
|---|---|
| PIN incorreto | `422 PinIncorrect` com tentativas restantes; Pix continua em `AWAITING_AUTH` |
| 5º erro de PIN | `423 PinLocked`; Pix vai para `CANCELLED` |
| Saldo insuficiente ou limite excedido | Pix vai para `FAILED` com o motivo |
| Mais de 10 minutos | `409 TransferExpired`; Pix vai para `CANCELLED` |
| Mesma requisição repetida (falha de rede) | Mesma resposta da primeira vez; nenhum lançamento novo |
| Pix de outro cliente | `404`, sem revelar que o Pix existe |

**Por que esse desenho**
- **Duas checagens de saldo e limite:** a primeira avisa cedo; a segunda, dentro da transação e com lock, é a que vale.
- **Locks em ordem de ID:** um Pix A→B e outro B→A ao mesmo tempo não travam um ao outro.
- **Só falha técnica faz rollback:** aí a chave de idempotência também some, e o app pode tentar de novo com segurança.
