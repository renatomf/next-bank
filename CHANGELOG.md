# Changelog

Todas as mudanças relevantes do next bank são registradas aqui.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa [Versionamento Semântico](https://semver.org/lang/pt-BR/). Cada versão publicada recebe uma tag (`v1.0.0`, `v1.1.0`, `v1.2.0`).

## [Não publicado]

### Adicionado — Semana 1: arquitetura e segurança
- Roadmap e design de arquitetura (V1 Core, Pix assíncrono, backoffice)
- Brief visual e design tokens (cor Paraíba, dark-first) e mockups de Home, Pix e Comprovante
- Modelo de domínio: contextos, agregados, máquina de estados do Pix, plano de contas, catálogo de erros, mapa de navegação
- Desenho do banco de dados: schema por contexto, restrições como última barreira, ledger e auditoria imutáveis, criptografia de dados pessoais, estratégia de concorrência, caminho de escala
- Threat model STRIDE com 42 ameaças (incluindo a demo pública) e checklist OWASP ASVS/MASVS
- ADRs 0001–0009
- Diagramas C4 (contexto e containers) e de sequência (login com renovação de sessão e Pix interno)
- Padrões de engenharia, regras de TDD e convenções de Git
- Documento de evolução do projeto
- README em inglês e imagens dos mockups da V1
- Plano da demo pública: contas de demonstração, CPF fictício no cadastro, reset semanal

### Alterado
- Documentação reorganizada (`docs/roadmap.md`, `docs/plans/`)
- Monorepo com Turborepo no lado TypeScript; backoffice no Render com API administrativa privada
- Acesso a dados com SQL puro tipado (`pg` + pgTyped + dbmate) no lugar do Drizzle
- Escopo da V1 congelado até a `v1.0.0`
- App mobile sem o código de exemplo do template do Flutter
- Lints estritos no app mobile (`very_good_analysis`)

### Segurança
- `.gitignore` cobrindo segredos, chaves, certificados, credenciais e dumps
- Secret scanning, push protection e Dependabot ativados no repositório
- Licença com todos os direitos reservados
- `.gitattributes` padronizando quebras de linha
