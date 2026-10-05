# next bank — Regras do projeto

- Spec: `docs/superpowers/specs/2026-10-05-next-bank-roadmap-design.md`
- Brief visual: `docs/design/brief.md`
- Modelo de domínio: `docs/architecture/domain-model.md`
- Responder sempre em português (pt-BR).

## Segurança do repositório (obrigatório)

O repositório `renatomf/next-bank` é **público**. Antes de qualquer commit:

- **Nada sensível entra no git.** Segredos, `.env`, chaves, certificados, keystores, tokens, credenciais de nuvem, arquivos do Firebase, dumps de banco e logs ficam no `.gitignore` desde o primeiro momento.
- **Ao adicionar uma ferramenta nova** (Firebase, Sentry, deploy, etc.), atualizar o `.gitignore` **antes** de gerar ou baixar seus arquivos de configuração.
- **Configuração versionada só como exemplo:** `.env.example` com valores falsos e comentários; nunca valores reais.
- **Conferir o que vai ser commitado** (`git status` / `git diff --cached`) e procurar por segredos antes de cada commit.
- **Nada de terceiros sem licença:** imagens de referência, marcas e assets de outros bancos ficam só localmente (`docs/design/references/` é ignorada).
- **Dados de exemplo são fictícios:** nenhum CPF, e-mail ou telefone real em código, testes, seeds ou documentação.
- **Push só com confirmação do desenvolvedor.**
