# Performance da V1

Os orçamentos do projeto (CLAUDE.md, Performance) são medidos, não estimados. Este documento registra como se mede e o que foi medido. A decisão de hospedagem que explica os desvios está no [ADR 0012](adr/0012-hospedagem-da-v1.md).

| Orçamento | Meta |
|---|---|
| Leituras da API | p95 < 200 ms |
| Pix | p95 < 400 ms |
| Abertura a frio do app | < 2 s em aparelho intermediário |

## Como medir a API

```powershell
$env:MEASURE_API_URL = "https://next-bank-api.onrender.com"
pnpm --filter @nextbank/api measure
```

O script (`apps/api/scripts/measure-latency.ts`) entra como **Bruno**, da demo, e faz 36 rodadas. Em cada rodada mede `GET /health`, `GET /v1/me/account` e `GET /v1/me/statement`; a cada três rodadas, mede também um Pix inteiro de R$ 0,01 para Ana (consulta da chave, criação e autorização com o PIN). Cada tempo vai do envio até o corpo da resposta lido, e o resultado sai em p50, p95 e máximo por rota.

- **Um cliente, uma requisição por vez:** o limite global de 100 requisições por minuto por IP (API-02) não permite mais que isso de uma máquina, e o script espaça as chamadas para nunca receber 429.
- **12 Pix por execução:** consultar a chave e criar o Pix gastam a cota de 30 consultas por hora do pagador (PIX-07). Por isso o pagador é Bruno: Ana é a conta dos visitantes, e a cota dela fica para eles. Com 12 amostras, o p95 é o próprio máximo.
- **Sem lixo na demo:** os Pix da medição somem no reset diário (DEMO-02).
- **`/health` é a base da rede:** ele não toca o banco, então o tempo dele é praticamente a ida e volta até o servidor.

## Resultado de 2026-10-13

Medido do Brasil, numa rede doméstica, contra a API publicada (Render gratuito e Neon, ambos em `us-east-1`), com o código da API do PR #115 (o último que mudou a API), em milissegundos:

| Rota | Amostras | p50 | p95 | Máx | Orçamento (p95) |
|---|---|---|---|---|---|
| `GET /health` | 36 | 174 | 283 | 483 | — |
| `GET /v1/me/account` | 36 | 183 | 376 | 1890 | < 200 |
| `GET /v1/me/statement` | 36 | 184 | 215 | 218 | < 200 |
| `POST /v1/pix/key-lookups` | 12 | 186 | 224 | 224 | < 200 |
| `POST /v1/pix/transfers` | 12 | 206 | 258 | 258 | < 400 |
| `POST /v1/pix/transfers/{id}/authorize` | 12 | 368 | 861 | 861 | < 400 |

**Tempo no servidor (estimado):** a diferença entre o p50 de cada rota e o p50 do `/health`.

| Rota | Servidor (p50) |
|---|---|
| Conta | ~9 ms |
| Extrato | ~10 ms |
| Consulta da chave | ~12 ms |
| Criação do Pix | ~32 ms |
| Autorização do Pix | ~194 ms |

## Leitura

- **A distância domina.** Cerca de 175 ms de cada requisição são a viagem do Brasil até a Virginia, passando pela Cloudflare e pelo proxy do Render. Visto do Brasil, o p95 das leituras passa de 200 ms por causa da rede; no servidor, elas levam cerca de 10 ms. Era a consequência prevista no ADR 0012 ("Distância para o Brasil").
- **A autorização do Pix está fora do orçamento:** o p95 de 861 ms e mesmo o p50 do servidor (~194 ms) vêm do Argon2id do PIN na CPU compartilhada do plano gratuito. O custo do Argon2id é proposital (força bruta no PIN) e não é afrouxado. O desvio está registrado no ADR 0012.
- **Picos isolados:** o máximo de 1890 ms na consulta da conta foi uma amostra isolada (as outras 35 ficaram abaixo de 380 ms), típica de instância compartilhada. Não se repetiu nas outras rotas.

## Abertura a frio do app

```powershell
cd appsmobile
flutter run --profile --trace-startup -d <aparelho> --dart-define=API_BASE_URL=https://next-bank-api.onrender.com
Get-Content buildstart_up_info.json
```

Com o app fechado antes, em modo profile (o mais próximo do release que ainda mede), o Flutter grava os tempos até o primeiro quadro e encerra.

**Resultado de 2026-10-13**, num Samsung Galaxy S21 (SM-G991B, Android 15):

| Marco | Tempo |
|---|---|
| Framework iniciado | 362 ms |
| Primeiro quadro montado | 372 ms |
| **Primeiro quadro na tela** | **694 ms** |

Dentro do orçamento de 2 s. Duas ressalvas: o tempo conta a partir da subida do motor do Flutter, sem a criação do processo pelo Android (algumas centenas de milissegundos a mais); e o S21 é um topo de linha de 2021, não um aparelho intermediário. A folga (cerca de 1,3 s) cobre as duas, mas a medição num aparelho intermediário fica como verificação pendente.

## O que mudaria os números

- Hospedagem no Brasil (API e banco em São Paulo) tiraria os ~175 ms da rede.
- Uma instância paga, com CPU dedicada, reduziria o tempo do Argon2id e os picos.

As duas saídas têm custo e ficam fora da V1 (ADR 0012).
