# Feature Spec: Contas a Receber (AR)

> **Nota de versão:** a seção **v2 — Integração com CRM (Ganho→AR parcelado)** (no fim deste
> documento) adiciona a coluna opcional `opportunity_id` e a geração automática de títulos
> (parcelas) quando uma oportunidade do CRM é marcada como ganha. O texto abaixo (v1) descreve o
> CRUD/baixa base, que segue válido.

## Summary

Contas a Receber gerencia os **títulos a receber** de clientes: cada título tem cliente,
descrição, valor, vencimento e status (`pending` / `paid` / `overdue`). Oferece CRUD,
ação de **dar baixa** (settle → marca `paid` e registra `paid_at`), filtro por status e
**indicadores agregados** (KPIs). O cliente é sempre uma `crm.companies` com papel
`customer` ou `both` — AR não cadastra contrapartes próprias, apenas referencia o CRM.
Segue o padrão em camadas de `todos`. Contas a Pagar
([feat_0004_accounts_payable.md](feat_0004_accounts_payable.md)) espelha esta spec.

---

## Data Model

Schema PostgreSQL no Lakebase: **`ar`** (criado no boot via `ensureSchema()`).

### Tabela `ar.receivables`

| Coluna | Tipo PostgreSQL | Constraints | Descrição |
|--------|----------------|-------------|-----------|
| `id` | `SERIAL` | `PRIMARY KEY` | Identificador único |
| `customer_id` | `INTEGER` | `NOT NULL REFERENCES crm.companies(id)` | Cliente (CRM) |
| `description` | `TEXT` | `NOT NULL` | Descrição do título |
| `amount` | `NUMERIC(14,2)` | `NOT NULL CHECK (amount > 0)` | Valor a receber |
| `due_date` | `DATE` | `NOT NULL` | Vencimento |
| `status` | `TEXT` | `NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue'))` | Status persistido |
| `paid_at` | `DATE` | `NULL` | Data da baixa (preenchida ao settle) |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Data de criação |

**Regra de status (`overdue` é derivado em leitura):**
- `pending` ao criar; `paid` após a baixa (define `paid_at = today`).
- `overdue` **não é gravado** na coluna — é calculado no SELECT: título `pending` com
  `due_date < CURRENT_DATE` é retornado com `status = 'overdue'` via `CASE`.
  Evita job de atualização periódica. A coluna física só guarda `pending`/`paid`.

```sql
CASE WHEN status = 'pending' AND due_date < CURRENT_DATE
     THEN 'overdue' ELSE status END AS status
```

### Schema Zod (fonte única de verdade em `shared/receivables/schemas.ts`)

```ts
ReceivableSchema = z.object({
  id:            z.number().int().positive(),
  customer_id:   z.number().int().positive(),
  customer_name: z.string(),                 // join com crm.companies
  description:   z.string().min(1),
  amount:        z.number().positive(),
  due_date:      z.string(),                  // YYYY-MM-DD
  status:        z.enum(['pending', 'paid', 'overdue']),  // derivado na leitura
  paid_at:       z.string().nullable(),
  created_at:    z.string(),
})
CreateReceivableBodySchema = z.object({
  customer_id: z.number().int().positive(),
  description: z.string().min(1, 'Description is required').max(500),
  amount:      z.number().positive('Amount must be greater than 0'),
  due_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
})
UpdateReceivableBodySchema = CreateReceivableBodySchema.partial()
ReceivableSummarySchema = z.object({
  total_pending:        z.number(),  // soma dos pending não vencidos
  total_overdue:        z.number(),  // soma dos pending vencidos
  total_received_month: z.number(),  // soma paid com paid_at no mês corrente
  count_overdue:        z.number().int(),
})
ReceivableListResponseSchema = z.array(ReceivableSchema)
ErrorResponseSchema          = z.object({ error: z.string() })  // global
```

**Decisões de banco (convenções Lakebase — ver [specs/README.md](README.md)):**
- Schema `ar` criado no boot; **deploy antes de rodar local** (ownership do Service Principal).
- `created_at`, `due_date`, `paid_at` retornam com cast `::text` no SELECT/RETURNING (casar `z.string()`).
- `amount`/totais (`NUMERIC`) retornam com cast `::float8` (casar `z.number()`).
- `status` na resposta vem do `CASE` derivado, não da coluna crua.
- A FK aponta para `crm.companies` → **CRM deve existir antes de AR** (ordem de implementação).

---

## API Contract

