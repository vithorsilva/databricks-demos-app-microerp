# databricks-demos-app-microerp

# Pré-requisitos
Instalar o Databricks Cli:

apt-get install -y unzip && curl -fsSL https://raw.githubusercontent.com/databricks/setup-cli/main/install.sh | sh

Maiores informações em [Databricks CLI](https://developers.databricks.com/docs/tools/databricks-cli).

Confirme a instalação com: 
```bash
databricks --version                   
```
Saída esperada Databricks CLI v1.5.0 ou superior

Mantenha-se logado ao seu ambiente de desenvolvimento do Databricks:

```bash
databricks auth login
```
Crie um novo perfil, aqui irei chamar de `dex-producao`.

Instale para seu projeto o Agent Skill do Databricks:
```bash
databricks aitools install --scope=project
```

Saiba mais em [Databricks - Agent Skill - Manage](https://developers.databricks.com/docs/tools/ai-tools/agent-skills#manage).

# Criando passo a passo

## Lakebase
```powershell
databricks auth login --host URL_HOST
databricks auth profiles --profile dex-producao 

# Criação do Lakebase
databricks postgres create-project db-demo-microerp-dex --json '{\"spec\": {\"display_name\": \"Demo - Micro ERP - Databricks Apps\"}}'

# Redimensionamento para 0.5 CU
databricks postgres update-endpoint `
  projects/db-demo-microerp-dex/branches/production/endpoints/primary `
  "spec.autoscaling_limit_min_cu,spec.autoscaling_limit_max_cu" `
  --json '{\"spec\": {\"autoscaling_limit_min_cu\": 0.5, \"autoscaling_limit_max_cu\": 0.5}}'

# Desligamento automatico pós 5 minutos.
databricks postgres update-endpoint `
  projects/db-demo-microerp-dex/branches/production/endpoints/primary `
  "spec.suspension" `
  --json '{\"spec\": {\"suspend_timeout_duration\": \"300s\"}}'

```

## NodeJs (NPM)

Se estiver em um cenário Windows usando Bash (WSL), talvez tenha que ajustar algo no seu ambiente.
Sua sessão no Powershell rodar:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## Criando utilizando AppKit (ambiente em branco)
Agora vamos iniciar o AppKit:

```bash
databricks apps init

# digite: my-microerp
# Marque Lakebase
# Selecione o Lakebase criado, no meu caso "Demo - Micro ERP - Databricks Apps" na branch production, com database databricks_postgres.
# Em Deploy after creation?, marque Yes.
# Em Choose how to start the development server, marque Yes, run locally (npm run dev).
# Instale os Skills para suas interfaces de codificação como Claude Code, Codex, GitHub Copilot e outros.
```
Caso tenha erros, talvez seja necessário atuailizar o arquivo [my-microerp/databricks.yml](my-microerp/databricks.yml) com a entrada:

postgres_project: projects/db-demo-microerp-dex

O bloco ficará assim:
```json
    variables:
      postgres_project: projects/db-demo-microerp-dex
      postgres_branch: projects/db-demo-microerp-dex/branches/production
      postgres_database: projects/db-demo-microerp-dex/branches/production/databases/databricks-postgres
```
Abra o arquivo [my-microerp/package.json](my-microerp/package.json) e troque o conteúdo da variável `dev` por:

`"dev": "cross-env NODE_ENV=development tsx watch --tsconfig ./tsconfig.server.json --env-file-if-exists=./.env ./server/server.ts"`

Por fim, instale o pacote da seguinte forma:

```bash
cd my-microerp && npm install --save-dev cross-env
```

### Deploy manual

Se inicialmente o databricks init funcionou, sua aplicação pode já estar pronta para ser compilada e realizado o deploy, vamos fazer isso passo a passo:
 execução em sua máquina como desenvolvimento, caso não esteja, e tenha realizado os passos acima para configuração adequada do ambiente, então execute:

```bash
# Compila a aplicação
npm run build

# Faz o deploy da aplicação:
databricks apps deploy
```

<!--

```bash
npm run dev
```
isto iniciará sua aplicação

# Setup Infra
## 1. Criar o Projeto Lakebase

```powershell
databricks postgres create-project <PROJECT_ID> \
  --json '{"spec": {"display_name": "<NOME>"}}' \
  --no-wait
```
Isso auto-provisiona a branch production e o endpoint primary (read-write, scale-to-zero). Use --no-wait para evitar timeout; acompanhe com postgres get-operation.

## 2. Scaffoldar a App conectada ao Lakebase
Após confirmar que o projeto está READY:

```powershell
databricks apps init --name <APP_NAME> --features lakebase \
  --set "lakebase.postgres.branch=production" \
  --set "lakebase.postgres.database=databricks_postgres" \
  --run none
```

Isso gera o app.py, app.yaml e a configuração de recursos Lakebase automaticamente.

## 3. Deploy primeiro (obrigatório antes de rodar local)

```powershell
databricks apps deploy <APP_NAME> --source-code-path <caminho>
```

    Crítico: o Service Principal da App precisa existir no Lakebase para criar e possuir schemas. Se rodar local antes do deploy, o schema ficará sob suas credenciais, não as da SP.

## 4. Desenvolver localmente

Com a app deployada, as variáveis PGHOST, PGDATABASE, PGUSER, PGPORT, DATABRICKS_CLIENT_ID são injetadas automaticamente. Use o SDK para gerar o token OAuth:

```python
from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
cred = w.postgres.generate_database_credential(endpoint="projects/.../endpoints/...")
```

## 5. Redeploy e Status do App

```powershell
databricks apps deploy <APP_NAME> --source-code-path <caminho_workspace>
databricks apps get minha-app --output JSON
``` -->