# next bank — Galeria de telas

Todas as telas do app e do backoffice, organizadas por área, com o que cada uma mostra e o que há por trás dela. Os dados são fictícios: as contas de demonstração (Ana, Bruno e Carla) e a equipe de demonstração (Olívia e Diogo).

[← Voltar ao README](../../README.md)

- [App](#app)
  - [Entrada](#entrada)
  - [Home](#home)
  - [Pix](#pix)
  - [Extrato e recarga](#extrato-e-recarga)
  - [Perfil e segurança](#perfil-e-segurança)
  - [Outras telas](#outras-telas)
- [Backoffice](#backoffice)
  - [Entrada e homes](#entrada-e-homes)
  - [Clientes](#clientes)
  - [Pedidos e dupla aprovação](#pedidos-e-dupla-aprovação)
  - [Conciliação, auditoria e equipe](#conciliação-auditoria-e-equipe)

---

## App

Flutter, Android. O app segue o tema do aparelho: as telas estão no escuro, e algumas também no claro.

### Entrada

| | | |
|:---:|:---:|:---:|
| <img src="app/01-splash.jpg" width="220" alt="Splash no tema escuro"> | <img src="app/02-splash-claro.jpg" width="220" alt="Splash no tema claro"> | <img src="app/03-login.jpg" width="220" alt="Login"> |
| **Splash**, nativa, nas cores da marca | **Splash** no tema claro | **Login** com e-mail e senha; tentativas erradas têm bloqueio progressivo no servidor |

### Home

| | | |
|:---:|:---:|:---:|
| <img src="app/04-home.jpg" width="220" alt="Home com o saldo escondido"> | <img src="app/05-home-saldo.jpg" width="220" alt="Home com o saldo visível"> | <img src="app/06-home-saldo-claro.jpg" width="220" alt="Home no tema claro"> |
| **Home** com o saldo escondido, como abre | **Saldo disponível**, lido do ledger, nunca calculado no app | **Home** no tema claro |

### Pix

| | | |
|:---:|:---:|:---:|
| <img src="app/10-pix-enviar.jpg" width="220" alt="Enviar Pix"> | <img src="app/11-pix-favorecido.jpg" width="220" alt="Favorecido encontrado"> | <img src="app/12-pix-favorecido-claro.jpg" width="220" alt="Favorecido no tema claro"> |
| **Enviar Pix:** valor e chave | **Favorecido** como o DICT devolve, com o CPF mascarado | O mesmo, no tema claro |
| <img src="app/13-pix-revisao-pin.jpg" width="220" alt="Revisão com PIN"> | <img src="app/14-pix-comprovante.jpg" width="220" alt="Comprovante"> | <img src="app/15-pix-comprovante-claro.jpg" width="220" alt="Comprovante no tema claro"> |
| **Revisão:** o PIN é conferido no servidor; o pedido leva uma `Idempotency-Key`, e repetir não duplica | **Comprovante**, compartilhável como imagem, com o aviso de que é fictício | O mesmo, no tema claro |
| <img src="app/16-pix-agendar.jpg" width="220" alt="Agendar Pix"> | <img src="app/17-pix-agendamentos.jpg" width="220" alt="Agendamentos"> | <img src="app/18-pix-receber-qr-code.jpg" width="220" alt="Receber por QR Code"> |
| **Agendar:** numa data, ou todo mês, autorizado com o PIN uma vez só | **Agendamentos**, executados por um laço em segundo plano na API | **Receber:** QR Code no padrão BR Code, com chave aleatória |
| <img src="app/19-pix-pagar-qr-code.jpg" width="220" alt="Pagar por QR Code"> | <img src="app/20-pix-transferir.jpg" width="220" alt="Transferir"> | <img src="app/21-pix-minhas-chaves.jpg" width="220" alt="Minhas chaves"> |
| **Pagar por QR Code** ou Copia e Cola; o nome exibido é o do servidor, nunca o do QR (na captura, sem a imagem da câmera) | **Transferir** | **Minhas chaves**: só layout por ora, vem na `v1.4.0` |

### Extrato e recarga

| | | |
|:---:|:---:|:---:|
| <img src="app/30-extrato.jpg" width="220" alt="Extrato"> | <img src="app/31-extrato-detalhe.jpg" width="220" alt="Detalhe de um lançamento"> | <img src="app/40-recarga.jpg" width="220" alt="Recarga de celular"> |
| **Extrato** com filtros e busca feitos no servidor | **Detalhe** de um lançamento, que leva ao comprovante | **Recarga de celular**, com operadoras fictícias |

### Perfil e segurança

| | | |
|:---:|:---:|:---:|
| <img src="app/60-menu.jpg" width="220" alt="Menu"> | <img src="app/61-perfil.jpg" width="220" alt="Perfil"> | <img src="app/62-seguranca.jpg" width="220" alt="Segurança"> |
| **Menu** | **Perfil** | **Segurança:** biometria e troca de PIN e de senha |
| <img src="app/63-trocar-pin.jpg" width="220" alt="Trocar PIN"> | <img src="app/64-trocar-senha.jpg" width="220" alt="Trocar senha"> | <img src="app/65-tema.jpg" width="220" alt="Tema"> |
| **Trocar PIN** | **Trocar senha** | **Tema** do app |

<details>
<summary><b>Mais telas do perfil</b></summary>

| | | |
|:---:|:---:|:---:|
| <img src="app/66-dados-pessoais.jpg" width="220" alt="Dados pessoais"> | <img src="app/67-conta-compartilhada.jpg" width="220" alt="Conta compartilhada"> | <img src="app/68-convidar-amigos.jpg" width="220" alt="Convidar amigos"> |
| **Dados pessoais** | **Conta compartilhada** (só layout) | **Convidar amigos** (só layout) |

</details>

### Outras telas

| | | |
|:---:|:---:|:---:|
| <img src="app/50-cartoes.jpg" width="220" alt="Cartões"> | <img src="app/51-investimentos.jpg" width="220" alt="Investimentos"> | <img src="app/22-pix-automatico.jpg" width="220" alt="Pix Automático"> |
| **Cartões:** só interface, o cartão de verdade vem na `v2.0.0` | **Investimentos** (só layout, valores marcados como "Exemplo") | **Pix Automático** (só layout) |
| <img src="app/70-notificacoes.jpg" width="220" alt="Notificações"> | <img src="app/72-ajuda.jpg" width="220" alt="Ajuda"> | <img src="app/73-assistente.jpg" width="220" alt="Assistente"> |
| **Notificações** (só layout) | **Ajuda** | **Assistente** ("Em breve") |

<details>
<summary><b>Ajustes de notificações</b></summary>

<img src="app/71-notificacoes-ajustes.jpg" width="220" alt="Ajustes de notificações">

</details>

---

## Backoffice

Next.js, no navegador da equipe. A tela muda conforme o papel: **operadora** (Olívia) pede, **analista** (Diogo) decide, **admin** cuida da equipe e não vê clientes.

### Entrada e homes

| | |
|:---:|:---:|
| <img src="backoffice/01-login.jpg" alt="Login da equipe"> | <img src="backoffice/02-home-analista.jpg" alt="Home do analista"> |
| **Login** com e-mail, senha e código do autenticador (MFA obrigatório) | **Home do analista:** a fila do que espera a decisão dele, com o tempo até o pedido vencer |
| <img src="backoffice/03-home-operadora-claro.jpg" alt="Home da operadora no tema claro"> | <img src="backoffice/04-home-admin.jpg" alt="Home do admin"> |
| **Home da operadora** (tema claro): os pedidos que ela abriu e como terminaram | **Home do admin:** equipe e auditoria, nada de clientes (segregação de funções) |
| <img src="backoffice/06-menu-recolhido.jpg" alt="Barra lateral recolhida"> | <img src="backoffice/05-home-celular.jpg" width="260" alt="Home no celular"> |
| **Barra lateral recolhida**, lembrada entre as visitas | **No celular**, a mesma home |

### Clientes

| | |
|:---:|:---:|
| <img src="backoffice/10-clientes-busca.jpg" alt="Busca de clientes"> | <img src="backoffice/11-cliente-ficha.jpg" alt="Ficha do cliente"> |
| **Busca** por CPF, e-mail, conta ou começo do nome; o termo vai por POST, nunca na URL | **Ficha:** CPF e e-mail mascarados, saldo e extrato; cada consulta vira um evento na auditoria |
| <img src="backoffice/12-cliente-pedir-estorno.jpg" alt="Pedir estorno de um Pix"> | <img src="backoffice/13-cliente-bloquear.jpg" alt="Bloquear a conta"> |
| **Estorno de Pix**, pedido a partir do extrato: pelo valor do próprio Pix, nunca digitado | **Bloqueio**, imediato: encerra todas as sessões do cliente na hora |
| <img src="backoffice/14-cliente-bloqueado-pedir-desbloqueio.jpg" alt="Conta bloqueada e pedido de desbloqueio"> | |
| **Desbloqueio** não é imediato: vira um pedido para outra pessoa aprovar | |

### Pedidos e dupla aprovação

| | |
|:---:|:---:|
| <img src="backoffice/20-pedido-visto-por-quem-pediu.jpg" alt="Pedido visto por quem pediu"> | <img src="backoffice/21-pedido-para-decidir.jpg" alt="Pedido visto pelo analista"> |
| **Quem pediu** não vê como aprovar, só como cancelar; a API também recusa (STF-03) | **O analista** decide, com o efeito da aprovação dito antes |
| <img src="backoffice/23-pedido-aprovado.jpg" alt="Pedido aprovado"> | <img src="backoffice/22-pedidos-pendentes.jpg" alt="Pedidos pendentes"> |
| **Aprovado:** uma decisão só, mesmo com dois analistas ao mesmo tempo (STF-09) | **Pedidos pendentes**: desbloqueios, estornos e resoluções da conciliação |

<details>
<summary><b>Todos os pedidos</b></summary>

<img src="backoffice/24-pedidos-todos.jpg" alt="Todos os pedidos">

</details>

### Conciliação, auditoria e equipe

| | |
|:---:|:---:|
| <img src="backoffice/30-conciliacao.jpg" alt="Conciliação"> | <img src="backoffice/40-auditoria-pedido.jpg" alt="Trilha do pedido"> |
| **Conciliação:** as divergências que a conferência diária com o SPI encontrou. Na base local da captura, o dia bateu e a fila está vazia; as exceções são provadas pelo teste de caos e pelos testes de integração | **Trilha do pedido:** quem abriu e quem aprovou |
| <img src="backoffice/41-auditoria-cliente.jpg" alt="Trilha do cliente"> | <img src="backoffice/42-auditoria-membro.jpg" alt="Trilha de um membro da equipe"> |
| **Trilha do cliente:** bloqueios, desbloqueios e cada consulta aos dados dele | **Trilha de um membro:** o que ele fez e o que aconteceu com ele |
| <img src="backoffice/50-equipe.jpg" alt="Equipe"> | |
| **Equipe** (admin): cria operadores e analistas, troca o papel e desativa; a senha e o autenticador do membro novo aparecem uma vez só | |

---

[← Voltar ao README](../../README.md)
