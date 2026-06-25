# Micro ERP — Databricks App (DEX)

Aplicação de demonstração da **DEX | Datasource Expert** que implementa um **Micro ERP** sobre a
plataforma **Databricks Apps**, usando o **AppKit** e o **Lakebase** (Postgres gerenciado) como
banco transacional (OLTP).

A app vive na pasta [`my-microerp/`](my-microerp/) e entrega três módulos de negócio:

| Módulo | Rota | Descrição |
|--------|------|-----------|
| **CRM** | `/crm` | Empresas, contatos e pipeline de vendas |
| **Contas a Receber** | `/receivables` | Títulos a receber (AR) |
| **Contas a Pagar** | `/payables` | Títulos a pagar (AP) |
| _Todos_ | `/todos` | CRUD de exemplo que serve de referência de formato |

**Stack:** Node.js + Express (backend) · React 19 + TypeScript + Vite + Tailwind (frontend) ·
Zod (contratos compartilhados) · AppKit SDK + Lakebase (Databricks).

---

## Visão geral do fluxo de implantação

Este é o caminho mais curto, do clone ao app rodando. Cada passo está detalhado nas seções
seguintes.

```
1. Pré-requisitos (Databricks CLI + Node 22+)
2. Autenticar e criar um perfil da CLI
3. Criar o projeto Lakebase (antecipadamente)
4. Configurar databricks.yml (host + recursos Postgres)
5. npm install
6. DEPLOY  ← obrigatório ANTES de rodar localmente (regra de ouro)
7. npm run dev (desenvolvimento local)
```

