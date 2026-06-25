# Feature Spec: Contas a Pagar (AP)

## Summary

Contas a Pagar gerencia os **títulos a pagar** a fornecedores. É o **espelho** de Contas a
Receber ([feat_0003_accounts_receivable.md](feat_0003_accounts_receivable.md)): mesma estrutura
de CRUD, baixa, filtro por status e KPIs, trocando `receivables`→`payables`,
`customer_id`→`supplier_id`, `customer_name`→`supplier_name`, `total_received_month`→`total_paid_month`,
e o cliente pelo fornecedor (`crm.companies` com papel `supplier` ou `both`). As regras de status
(`pending`/`paid`/`overdue` derivado) são idênticas. Reaproveita as mesmas convenções de UI.

---

## Data Model

Schema PostgreSQL no Lakebase: **`ap`** (criado no boot via `ensureSchema()`).

### Tabela `ap.payables`

| Coluna | Tipo PostgreSQL | Constraints | Descrição |
|--------|----------------|-------------|-----------|
| `id` | `SERIAL` | `PRIMARY KEY` | Identificador único |
| `supplier_id` | `INTEGER` | `NOT NULL REFERENCES crm.companies(id)` | Fornecedor (CRM) |
| `description` | `TEXT` | `NOT NULL` | Descrição do título |
| `amount` | `NUMERIC(14,2)` | `NOT NULL CHECK (amount > 0)` | Valor a pagar |
| `due_date` | `DATE` | `NOT NULL` | Vencimento |
| `status` | `TEXT` | `NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue'))` | Status persistido |
| `paid_at` | `DATE` | `NULL` | Data da baixa (preenchida ao settle) |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Data de criação |

**Regra de status (idêntica a AR — `overdue` derivado em leitura):**
- `pending` ao criar; `paid` após baixa (`paid_at = today`).
- `overdue` não é gravado: título `pending` com `due_date < CURRENT_DATE` é retornado como
  `overdue` via `CASE` no SELECT. Sem job de atualização.

```sql
CASE WHEN status = 'pending' AND due_date < CURRENT_DATE
     THEN 'overdue' ELSE status END AS status
```

### Schema Zod (fonte única de verdade em `shared/payables/schemas.ts`)

```ts
PayableSchema = z.object({
  id:            z.number().int().positive(),
  supplier_id:   z.number().int().positive(),
  supplier_name: z.string(),                 // join com crm.companies
  description:   z.string().min(1),
  amount:        z.number().positive(),
  due_date:      z.string(),                  // YYYY-MM-DD
  status:        z.enum(['pending', 'paid', 'overdue']),  // derivado na leitura
  paid_at:       z.string().nullable(),
  created_at:    z.string(),
})
CreatePayableBodySchema = z.object({
  supplier_id: z.number().int().positive(),
  description: z.string().min(1, 'Description is required').max(500),
  amount:      z.number().positive('Amount must be greater than 0'),
  due_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
})
UpdatePayableBodySchema = CreatePayableBodySchema.partial()
PayableSummarySchema = z.object({
  total_pending:    z.number(),  // soma dos pending não vencidos
  total_overdue:    z.number(),  // soma dos pending vencidos
  total_paid_month: z.number(),  // soma paid com paid_at no mês corrente
  count_overdue:    z.number().int(),
})
PayableListResponseSchema = z.array(PayableSchema)
ErrorResponseSchema       = z.object({ error: z.string() })  // global
```

**Decisões de banco (convenções Lakebase — ver [specs/README.md](README.md)):**
- Schema `ap` criado no boot; **deploy antes de rodar local** (ownership do Service Principal).
- `created_at`, `due_date`, `paid_at` com cast `::text`; `amount`/totais com cast `::float8`.
- `status` na resposta vem do `CASE` derivado.
- FK aponta para `crm.companies` → **CRM antes de AP** (ordem de implementação).

---

## API Contract

Erros sempre retornam `{ error: string }` (`ErrorResponseSchema`). Rotas em `/api/payables`.

| Método | Path | Request Body | Response Body | Status |
|--------|------|--------------|---------------|--------|
| `GET` | `/api/payables?status=pending\|paid\|overdue` | — | `PayableListResponseSchema` | `200` |
| `GET` | `/api/payables/summary` | — | `PayableSummarySchema` | `200` |
| `POST` | `/api/payables` | `CreatePayableBodySchema` | `PayableSchema` | `201` |
| `PATCH` | `/api/payables/:id` | `UpdatePayableBodySchema` | `PayableSchema` | `200` |
| `POST` | `/api/payables/:id/settle` | — | `PayableSchema` | `200` |
| `DELETE` | `/api/payables/:id` | — | — | `204` |

- `GET` sem `status` retorna todos; `?status=overdue` filtra pending vencidos; `?status=pending` exclui vencidos.
- `GET` faz join com `crm.companies` para `supplier_name`; ordena por `due_date ASC`.
- `POST .../settle` define `status='paid'`, `paid_at = CURRENT_DATE`; rejeita re-baixa (409).
- `summary` calcula os 4 indicadores numa única query agregada.

