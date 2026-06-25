# my-microerp

A Databricks App powered by [AppKit](https://www.databricks.com/devhub/docs/appkit/v0/), featuring React, TypeScript, and Tailwind CSS.

**Enabled plugins:**
- **Lakebase** -- Fully managed Postgres database for transactional (OLTP) workloads on Databricks
- **Server** -- Express HTTP server with static file serving and Vite dev mode

## Prerequisites

- Node.js v22+ and npm
- Databricks CLI (for deployment)
- Access to a Databricks workspace

## Databricks Authentication

### Local Development

For local development, configure your environment variables by creating a `.env` file:

```bash
cp .env.example .env
```

Edit `.env` and set the environment variables you need:

```env
DATABRICKS_HOST=https://your-workspace.cloud.databricks.com
DATABRICKS_APP_PORT=8000
# ... other environment variables, depending on the plugins you use
```

#### Lakebase Configuration

The Lakebase plugin requires additional environment variables for PostgreSQL connectivity. To learn how to configure the Lakebase plugin, see the [Lakebase plugin documentation](https://www.databricks.com/devhub/docs/appkit/v0/plugins/lakebase).

## Lakebase: ordem de implantação (leia antes do primeiro deploy)

> **Regra de ouro: faça o deploy da app ANTES de rodá-la localmente (`npm run dev`).**

O Service Principal (SP) da app tem permissão `CAN_CONNECT_AND_CREATE` no Postgres
(ver `databricks.yml`): ele pode **criar** objetos novos, mas **não acessa schemas que
pertencem a outra role**. No boot, `TodoRepository.ensureSchema()` roda
`CREATE SCHEMA IF NOT EXISTS app` — e **quem roda esse comando primeiro vira dono do schema**.

- Se o **deploy** for feito primeiro, o SP cria o schema `app` e vira dono → tudo funciona.
- Se você rodar **localmente primeiro**, sua identidade de usuário cria o schema e vira dono.
  Então a app deployada (que conecta como o SP) recebe `permission denied for schema app`
  (código `42501`) e a tela `/todos` retorna `Internal server error`.

### Recuperação do `permission denied for schema app`

Se você caiu nesse estado (schema com dono errado), o schema precisa ser **dropado e recriado
pelo SP**. A propriedade de schema no PostgreSQL é amarrada à role que o criou e não pode ser
reatribuída por um usuário comum.

> ⚠️ Dropar o schema apaga os dados nele. **Exporte antes se houver dados** (`pg_dump` ou cópia
> para um schema temporário).

1. **Drope o schema** (conecte com sua identidade; precisa de `databricks_superuser`):
   ```sql
   DROP SCHEMA IF EXISTS app CASCADE;
   ```
2. **Reinicie a app SEM nenhuma conexão sua no meio** — qualquer `CREATE SCHEMA` ou query de
   inspeção entre o drop e o boot recria o schema como seu de novo:
   ```bash
   databricks apps stop my-microerp --profile <PROFILE>
   databricks apps start my-microerp --profile <PROFILE>
   ```
3. **Confirme que o dono agora é o SP** — deve retornar o `service_principal_client_id`
   (de `databricks apps get my-microerp`):
   ```sql
   SELECT pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname = 'app';
   ```
4. Nos logs (`databricks apps logs my-microerp`) você deve ver
   `[todos] Created schema and table app.todos`, sem `Database setup failed`.

> `psql` não vem instalado por padrão no Windows. Para rodar SQL ad-hoc você pode usar
> `databricks psql --project <PROJECT_ID> -- -c "<SQL>"` (requer `psql` no PATH), ou conectar
> via qualquer cliente PostgreSQL usando o token de
> `databricks postgres generate-database-credential <ENDPOINT> -o json` como senha.

### Desenvolvimento local depois do primeiro deploy

Para desenvolver localmente contra o banco já provisionado pelo SP, peça ao dono do projeto
Lakebase o papel `databricks_superuser` para a sua identidade (criadores do projeto já têm).
Ele concede acesso **DML** (ler/escrever dados) aos schemas que o SP é dono — **sem** torná-lo
dono deles, evitando recair no problema acima.

### CLI Authentication

The Databricks CLI requires authentication to deploy and manage apps. Configure authentication using one of these methods:

#### OAuth U2M

Interactive browser-based authentication with short-lived tokens:

```bash
databricks auth login --host https://your-workspace.cloud.databricks.com
```

This will open your browser to complete authentication. The CLI saves credentials to `~/.databrickscfg`.

#### Configuration Profiles

Use multiple profiles for different workspaces:

```ini
[DEFAULT]
host = https://dev-workspace.cloud.databricks.com

[production]
host = https://prod-workspace.cloud.databricks.com
client_id = prod-client-id
client_secret = prod-client-secret
```

Deploy using a specific profile:

```bash
databricks bundle deploy --profile production
```

**Note:** Personal Access Tokens (PATs) are legacy authentication. OAuth is strongly recommended for better security.

## Getting Started

### Install Dependencies

```bash
npm install
```

### Development

Run the app in development mode with hot reload:

```bash
npm run dev
```

The app will be available at the URL shown in the console output.

### Build

Build both client and server for production:

```bash
npm run build
```

This creates:

- `dist/server.js` - Compiled server bundle
- `client/dist/` - Bundled client assets

### Production

Run the production build:

```bash
npm start
```

## Code Quality

There are a few commands to help you with code quality:

```bash
# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
npm run format:fix
```

## Deployment with Databricks Asset Bundles

### 1. Configure Bundle

Update `databricks.yml` with your workspace settings:

```yaml
targets:
  default:
    workspace:
      host: https://your-workspace.cloud.databricks.com
```

Make sure to replace all placeholder values in `databricks.yml` with your actual resource IDs.

### 2. Validate Bundle

```bash
databricks bundle validate
```

### 3. Deploy

Deploy to the default target:

```bash
databricks bundle deploy
```

### 4. Run

Start the deployed app:

```bash
databricks bundle run <APP_NAME> -t dev
```

### Deploy to Production

1. Configure the production target in `databricks.yml`
2. Deploy to production:

```bash
databricks bundle deploy -t prod
```

## Project Structure

```
* client/          # React frontend
  * src/           # Source code
  * public/        # Static assets
* server/          # Express backend
  * server.ts      # Server entry point
  * routes/        # Routes
* shared/          # Shared types
* databricks.yml   # Bundle configuration
* app.yaml         # App configuration
* .env.example     # Environment variables example
```

## Tech Stack

- **Backend**: Node.js, Express
- **Frontend**: React.js, TypeScript, Vite, Tailwind CSS, React Router
- **UI Components**: Radix UI, shadcn/ui
- **Databricks**: AppKit SDK
