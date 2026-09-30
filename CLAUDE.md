# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This repo has a single Databricks App living in `my-microerp/`. The root `README.md` covers the
full Lakebase provisioning/deploy walkthrough (in Portuguese); `my-microerp/CLAUDE.md` documents
the app's architecture conventions in detail — read both before making structural changes. All
commands below run from `my-microerp/`.

## Commands (run from `my-microerp/`)

```bash
npm install              # postinstall runs `appkit generate-types`

npm run dev               # tsx watch, hot reload (predev runs appkit plugin sync + typegen)
npm run build              # build:server (tsc + tsdown) then build:client (tsc + vite)
npm start                  # run the production build (dist/server.js)

npm run typecheck          # tsc -b on server + client tsconfigs, no emit
npm run lint / lint:fix     # eslint
npm run lint:ast-grep       # appkit's ast-grep lint rules
npm run format / format:fix # prettier

npm run test                # vitest run (unit) + test:smoke (playwright)
npm run test:e2e            # full playwright suite
npm run test:e2e:ui         # playwright UI mode
npx vitest run path/to/file.test.ts   # single unit test file
npx playwright test tests/smoke.spec.ts -g "test name"  # single e2e test

databricks bundle validate --profile dex-producao
databricks bundle deploy   --profile dex-producao
databricks bundle run my-microerp --profile dex-producao

databricks apps dev-remote --name my-microerp --profile dex-producao  # preferred local dev loop, see below
```

`dex-producao` is the CLI profile used throughout this project (see `~/.databrickscfg`). Never
assume a default profile — pass `--profile` explicitly.

## Critical: Lakebase deploy ordering, and how to actually develop locally

**Always `databricks bundle deploy` before the first local run of any kind.** Each feature
repository runs `CREATE SCHEMA IF NOT EXISTS <schema>` on boot (idempotent `ensureSchema()`), and
whoever runs it first becomes the schema owner. The app's Service Principal only has
`CAN_CONNECT_AND_CREATE` on Postgres (see `databricks.yml`) — it can create new objects but
cannot access schemas owned by another role. If you (a human identity) connect to Lakebase first
— which is exactly what `npm run dev` does, since it opens its own Postgres connection using
`PGHOST`/`PGUSER`/etc. from your `.env` — you become the schema owner, and the deployed app then
fails with `permission denied for schema app` (`42501`). Recovery requires dropping and letting the
SP recreate the schema (data loss) — see the root `README.md` § "Lakebase: ordem de implantação"
for the full recovery procedure.

**Prefer `databricks apps dev-remote --name my-microerp --profile <PROFILE>` over plain
`npm run dev` for day-to-day work.** It starts a local Vite dev server and bridges it via
WebSocket to the already-deployed app: the browser talks to the deployed backend, which proxies
UI/query requests back to your machine for hot reload. Because the backend — and every Lakebase
query — keeps running remotely as the Service Principal, your local session never opens its own
Postgres connection, so it **cannot** reassign schema ownership. Trade-off: only
`client/` (React/TS/CSS) and `config/queries/*.sql` hot-reload this way — backend code changes
(anything in `server/`, including this app's Lakebase repositories/services) require a redeploy
(`databricks bundle deploy --profile <PROFILE>`) to take effect. Run
`databricks apps dev-remote --help` for the full flag list (custom port, `--auto-approve`, etc.).

Reach for plain `npm run dev` only when you specifically need to iterate on `server/` code with
hot reload, and only after the app has already been deployed at least once. In that mode your own
identity connects directly to Lakebase, so it needs the `databricks_superuser` Postgres role
(DML only, does not transfer schema ownership) — see the Local Development section of the
`databricks-lakebase` skill for how to request/verify it. Never run it before the first deploy.

## Architecture

Stack: Node.js + Express backend, React 19 + TypeScript + Vite + Tailwind frontend, Zod for
shared contracts, built on the **Databricks AppKit** SDK (`@databricks/appkit`,
`@databricks/appkit-ui`) with the **Lakebase** (managed Postgres/OLTP) and **Genie** (NL data
Q&A, SSE) plugins. AppKit-specific guidance lives in
`node_modules/@databricks/appkit/CLAUDE.md` and `node_modules/@databricks/appkit-ui/CLAUDE.md`.

The app is a Micro ERP with four features, each following the same layered structure:

| Feature | Route | Domain |
|---------|-------|--------|
| `todos` | `/todos` | reference CRUD example |
| `crm` | `/crm` | companies, contacts, sales pipeline (opportunities) |
| `receivables` | `/receivables` | accounts receivable |
| `payables` | `/payables` | accounts payable |

**Cross-feature dependency**: `receivables` are created from `crm` opportunities being won
(`ar.receivables.opportunity_id` FKs to `crm.opportunities`). Because of this, `server/server.ts`
registers feature routes in a specific order inside `onPluginsReady`: CRM's schema is ensured
first, then receivables routes are registered (its service is captured), then CRM routes are
registered with the `ReceivableService` injected, then payables. Preserve this ordering (or the
FK/service-injection reasoning behind it) if you touch `server/server.ts`.

### Backend layers (`server/features/<feature>/`)

Strict one-way dependency — each layer only calls the one directly below:

`<f>.router.ts` (wires `appkit.server.extend()`, instantiates controller) →
`<f>.controller.ts` (Zod `.safeParse()` on `req.body`, calls `sendError()`/`res.json()`) →
`<f>.service.ts` (business rules, throws `AppError`) →
`<f>.repository.ts` (raw SQL, parses rows with `<Entity>Schema.parse()`)

Routers never touch SQL or Zod parsing directly; repositories never know about Express types or
`AppError`. All errors funnel through `sendError()` in `server/lib/errors.ts`, producing
`{ error: string }` responses.

### Frontend layers (`client/src/features/<feature>/`)

`<Feature>Page.tsx` (render + call hooks, no `fetch`/data `useState`) →
`hooks.ts` (`useState`/`useEffect`, calls `<f>Api.*`) →
`api.ts` (calls `api.get/post/patch/delete` from the shared client, uses `@shared` types) →
`client/src/api/index.ts` (the actual `fetch` wrapper; normalizes errors into `ApiError`)

Features must not import from each other's `api.ts`/`hooks.ts`.

### Shared contracts (`shared/<feature>/`)

- `schemas.ts` — Zod schemas are the single source of truth
- `types.ts` — always `z.infer<typeof ...Schema>`, never hand-written
- Server imports via relative path (`../../../shared/todos/schemas.js`); client imports via the
  `@shared/todos/types.js` alias
- The client never imports Zod schemas for runtime validation of server responses — only the
  inferred TS types

### API conventions

All routes are `/api/<resource>` (no plugin name in the path), resource names are plural nouns
(`/api/todos`, `/api/customers`).

## Adding a new feature

Spec-driven: write `specs/<feature>.md` first (see `specs/README.md` for the template), then:

1. `shared/<feature>/schemas.ts` + `types.ts`, exported from `shared/index.ts`
2. `server/features/<feature>/` — repository → service → controller → router, imported into `server/server.ts`
3. `client/src/features/<feature>/` — `api.ts`, `hooks.ts`, `<Feature>Page.tsx`
4. Route added in `client/src/App.tsx`

File naming: server files are `<feature>.repository.ts` / `.service.ts` / `.controller.ts` /
`.router.ts`; client files are `api.ts`, `hooks.ts`, `<Feature>Page.tsx` (PascalCase).