---

## Frontend Behavior

### User Stories

- Como usuário, quero ver KPIs no topo (total a pagar, total vencido, pago no mês, nº de vencidos).
- Como usuário, quero listar títulos e filtrar por status (pending/paid/overdue).
- Como usuário, quero cadastrar um título escolhendo o fornecedor num `<select>`, com descrição,
  valor e vencimento.
- Como usuário, quero **dar baixa** num título pendente com um clique.
- Como usuário, quero editar e excluir um título.

### Estados da UI

| Estado | Quando ocorre | O que exibir |
|--------|--------------|--------------|
| **loading** | Aguardando GET de títulos/summary | skeletons nos KPIs e na tabela |
| **error** | Qualquer operação falha | mensagem inline (cor `--destructive` DEX) |
| **empty** | Lista com 0 itens | "Nenhum título a pagar. Cadastre um acima." |
| **filled** | 1+ itens | KPIs + tabela de títulos |

### Componentes

- `PayablesPage` — shell; obtém estado de `usePayables` (lista + summary + ações).
- `usePayables` — hook: `items[]`, `summary`, `loading`, `error`, `createPayable`,
  `updatePayable`, `settlePayable`, `deletePayable`, `filterStatus`.
- **KPIs**: 4 `KpiCard` (marca DEX) — valores BRL, `count_overdue` em destaque.
- **Filtro**: tabs/segmented por status (Todos · Pendentes · Vencidos · Pagos).
- **Tabela**: fornecedor, descrição, valor (BRL), vencimento (DD/MM/AAAA), status (badge:
  pending=neutro, overdue=`--destructive`, paid=`--success`), ação "Dar baixa" (oculta se `paid`).
- **Form de novo título**: `<select>` de `GET /api/companies?type=supplier` (inclui `both`),
  campos descrição/valor/vencimento. BRL só na UI.
- Reaproveita os componentes e o layout de AR; aplica identidade visual DEX —
  ver [feat_0005_design_system_dex.md](feat_0005_design_system_dex.md).

---

## Error Cases

| Situação | Quem detecta | AppError / Resposta | HTTP Status |
|----------|-------------|---------------------|-------------|
| `id` não é inteiro válido | Controller | `{ error: 'Invalid id' }` | `400` |
| `amount <= 0` | Controller (Zod) | `{ error: 'Amount must be greater than 0' }` | `400` |
| `description` ausente/vazia | Controller (Zod) | `{ error: 'Description is required' }` | `400` |
| `due_date` em formato inválido | Controller (Zod) | `{ error: 'Invalid date' }` | `400` |
| `supplier_id` inexistente | Repository → FK violation → `AppError(400, 'Supplier not found')` | `{ error: 'Supplier not found' }` | `400` |
| Título não encontrado (patch/settle/delete) | Repository → `AppError(404, 'Payable not found')` | `{ error: 'Payable not found' }` | `404` |
| Dar baixa em título já pago | Service → `AppError(409, 'Already settled')` | `{ error: 'Already settled' }` | `409` |
| Falha de banco | `sendError()` | `{ error: 'Internal server error' }` | `500` |

---

## Migration

Tabela criada via `PayableRepository.ensureSchema()` no boot (`CREATE SCHEMA/TABLE IF NOT EXISTS`),
padrão de [todos.repository.ts](../server/features/todos/todos.repository.ts). Assume schema `crm`
já existente (FK `supplier_id → crm.companies`). Sem migration separada nesta fase.

Alterações futuras: SQL idempotente em `server/db/migrations/YYYYMMDDHHMMSS_<descricao>.sql`.

---

## Acceptance Criteria

- [ ] `GET /api/payables` retorna `[]` quando vazio (não 404)
- [ ] `POST /api/payables` com `amount: 0` retorna `400` (`Amount must be greater than 0`)
- [ ] `POST /api/payables` com `{}` retorna `400` (`Description is required`)
- [ ] `POST /api/payables` com `due_date` inválida retorna `400` (`Invalid date`)
- [ ] `POST /api/payables` com `supplier_id` inexistente retorna `400` (`Supplier not found`)
- [ ] `POST /api/payables` válido retorna `201` com `status: 'pending'`
- [ ] Um título `pending` vencido é retornado com `status: 'overdue'` (derivado)
- [ ] `GET /api/payables?status=overdue` retorna só os pending vencidos
- [ ] `POST /api/payables/:id/settle` define `status: 'paid'` e `paid_at` = hoje
- [ ] `POST /api/payables/:id/settle` num título já pago retorna `409` (`Already settled`)
- [ ] `POST /api/payables/999/settle` retorna `404` (`Payable not found`)
- [ ] `GET /api/payables/summary` retorna os 4 indicadores (inclui `total_paid_month`)
- [ ] A `PayablesPage` exibe KPIs, filtro por status e a tabela com badges
- [ ] O `<select>` de fornecedor lista empresas `supplier`/`both` de `GET /api/companies?type=supplier`
- [ ] Valores em BRL na UI e `number` na API
