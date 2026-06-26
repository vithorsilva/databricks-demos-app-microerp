# Evolução do CRM — Gestão de Funil + Relatórios estilo Pipedrive

## Context

O módulo CRM atual ([CrmPage.tsx](my-microerp/client/src/features/crm/CrmPage.tsx)) entrega CRUD de empresas/contatos e um board de pipeline **read-only** com 5 estágios fixos (enum `stage` em `crm.opportunities`) que só avança por botão. O usuário quer elevá-lo a um patamar próximo do Pipedrive, com foco em **Gestão de Funil** (board arrastável, múltiplos funis, estágios configuráveis, ganho/perda, deal apodrecendo) e **Relatórios de oportunidades** (funil de conversão, forecast, ganhos×perdas, desempenho por responsável), além de polimento visual — hoje o módulo está "muito simples".

Decisões já alinhadas com o usuário:
1. **Funis e estágios configuráveis** → novas tabelas `crm.pipelines` e `crm.stages`; oportunidade passa a referenciar `stage_id`.
2. **Drag-and-drop HTML5 nativo** → zero dependências novas (mantém filosofia enxuta do projeto).
3. **Relatórios**: os 4 — funil de conversão, forecast, ganhos×perdas, desempenho por responsável (charts via `ChartContainer`/Recharts do `@databricks/appkit-ui`, já disponível).
4. **Detalhe do deal**: painel lateral (Drawer/Sheet do AppKit) com edição inline + timeline de atividades (`crm.activities`).

Tudo segue o padrão em camadas do projeto (Repository → Service → Controller → Router no back; Page → Hook → feature API no front; Zod em `shared` como fonte única de verdade — ver [CLAUDE.md](my-microerp/CLAUDE.md)).

---

## Data Model (PostgreSQL/Lakebase, schema `crm`)

