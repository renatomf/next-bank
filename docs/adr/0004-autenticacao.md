# 0004 — Autenticação com JWT EdDSA, refresh rotativo e PIN no servidor

- **Status:** Aceito
- **Data:** 2026-10-05

## Contexto

O cliente se autentica num app mobile e precisa permanecer logado por dias, sem que um token roubado dê acesso ilimitado. Operações financeiras exigem uma confirmação adicional que o servidor consiga verificar. Para um banco, identidade é parte do domínio central, não um detalhe de infraestrutura.

## Opções consideradas

1. **Provedor de identidade gerenciado** (Auth0, Clerk, Cognito, Neon Auth) — reduz o código próprio de segurança; mas terceiriza uma parte central do domínio, dificulta regras específicas (PIN de transação, revogação por reuso) e esconde justamente a engenharia de segurança que o projeto quer demonstrar.
2. **Sessão com cookie** — revogação simples; mas é pensada para navegadores e é desajeitada em apps mobile.
3. **Token de longa duração** — simples; mas um vazamento dá acesso por semanas.
4. **Access token curto + refresh token opaco e rotativo + PIN de transação no servidor.**

## Decisão

**Opção 4.**

- **Access token:** JWT assinado com **EdDSA (Ed25519)**, válido por **15 min**, com algoritmo fixo, `kid` para rotação de chave e validação de `iss`, `aud`, `exp` e `nbf`.
- **Refresh token:** valor opaco de 256 bits, guardado no servidor apenas como hash, **rotacionado a cada uso**. A reapresentação de um token já substituído (fora de uma janela de 10 s) revoga a sessão inteira.
- **Sessões:** expiram após 7 dias sem uso ou 30 dias no total; logout revoga a sessão; troca de senha revoga todas.
- **Senhas:** Argon2id; de 10 a 128 caracteres; lista de senhas comuns; sem regras de composição.
- **PIN de transação:** 4 dígitos, validado **no servidor** em todo Pix; 5 erros bloqueiam por 30 min. **A biometria é só uma conveniência local**: ela libera o PIN guardado no Keychain/Keystore, mas não é um controle de segurança, porque o servidor não consegue verificá-la.

## Consequências

- ➕ Token roubado tem vida curta; refresh roubado é detectado no primeiro reuso
- ➕ Pix exige um fator que o servidor verifica, mesmo com a sessão comprometida
- ➕ Regras de identidade específicas do domínio, sob controle total e testadas
- ➖ Todo o risco de segurança da autenticação é nosso; exige a suíte de testes de segurança do threat model
- ➖ Access token continua válido por até 15 min após a revogação (mitigação: operações sensíveis verificam a sessão no banco)
- ➖ Sem segundo fator no login na V1 (risco aceito no threat model)

## Referências

- `docs/security/threat-model.md` (AUTH-01 a AUTH-09, PIX-05, PIX-06; decisões D4–D7)
- `docs/architecture/domain-model.md` (agregados `Session` e `TransactionPin`)