> ⚠️ **Regra de ouro:** faça o **deploy da app ANTES** do primeiro `npm run dev`.
> O Service Principal da app precisa ser o **dono** do schema no Postgres. Se você rodar local
> primeiro, sua identidade vira dona do schema e a app deployada quebra com
> `permission denied for schema app`. Detalhes e recuperação na seção
> [Lakebase: ordem de implantação](#lakebase-ordem-de-implantação).

---

## 1. Pré-requisitos

### Databricks CLI (v1.5.0 ou superior)

Linux / macOS / WSL:

```bash
curl -fsSL https://raw.githubusercontent.com/databricks/setup-cli/main/install.sh | sh
```

Windows (PowerShell):

```powershell
winget install Databricks.DatabricksCLI
```

Confirme a instalação:

```bash
databricks --version
# esperado: Databricks CLI v1.5.0 (ou superior)
```

Mais detalhes em [Databricks CLI](https://developers.databricks.com/docs/tools/databricks-cli).

### Node.js 22+ e npm

```bash
node --version   # esperado: v22 ou superior
```

### (Opcional) Agent Skills do Databricks

Para potencializar assistentes de IA (Claude Code, Codex, GitHub Copilot) com conhecimento do
Databricks CLI, autenticação e desenvolvimento de apps:

```bash
databricks aitools install --scope=project
```

Saiba mais em [Databricks Agent Skills](https://developers.databricks.com/docs/tools/ai-tools/agent-skills#manage).

---

## 2. Clonar e autenticar

```bash
git clone <URL-DO-REPOSITORIO>
cd databricks-demos-app-microerp
```

Autentique a CLI no seu workspace via OAuth (U2M, baseado em navegador) e crie um **perfil**
nomeado. Neste projeto usamos o perfil `dex-producao`:

```bash
databricks auth login --host https://SEU-WORKSPACE.azuredatabricks.net --profile dex-producao
```

Confirme:

```bash
databricks auth profiles
```

> **Sobre autenticação:** OAuth é fortemente recomendado. Personal Access Tokens (PATs) são
> legados. Em todos os comandos abaixo use `--profile dex-producao` (ou o nome que você escolheu).

---

## 3. Criar o projeto Lakebase (antecipadamente)

A app precisa de um projeto Lakebase (Postgres gerenciado) **já provisionado** antes do deploy.
Crie-o uma única vez:

```bash
# Cria o projeto (auto-provisiona a branch 'production' e o endpoint 'primary')
databricks postgres create-project db-demo-microerp-dex \
  --json '{"spec": {"display_name": "Demo - Micro ERP - Databricks Apps"}}' \
  --profile dex-producao
```

Acompanhe até ficar `READY` (a criação leva alguns minutos):

```bash
databricks postgres list-projects --profile dex-producao
```

### (Opcional) Otimizar custo do endpoint

Para uma demo, fixe a computação em 0.5 CU e habilite o desligamento automático após 5 min de
ociosidade (PowerShell — note as crases ` para continuação de linha):

```powershell
# Fixa em 0.5 CU (min = max)
databricks postgres update-endpoint `
  projects/db-demo-microerp-dex/branches/production/endpoints/primary `
  "spec.autoscaling_limit_min_cu,spec.autoscaling_limit_max_cu" `
  --json '{\"spec\": {\"autoscaling_limit_min_cu\": 0.5, \"autoscaling_limit_max_cu\": 0.5}}' `
  --profile dex-producao

# Suspende automaticamente após 300s ociosos
databricks postgres update-endpoint `
  projects/db-demo-microerp-dex/branches/production/endpoints/primary `
  "spec.suspension" `
  --json '{\"spec\": {\"suspend_timeout_duration\": \"300s\"}}' `
  --profile dex-producao
```

> Equivalente em Bash: troque as crases ` por barras invertidas `\` e remova o escape `\"`.

---

## 4. Configurar o bundle (`databricks.yml`)

Edite [`my-microerp/databricks.yml`](my-microerp/databricks.yml) e ajuste o **host do workspace**
e os **nomes dos recursos Postgres** para o projeto que você criou no passo 3.

```yaml
targets:
  default:
    default: true
    workspace:
      host: https://SEU-WORKSPACE.azuredatabricks.net   # <- seu workspace

    variables:
      postgres_project:  projects/db-demo-microerp-dex
      postgres_branch:   projects/db-demo-microerp-dex/branches/production
      postgres_database: projects/db-demo-microerp-dex/branches/production/databases/databricks-postgres
```

Se você usou outro nome de projeto no passo 3, substitua `db-demo-microerp-dex` em todas as três
variáveis. Para descobrir os nomes exatos dos recursos:

```bash
databricks postgres list-projects   --profile dex-producao
databricks postgres list-branches   projects/db-demo-microerp-dex --profile dex-producao
databricks postgres list-databases  projects/db-demo-microerp-dex/branches/production --profile dex-producao
```

> O recurso `postgres` no `databricks.yml` concede ao Service Principal da app a permissão
> `CAN_CONNECT_AND_CREATE` — ele pode **criar** schemas/tabelas novos, mas **não acessa** schemas
> que pertençam a outra role. Isso é o que torna a ordem do passo 6 obrigatória.

---

## 5. Instalar dependências

```bash
cd my-microerp
npm install
```

> **Windows + execução de scripts:** se o npm/CLI reclamar de política de execução no PowerShell,
> rode uma vez: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`.

---

## 6. Deploy (obrigatório antes de rodar local)

Faça o deploy via Databricks Asset Bundle. Isso cria o app e o seu Service Principal, que então
conecta ao Lakebase e **cria o schema `app` como dono** no primeiro boot:

```bash
# a partir de my-microerp/
databricks bundle validate --profile dex-producao
databricks bundle deploy   --profile dex-producao
databricks bundle run my-microerp --profile dex-producao
```

Verifique que subiu corretamente:

```bash
databricks apps get my-microerp --profile dex-producao
databricks apps logs my-microerp --profile dex-producao
# nos logs deve aparecer: [todos] Created schema and table app.todos  (sem "Database setup failed")
```

A URL da app aparece na saída de `databricks apps get`.

---

## 7. Desenvolvimento local

Depois que o **deploy** criou o schema sob o Service Principal, você pode desenvolver localmente.

Crie o `.env` a partir do exemplo e preencha com os dados do seu Lakebase:

```bash
cp .env.example .env
```

```env
DATABRICKS_HOST=https://SEU-WORKSPACE.azuredatabricks.net
PGHOST=...                          # host do endpoint Lakebase
PGDATABASE=databricks_postgres
PGPORT=5432
PGSSLMODE=require
LAKEBASE_ENDPOINT=projects/db-demo-microerp-dex/branches/production/endpoints/primary
DATABRICKS_APP_PORT=8000
DATABRICKS_APP_NAME=my-microerp
```

Rode em modo desenvolvimento (hot reload):

```bash
npm run dev
```

> Para conseguir **ler/gravar dados** localmente nos schemas que o Service Principal é dono, peça
> ao dono do projeto Lakebase o papel `databricks_superuser` para a sua identidade. Ele concede
> acesso DML **sem** torná-lo dono dos schemas — evitando recair no problema de ownership.

---

## Lakebase: ordem de implantação

> **Faça o deploy da app ANTES de rodá-la localmente (`npm run dev`).**

No boot, cada repository roda `CREATE SCHEMA IF NOT EXISTS app` (via `ensureSchema()`), e **quem
roda esse comando primeiro vira o dono do schema**. Como o Service Principal só tem
`CAN_CONNECT_AND_CREATE` (não acessa schemas de outra role):

- **Deploy primeiro** → o SP cria o schema `app` e vira dono → tudo funciona. ✅
- **Local primeiro** → sua identidade de usuário vira dona do schema. A app deployada (que conecta
  como o SP) recebe `permission denied for schema app` (código `42501`) e as telas retornam
  `Internal server error`. ❌

### Recuperação do `permission denied for schema app`

Se o schema ficou com o dono errado, ele precisa ser **dropado e recriado pelo SP** — a
propriedade de schema no Postgres é amarrada à role que o criou e não pode ser reatribuída por um
usuário comum.

> ⚠️ Dropar o schema **apaga os dados** nele. Exporte antes se houver dados (`pg_dump` ou cópia
> para um schema temporário).

1. **Drope o schema** (conecte com sua identidade; precisa de `databricks_superuser`):
   ```sql
   DROP SCHEMA IF EXISTS app CASCADE;
   ```
2. **Reinicie a app sem nenhuma conexão sua no meio** — qualquer `CREATE SCHEMA` ou query de
   inspeção entre o drop e o boot recria o schema como seu de novo:
   ```bash
   databricks apps stop  my-microerp --profile dex-producao
   databricks apps start my-microerp --profile dex-producao
   ```
3. **Confirme que o dono agora é o SP** — deve retornar o `service_principal_client_id`
   (de `databricks apps get my-microerp`):
   ```sql
   SELECT pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname = 'app';
   ```

> `psql` não vem instalado por padrão no Windows. Para rodar SQL ad-hoc, use
> `databricks psql --project db-demo-microerp-dex -- -c "<SQL>"` (requer `psql` no PATH), ou
> conecte via qualquer cliente PostgreSQL usando o token de
> `databricks postgres generate-database-credential <ENDPOINT> -o json` como senha.

---

## Comandos úteis

Todos rodam a partir de `my-microerp/`.

```bash
# Build de produção (gera dist/server.js + client/dist/)
npm run build

# Qualidade de código
npm run typecheck       # checagem de tipos
npm run lint            # eslint
npm run lint:fix
npm run format          # prettier --check
npm run format:fix

# Testes
npm run test            # unit (vitest) + smoke
npm run test:e2e        # Playwright

# Redeploy após mudanças
databricks bundle deploy --profile dex-producao
```

---

## Estrutura do projeto

```
databricks-demos-app-microerp/
├── README.md              # este arquivo
└── my-microerp/           # a Databricks App
    ├── client/            # frontend React (features/, components/)
    ├── server/            # backend Express (features/ em camadas: router→controller→service→repository)
    ├── shared/            # schemas Zod + tipos compartilhados (fonte única de verdade)
    ├── specs/             # specs de cada feature (spec-driven development)
    ├── databricks.yml     # configuração do Asset Bundle
    ├── app.yaml           # configuração de runtime da app
    ├── CLAUDE.md          # convenções de arquitetura para assistentes de IA
    └── package.json
```

A arquitetura em camadas, as convenções de nomenclatura e o fluxo de criação de novas features
estão documentados em [`my-microerp/CLAUDE.md`](my-microerp/CLAUDE.md) e nas
[specs](my-microerp/specs/). O desenvolvimento é **spec-driven**: cada feature começa por um
arquivo `specs/<feature>.md` antes de qualquer código.

---

<sub>Desenvolvido pela DEX | Datasource Expert · Microsoft Americas Partner of the Year 2024.</sub>
