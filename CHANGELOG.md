# Changelog

Todas as mudanças relevantes do next bank são registradas aqui.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa [Versionamento Semântico](https://semver.org/lang/pt-BR/). Cada versão publicada recebe uma tag (`v1.0.0`, `v1.1.0`, `v1.2.0`).

## [Não publicado]

### Adicionado — Semana 1: arquitetura e segurança
- Roadmap e design de arquitetura (V1 Core, Pix assíncrono, backoffice)
- Brief visual e design tokens (cor Paraíba, dark-first) e mockups de Home, Pix e Comprovante
- Modelo de domínio: contextos, agregados, máquina de estados do Pix, plano de contas, catálogo de erros, mapa de navegação
- Desenho do banco de dados: schema por contexto, restrições como última barreira, ledger e auditoria imutáveis, criptografia de dados pessoais, estratégia de concorrência, caminho de escala
- Threat model STRIDE com 38 ameaças e checklist OWASP ASVS/MASVS
- ADRs 0001–0008
- Padrões de engenharia, regras de TDD e convenções de Git
- Documento de evolução do projeto

### Segurança
- `.gitignore` cobrindo segredos, chaves, certificados, credenciais e dumps
- Secret scanning, push protection e Dependabot ativados no repositório