Erros sempre retornam `{ error: string }` (`ErrorResponseSchema`). Rotas em `/api/receivables`.

| Método | Path | Request Body | Response Body | Status |
|--------|------|--------------|---------------|--------|
| `GET` | `/api/receivables?status=pending\|paid\|overdue` | — | `ReceivableListResponseSchema` | `200` |
| `GET` | `/api/receivables/summary` | — | `ReceivableSummarySchema` | `200` |
| `POST` | `/api/receivables` | `CreateReceivableBodySchema` | `ReceivableSchema` | `201` |
| `PATCH` | `/api/receivables/:id` | `UpdateReceivableBodySchema` | `ReceivableSchema` | `200` |
| `POST` | `/api/receivables/:id/settle` | — | `ReceivableSchema` | `200` |
| `DELETE` | `/api/receivables/:id` | — | — | `204` |

- `GET` sem `status` retorna todos; com `?status=overdue` filtra pelos derivados
  (pending + `due_date < hoje`); `?status=pending` exclui os vencidos.
- `GET` faz join com `crm.companies` para `customer_name`; ordena por `due_date ASC`.
- `POST .../settle` é idempotente quanto à intenção mas rejeita re-baixa (ver Error Cases):
  define `status='paid'`, `paid_at = CURRENT_DATE`, retorna o título atualizado.
- `summary` calcula os 4 indicadores numa única query agregada.

---

## Frontend Behavior

### User Stories

- Como usuário, quero ver KPIs no topo (total a receber, total vencido, recebido no mês, nº de vencidos).
- Como usuário, quero listar títulos e filtrar por status (pending/paid/overdue).
- Como usuário, quero cadastrar um título escolhendo o cliente num `<select>`, com descrição,
  valor e vencimento.
- Como usuário, quero **dar baixa** num título pendente com um clique.
- Como usuário, quero editar e excluir um título.

### Estados da UI

| Estado | Quando ocorre | O que exibir |
|--------|--------------|--------------|
| **loading** | Aguardando GET de títulos/summary | skeletons nos KPIs e na tabela |
| **error** | Qualquer operação falha | mensagem inline (cor `--destructive` DEX) |
| **empty** | Lista com 0 itens | "Nenhum título a receber. Cadastre um acima." |
| **filled** | 1+ itens | KPIs + tabela de títulos |

### Componentes

- `ReceivablesPage` — shell; obtém estado de `useReceivables` (lista + summary + ações).
- `useReceivables` — hook: `items[]`, `summary`, `loading`, `error`, `createReceivable`,
  `updateReceivable`, `settleReceivable`, `deleteReceivable`, `filterStatus`.
- **KPIs**: 4 `KpiCard` (componente de marca DEX) no topo — valores em BRL, `count_overdue` em destaque.
- **Filtro**: tabs/segmented por status (Todos · Pendentes · Vencidos · Pagos).
- **Tabela**: cliente, descrição, valor (BRL), vencimento (DD/MM/AAAA), status (badge colorido:
  pending=neutro, overdue=`--destructive`, paid=`--success`), ação "Dar baixa" (oculta se `paid`).
- **Form de novo título**: `<select>` carregado de `GET /api/companies?type=customer` (inclui `both`),
  campos descrição/valor/vencimento. Formatação BRL só na UI (API trafega `number`).
- Aplica identidade visual DEX — ver [feat_0005_design_system_dex.md](feat_0005_design_system_dex.md).

---

## Error Cases

| Situação | Quem detecta | AppError / Resposta | HTTP Status |
|----------|-------------|---------------------|-------------|
| `id` não é inteiro válido | Controller | `{ error: 'Invalid id' }` | `400` |
| `amount <= 0` | Controller (Zod) | `{ error: 'Amount must be greater than 0' }` | `400` |
| `description` ausente/vazia | Controller (Zod) | `{ error: 'Description is required' }` | `400` |
| `due_date` em formato inválido | Controller (Zod) | `{ error: 'Invalid date' }` | `400` |
| `customer_id` inexistente | Repository → FK violation → `AppError(400, 'Customer not found')` | `{ error: 'Customer not found' }` | `400` |
| Título não encontrado (patch/settle/delete) | Repository → `AppError(404, 'Receivable not found')` | `{ error: 'Receivable not found' }` | `404` |
| Dar baixa em título já pago | Service → `AppError(409, 'Already settled')` | `{ error: 'Already settled' }` | `409` |
| Falha de banco | `sendError()` | `{ error: 'Internal server error' }` | `500` |

---

## Migration

