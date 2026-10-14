# 0013 — Rosto (biometria fraca) só para abrir o app

- **Status:** Aceito
- **Data:** 2026-10-14

## Contexto

Na v1.1.0 (tarefa 2), o PIN de transação fica guardado atrás de uma chave do Android Keystore que só se abre com biometria **forte** (classe 3) e morre quando uma biometria nova é cadastrada (MOB-11). O desenvolvedor pediu o reconhecimento facial também. No S21 de referência, o rosto é biometria **fraca** (classe 2: só a câmera frontal, sem sensor de profundidade), e o Android não deixa biometria fraca abrir chave do Keystore. A ADR 0004 já trata a biometria como conveniência local: o servidor nunca a verifica.

## Opções consideradas

1. **Não oferecer o rosto.** Nenhum risco novo; mas o aparelho de referência fica só com a digital, e o pedido do desenvolvedor não é atendido.
2. **Rosto também no Pix.** O PIN sairia da chave forte para uma chave comum, liberada depois de uma checagem fraca. Uma foto ou um vídeo do cliente poderia autorizar um Pix: contraria a MOB-11 e a prioridade Segurança > entrega.
3. **Rosto só para abrir o app.** A checagem fraca destrava a tela localmente; o Pix continua exigindo a chave forte ou o PIN conferido no servidor.

## Decisão

**Opção 3.** "Acessar conta" usa a janela de biometria do Android aceitando fraca ou forte (`local_auth`, `biometricOnly: true`) e, aprovada, destrava o app sem chamar o servidor. O rosto só é oferecido enquanto há PIN guardado, ou seja, depois de o cliente ativar a biometria com o PIN; sair, trocar o PIN, bloqueá-lo ou desativar a biometria desligam o rosto junto. A confirmação do Pix não muda.

## Consequências

- ➕ O cliente abre o app com o rosto no S21, como pediu o desenvolvedor
- ➕ Dinheiro só se move com a chave forte ou com o PIN conferido no servidor
- ➖ Quem engana o rosto (foto, vídeo, pessoa parecida) vê saldo, extrato e perfil, sem mover dinheiro: risco aceito pelo desenvolvedor (MOB-13)
- ➖ O Android não avisa quando um rosto novo é cadastrado: quem conhece o desbloqueio do celular pode cadastrar o próprio rosto e abrir o app (mas não pagar)
- ➖ O desbloqueio por biometria deixa de passar pelo servidor: um PIN guardado desatualizado só é percebido no próximo Pix