Criação/evolução idempotente em `CrmRepository.ensureSchema()` ([crm.repository.ts:68](my-microerp/server/features/crm/crm.repository.ts#L68)) com `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. Manter ordem de FK: `companies` → `pipelines` → `stages` → `opportunities` → `activities`.

### Novas tabelas

**`crm.pipelines`**
| Coluna | Tipo | Constraints |
|---|---|---|
| `id` | `SERIAL` | PK |
| `name` | `TEXT` | NOT NULL |
| `position` | `INTEGER` | NOT NULL DEFAULT 0 |
| `created_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT NOW() |

**`crm.stages`**
| Coluna | Tipo | Constraints |
|---|---|---|
| `id` | `SERIAL` | PK |
| `pipeline_id` | `INTEGER` | NOT NULL REFERENCES `crm.pipelines(id)` ON DELETE CASCADE |
| `name` | `TEXT` | NOT NULL |
| `position` | `INTEGER` | NOT NULL DEFAULT 0 |
| `probability` | `INTEGER` | NOT NULL DEFAULT 100, CHECK 0–100 (peso para forecast) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT NOW() |

**`crm.activities`**
| Coluna | Tipo | Constraints |
|---|---|---|
| `id` | `SERIAL` | PK |
| `opportunity_id` | `INTEGER` | NOT NULL REFERENCES `crm.opportunities(id)` ON DELETE CASCADE |
| `type` | `TEXT` | NOT NULL CHECK IN (`call`,`email`,`meeting`,`task`,`note`) |
| `subject` | `TEXT` | NOT NULL |
| `notes` | `TEXT` | NULL |
| `due_date` | `TIMESTAMPTZ` | NULL |
| `done` | `BOOLEAN` | NOT NULL DEFAULT false |
| `created_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT NOW() |

### Evolução de `crm.opportunities` (ADD COLUMN IF NOT EXISTS)
- `pipeline_id INTEGER REFERENCES crm.pipelines(id)`
- `stage_id INTEGER REFERENCES crm.stages(id)`
- `status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','won','lost'))`
- `lost_reason TEXT NULL`
- `sort_index INTEGER NOT NULL DEFAULT 0` (ordem do card dentro da coluna)
- `stage_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` (base para "deal apodrecendo")
- `won_at` / `lost_at TIMESTAMPTZ NULL`
- Manter coluna legada `stage` por ora (não remover); novas leituras usam `stage_id`/`status`.

### Seed + migração de dados (idempotente, dentro de `ensureSchema`)
- Se não existir nenhum pipeline: inserir **"Funil de Vendas"** com 4 estágios abertos espelhando o enum atual + probabilidades sugeridas: `Lead` (20), `Qualificado` (40), `Proposta` (60), `Negociação` (80). (`won`/`lost` deixam de ser "estágios" e viram `status`.)
- Backfill: para oportunidades com `stage_id IS NULL`, mapear o enum legado → `stage_id` do funil padrão; `stage='won'`→`status='won'`, `stage='lost'`→`status='lost'`, demais→`status='open'`.

### Schemas Zod — `shared/crm/schemas.ts`
Adicionar `PipelineSchema`, `StageSchema`, `ActivitySchema` (+ `Create*`/`Update*` body schemas) e estender `OpportunitySchema` com: `pipeline_id`, `stage_id`, `stage_name` (join), `probability` (do stage), `status`, `lost_reason`, `sort_index`, `stage_changed_at`, `won_at`, `lost_at`. Schemas de relatório: `FunnelReportSchema`, `ForecastReportSchema`, `WonLostReportSchema`, `OwnerPerformanceSchema`. Tipos derivados em `shared/crm/types.ts` (`z.infer`), exportados via [shared/index.ts](my-microerp/shared/index.ts).

---

## API Contract (rotas `/api/...`)

**Pipelines** — `GET/POST /api/pipelines`, `PATCH/DELETE /api/pipelines/:id` (com estágios aninhados no GET).
**Stages** — `POST /api/stages`, `PATCH/DELETE /api/stages/:id`, `PATCH /api/stages/reorder` (lista de `{id, position}`).
**Opportunities** (estender):
- `GET /api/opportunities?pipeline_id=&status=` (default board = `status=open`).
- `PATCH /api/opportunities/:id` passa a aceitar `stage_id`, `status`, `lost_reason`, `sort_index`. Mover de coluna = `{ stage_id, sort_index }` e atualiza `stage_changed_at`; ganhar/perder = `{ status, lost_reason? }` (seta `won_at`/`lost_at`).
- `PATCH /api/opportunities/reorder` — persiste ordem/coluna após drop (lista de `{id, stage_id, sort_index}`).
**Activities** — `GET /api/activities?opportunity_id=`, `POST /api/activities`, `PATCH /api/activities/:id` (toggle `done`), `DELETE /api/activities/:id`.
**Insights** — `GET /api/opportunities/insights?pipeline_id=&from=&to=` retorna objeto com as 4 seções (funnel, forecast, won_lost, owner_performance), agregadas em SQL no repository.

Erros mantêm shape `{ error: string }` via `sendError` ([errors.ts](my-microerp/server/lib/errors.ts)); FK violation (`23503`) → `AppError(400, ...)` como já feito.

---

## Backend (`server/features/crm/`)

Estender os 4 arquivos existentes e adicionar repositórios/serviços por subdomínio mantendo a camada:
- **`crm.repository.ts`**: `ensureSchema` cria/altera tabelas + seed/backfill; novos métodos para pipelines, stages, activities, reorder e as agregações de insights (CTEs com `JOIN crm.stages`, `GROUP BY`, `FILTER (WHERE status=...)`). Casts `::text` em datas e `amount::float8` (convenção do projeto).
- **`crm.service.ts`**: regras — não deixar excluir stage com oportunidades (mover antes / 409), proteger último estágio do funil, validar transição won/lost exige `status`, calcular `weighted = amount * probability/100` no forecast.
- **`crm.controller.ts`**: `safeParse` dos novos bodies, parse de query (`pipeline_id`, `from`, `to`, `status`), `res.json`.
- **`crm.router.ts`**: registrar as novas rotas (`registerCrmRoutes` já é chamado em [server.ts](my-microerp/server/server.ts) antes de AR/AP — manter ordem).

Arquivos-alvo (representativos): `my-microerp/server/features/crm/crm.{repository,service,controller,router}.ts`.

---

## Frontend (`client/src/features/crm/`)

Reestruturar a `CrmPage` em abas mais ricas: **Funil** (board), **Relatórios**, **Empresas**, **Contatos**.

- **`api.ts`** / **`hooks.ts`**: adicionar `crmApi` para pipelines/stages/activities/insights e hooks `usePipelines`, `useBoard(pipelineId)` (oportunidades open agrupadas por stage), `useActivities(opportunityId)`, `useInsights(pipelineId, range)`.
- **Board do Funil** (`PipelineBoard.tsx`, novo): colunas por `stage` com cabeçalho mostrando **nº de deals + valor total** (como na referência Pipedrive). Cards com barra de cor no topo, título, empresa, valor (BRL), avatar/owner e **indicador de "apodrecendo"** (badge âmbar/vermelho quando `now - stage_changed_at` excede limite). **Drag-and-drop HTML5 nativo** (`draggable`, `onDragStart/onDragOver/onDrop`) entre colunas + drop zones **GANHO** / **PERDIDO** no rodapé (replicando a barra inferior da referência). Atualização otimista + `PATCH reorder`.
- **Detalhe do deal** (`OpportunityDrawer.tsx`, novo): `Drawer`/`Sheet` do AppKit ao clicar no card — edição inline dos campos, mudar funil/estágio, marcar ganho/perdido (com motivo), e **timeline de atividades** (criar/concluir/excluir; ícones lucide por tipo).
- **Relatórios** (`CrmReports.tsx`, novo): `KpiCard`s (total em aberto, valor ponderado, win rate, ticket médio) + gráficos com `ChartContainer` (Recharts): funil de conversão (barras por estágio + % de conversão), forecast (barras por mês de fechamento, valor × ponderado), ganhos×perdas (win rate + motivos de perda), desempenho por responsável (ranking). Filtro por funil e período.
- **Visual/marca**: reusar `PageHeader`, `KpiCard`, `ColorBars`, `Badge` e tokens DEX (`--dex-red`, `--success`, `--shadow-card`); manter `formatBRL`/`formatDateBR` de [lib/format.ts](my-microerp/client/src/lib/format.ts). Header usa logo branca (memória do projeto).

Arquivos-alvo: `my-microerp/client/src/features/crm/{CrmPage.tsx, api.ts, hooks.ts}` + novos `PipelineBoard.tsx`, `OpportunityDrawer.tsx`, `CrmReports.tsx`, `PipelineManager.tsx` (config de funis/estágios).

---

## Spec

Atualizar [specs/feat_0002_crm.md](my-microerp/specs/feat_0002_crm.md) com o novo modelo, contrato de API e estados de UI (obrigatório pela convenção do projeto antes do código).

---

## Verification

1. **Build/types**: `npm run build` (tsc + tsdown + vite) e `npm run typegen` sem erros.
2. **Deploy antes do dev local** (memória do projeto — Service Principal precisa ser dono do schema p/ os `ALTER`): `databricks bundle deploy` e então `npm run dev`.
3. **Migração**: confirmar que oportunidades existentes recebem `stage_id`/`status` no boot (board não fica vazio) e que o funil padrão é semeado uma única vez (rodar `ensureSchema` 2× = idempotente).
4. **Funil**: arrastar card entre colunas persiste (`reorder`); soltar em GANHO/PERDIDO muda `status`; reabrir mantém posição. Indicador de apodrecimento aparece em deal antigo.
5. **Detalhe/atividades**: abrir Drawer, editar campos, criar/concluir atividade, ver na timeline.
6. **Relatórios**: KPIs e os 4 gráficos batem com os dados (validar `GET /api/opportunities/insights` no navegador / DevTools). Conferir cálculo do valor ponderado = `amount * probability/100`.
7. **Regressão**: CRUD de empresas/contatos e DELETE de empresa com vínculo AR/AP (409) continuam funcionando.
8. **Smoke E2E**: estender [tests/smoke.spec.ts](my-microerp/tests/smoke.spec.ts) cobrindo board + relatórios; rodar Playwright.