Tabela criada via `ReceivableRepository.ensureSchema()` no boot (`CREATE SCHEMA/TABLE IF NOT EXISTS`),
padrão de [todos.repository.ts](../server/features/todos/todos.repository.ts). A criação **assume que o
schema `crm` já existe** (FK `customer_id → crm.companies`). Sem migration separada nesta fase.

Alterações futuras de schema: SQL idempotente em
`server/db/migrations/YYYYMMDDHHMMSS_<descricao>.sql`.

---

## Acceptance Criteria

- [ ] `GET /api/receivables` retorna `[]` quando vazio (não 404)
- [ ] `POST /api/receivables` com `amount: 0` retorna `400` (`Amount must be greater than 0`)
- [ ] `POST /api/receivables` com `{}` retorna `400` (`Description is required`)
- [ ] `POST /api/receivables` com `due_date: '31/12/2026'` retorna `400` (`Invalid date`)
- [ ] `POST /api/receivables` com `customer_id` inexistente retorna `400` (`Customer not found`)
- [ ] `POST /api/receivables` válido retorna `201` com `status: 'pending'`
- [ ] Um título `pending` com `due_date` no passado é retornado com `status: 'overdue'` (derivado)
- [ ] `GET /api/receivables?status=overdue` retorna só os pending vencidos
- [ ] `POST /api/receivables/:id/settle` define `status: 'paid'` e `paid_at` = hoje
- [ ] `POST /api/receivables/:id/settle` num título já pago retorna `409` (`Already settled`)
- [ ] `POST /api/receivables/999/settle` retorna `404` (`Receivable not found`)
- [ ] `GET /api/receivables/summary` retorna os 4 indicadores coerentes com os dados
- [ ] A `ReceivablesPage` exibe KPIs, filtro por status e a tabela com badges de status
- [ ] O `<select>` de cliente lista empresas `customer`/`both` de `GET /api/companies?type=customer`
- [ ] Valores são exibidos em BRL na UI e trafegam como `number` na API

---

# v2 — Integração com CRM (Ganho→AR parcelado)

Quando uma oportunidade do CRM é marcada como ganha, suas **parcelas** são geradas automaticamente
como títulos em `ar.receivables`, vinculados à oportunidade de origem. Ver o fluxo no CRM em
[feat_0002_crm.md](feat_0002_crm.md) (*v3 — item 3*).

## Data Model v2

Coluna adicionada via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` em `ensureSchema` (idempotente):

| Coluna | Tipo PostgreSQL | Constraints | Descrição |
|--------|----------------|-------------|-----------|
| `opportunity_id` | `INTEGER` | `NULL REFERENCES crm.opportunities(id) ON DELETE SET NULL` | Oportunidade que originou o título |

- `ReceivableSchema` ganha `opportunity_id: z.number().int().positive().nullable()`. Todos os
  SELECT/RETURNING (incl. `create`, `update`, `settle`, `findAll`) passam a projetar `opportunity_id`.
- Títulos criados manualmente (`POST /api/receivables`) mantêm `opportunity_id = NULL`.
- **Ordem de boot**: como a FK referencia `crm.opportunities`, o schema do CRM deve ser garantido
  **antes** do `ensureSchema` do AR (orquestrado em `server.ts`).

## Repository/Service v2

- `createForOpportunity(opportunityId, customerId, items[])` — insere N parcelas numa única
  instrução (`INSERT ... SELECT FROM UNNEST(...)`), com `opportunity_id` preenchido; retorna os
  títulos criados (join com `crm.companies`).
- `deletePendingByOpportunity(opportunityId)` — remove os títulos `status='pending'` da oportunidade
  (usado ao **reabrir** uma oportunidade ganha; títulos já baixados permanecem).
- Esses métodos são chamados pelo `CrmService` (não há novas rotas REST de AR para isso — a geração
  acontece via `POST /api/opportunities/:id/win`).

## Acceptance Criteria v2

- [ ] `ensureSchema` adiciona `opportunity_id` de forma idempotente; títulos manuais ficam com `NULL`.
- [ ] Marcar oportunidade como ganha cria 1 título por parcela com `opportunity_id` e valores/vencimentos corretos.
- [ ] Reabrir a oportunidade remove os títulos **pendentes** vinculados; títulos já pagos não são afetados.
- [ ] Excluir a oportunidade (`ON DELETE SET NULL`) mantém os títulos, apenas zera o vínculo.
- [ ] Regressão: CRUD/baixa/summary de AR e o `<select>` de cliente seguem funcionando.
