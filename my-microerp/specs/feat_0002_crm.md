# Feature Spec: CRM

> **Nota de versão:** a seção **v2 — Funil configurável, Atividades e Relatórios** (no fim
> deste documento) estende e, onde indicado, **supera** o modelo descrito abaixo (v1). O board
> deixou de ser read-only/enum fixo: agora há funis e estágios configuráveis (`crm.pipelines`,
> `crm.stages`), arrastar-e-soltar, ganho/perda como `status`, atividades (`crm.activities`) e
> relatórios. O texto v1 é mantido como histórico do CRUD base.

## Summary

O CRM é a **fonte única de contrapartes** do Micro ERP: empresas/pessoas que são clientes
e/ou fornecedores, seus contatos vinculados e um pipeline de oportunidades de venda.
Tanto Contas a Receber (`customer_id`) quanto Contas a Pagar (`supplier_id`) referenciam
`crm.companies` — por isso o CRM é o **primeiro módulo de dados a ser implementado** (base
das FKs). O domínio entrega CRUD de empresas e contatos e um board kanban simples (read-only
com ação de avançar estágio) para o pipeline. Segue o mesmo padrão em camadas de `todos`.

---

## Data Model

Schema PostgreSQL no Lakebase: **`crm`** (criado no boot via `ensureSchema()`, padrão `todos`).

### Tabela `crm.companies`

| Coluna | Tipo PostgreSQL | Constraints | Descrição |
|--------|----------------|-------------|-----------|
| `id` | `SERIAL` | `PRIMARY KEY` | Identificador único |
| `name` | `TEXT` | `NOT NULL` | Razão social / nome |
| `type` | `TEXT` | `NOT NULL CHECK (type IN ('customer','supplier','both'))` | Papel da contraparte |
| `tax_id` | `TEXT` | `NULL` | CNPJ/CPF |
| `email` | `TEXT` | `NULL` | E-mail principal |
| `phone` | `TEXT` | `NULL` | Telefone |
| `notes` | `TEXT` | `NULL` | Observações livres |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Data de criação |

### Tabela `crm.contacts`

| Coluna | Tipo PostgreSQL | Constraints | Descrição |
|--------|----------------|-------------|-----------|
| `id` | `SERIAL` | `PRIMARY KEY` | Identificador único |
| `company_id` | `INTEGER` | `NOT NULL REFERENCES crm.companies(id) ON DELETE CASCADE` | Empresa vinculada |
| `name` | `TEXT` | `NOT NULL` | Nome da pessoa |
| `role` | `TEXT` | `NULL` | Cargo |
| `email` | `TEXT` | `NULL` | E-mail |
| `phone` | `TEXT` | `NULL` | Telefone |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Data de criação |

### Tabela `crm.opportunities`

| Coluna | Tipo PostgreSQL | Constraints | Descrição |
|--------|----------------|-------------|-----------|
| `id` | `SERIAL` | `PRIMARY KEY` | Identificador único |
| `company_id` | `INTEGER` | `NOT NULL REFERENCES crm.companies(id) ON DELETE CASCADE` | Empresa do negócio |
| `title` | `TEXT` | `NOT NULL` | Título da oportunidade |
| `stage` | `TEXT` | `NOT NULL DEFAULT 'lead' CHECK (stage IN ('lead','qualified','proposal','won','lost'))` | Estágio do funil |
| `amount` | `NUMERIC(14,2)` | `NULL` | Valor estimado |
| `owner` | `TEXT` | `NULL` | Responsável |
| `expected_close` | `DATE` | `NULL` | Previsão de fechamento |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Data de criação |

### Schemas Zod (fonte única de verdade em `shared/crm/schemas.ts`)

```ts
// Companies
CompanySchema = z.object({
  id:         z.number().int().positive(),
  name:       z.string().min(1),
  type:       z.enum(['customer', 'supplier', 'both']),
  tax_id:     z.string().nullable(),
  email:      z.string().nullable(),
  phone:      z.string().nullable(),
  notes:      z.string().nullable(),
  created_at: z.string(),
})
CreateCompanyBodySchema = z.object({
  name:   z.string().min(1, 'Name is required').max(200),
  type:   z.enum(['customer', 'supplier', 'both']),
  tax_id: z.string().max(40).nullish(),
  email:  z.string().email().max(200).nullish(),
  phone:  z.string().max(40).nullish(),
  notes:  z.string().max(2000).nullish(),
})
UpdateCompanyBodySchema = CreateCompanyBodySchema.partial()

// Contacts
ContactSchema = z.object({
  id:         z.number().int().positive(),
  company_id: z.number().int().positive(),
  name:       z.string().min(1),
  role:       z.string().nullable(),
  email:      z.string().nullable(),
  phone:      z.string().nullable(),
  created_at: z.string(),
})
CreateContactBodySchema = z.object({
  company_id: z.number().int().positive(),
  name:       z.string().min(1, 'Name is required').max(200),
  role:       z.string().max(120).nullish(),
  email:      z.string().email().max(200).nullish(),
  phone:      z.string().max(40).nullish(),
})
UpdateContactBodySchema = CreateContactBodySchema.partial()

// Opportunities
OpportunitySchema = z.object({
  id:             z.number().int().positive(),
  company_id:     z.number().int().positive(),
  company_name:   z.string(),         // join com crm.companies
  title:          z.string().min(1),
  stage:          z.enum(['lead', 'qualified', 'proposal', 'won', 'lost']),
  amount:         z.number().nullable(),
  owner:          z.string().nullable(),
  expected_close: z.string().nullable(),
  created_at:     z.string(),
})
CreateOpportunityBodySchema = z.object({
  company_id:     z.number().int().positive(),
  title:          z.string().min(1, 'Title is required').max(200),
  stage:          z.enum(['lead', 'qualified', 'proposal', 'won', 'lost']).optional(),
  amount:         z.number().positive().nullish(),
  owner:          z.string().max(120).nullish(),
  expected_close: z.string().nullish(),  // YYYY-MM-DD
})
UpdateOpportunityBodySchema = CreateOpportunityBodySchema.partial()

CompanyListResponseSchema      = z.array(CompanySchema)
ContactListResponseSchema      = z.array(ContactSchema)
OpportunityListResponseSchema  = z.array(OpportunitySchema)
ErrorResponseSchema            = z.object({ error: z.string() })  // reusa o global
```

**Decisões de banco (convenções Lakebase — ver [specs/README.md](README.md)):**
- O schema `crm` é criado no boot via `CrmRepository.ensureSchema()` com `CREATE SCHEMA/TABLE IF NOT EXISTS`.
  **Fazer deploy antes de rodar local** para que o Service Principal seja dono do schema (senão
  `permission denied for schema crm`).
- Toda coluna `TIMESTAMPTZ`/`DATE` retorna no SELECT/RETURNING com cast `::text`
  (ex.: `created_at::text`, `expected_close::text`) para casar com `z.string()` no Zod.
- `amount` (`NUMERIC`) é retornado pelo driver `pg` como string → o repository faz cast
  `amount::float8` no SELECT (ou converte com `Number()`) para casar com `z.number()`.
- A ordem das tabelas no `CREATE` respeita a FK: `companies` antes de `contacts`/`opportunities`.

---

## API Contract

Erros sempre retornam `{ error: string }` (`ErrorResponseSchema`). Rotas em `/api/<plural>`.

### Companies — `/api/companies`

| Método | Path | Request Body | Response Body | Status |
|--------|------|--------------|---------------|--------|
| `GET` | `/api/companies?type=customer\|supplier\|both` | — | `CompanyListResponseSchema` | `200` |
| `POST` | `/api/companies` | `CreateCompanyBodySchema` | `CompanySchema` | `201` |
| `PATCH` | `/api/companies/:id` | `UpdateCompanyBodySchema` | `CompanySchema` | `200` |
| `DELETE` | `/api/companies/:id` | — | — | `204` |

- `GET` aceita filtro opcional `?type=`. Para os selects de contraparte de AR/AP, o filtro
  `?type=customer` (ou `supplier`) **inclui também `both`** (ex.: `type IN ('customer','both')`).
- Ordenação por `name ASC`.

### Contacts — `/api/contacts`

| Método | Path | Request Body | Response Body | Status |
|--------|------|--------------|---------------|--------|
| `GET` | `/api/contacts?company_id=:id` | — | `ContactListResponseSchema` | `200` |
| `POST` | `/api/contacts` | `CreateContactBodySchema` | `ContactSchema` | `201` |
| `PATCH` | `/api/contacts/:id` | `UpdateContactBodySchema` | `ContactSchema` | `200` |
| `DELETE` | `/api/contacts/:id` | — | — | `204` |

- `GET` sem `company_id` retorna todos; com `company_id` filtra pela empresa.

### Opportunities — `/api/opportunities`

| Método | Path | Request Body | Response Body | Status |
|--------|------|--------------|---------------|--------|
| `GET` | `/api/opportunities` | — | `OpportunityListResponseSchema` | `200` |
| `POST` | `/api/opportunities` | `CreateOpportunityBodySchema` | `OpportunitySchema` | `201` |
| `PATCH` | `/api/opportunities/:id` | `UpdateOpportunityBodySchema` | `OpportunitySchema` | `200` |
| `DELETE` | `/api/opportunities/:id` | — | — | `204` |

- `PATCH` cobre tanto avançar estágio (`{ stage }`) quanto editar dados.
- `GET` faz join com `crm.companies` para preencher `company_name`; ordena por `created_at DESC`.

---

## Frontend Behavior

### User Stories

- Como usuário, quero listar empresas e filtrar por papel (cliente/fornecedor/ambos).
- Como usuário, quero cadastrar uma empresa informando nome e tipo (demais campos opcionais).
- Como usuário, quero editar e remover uma empresa.
- Como usuário, quero ver os contatos de uma empresa e adicionar/editar/remover contatos.
- Como usuário, quero visualizar o pipeline como um board por estágio e avançar uma oportunidade
  de estágio com um clique (PATCH `stage`).
- Como usuário, quero criar uma oportunidade vinculada a uma empresa.

### Estados da UI

| Estado | Quando ocorre | O que exibir |
|--------|--------------|--------------|
| **loading** | Aguardando GET inicial de cada aba | skeletons (linhas de tabela / colunas do board) |
| **error** | Qualquer operação falha | mensagem de erro inline (cor `--destructive` DEX) |
| **empty** | Lista carregada com 0 itens | texto orientativo ("Nenhuma empresa cadastrada.", etc.) |
| **filled** | 1+ itens | tabela (Empresas/Contatos) ou board kanban (Pipeline) |

### Componentes

- `CrmPage` — shell com 3 abas/seções: **Empresas**, **Contatos**, **Pipeline**.
- `useCompanies`, `useContacts`, `useOpportunities` — hooks (estado + chamadas a `crmApi.*`).
- **Empresas**: tabela (nome, tipo, e-mail, telefone) + form inline de cadastro + filtro por tipo.
- **Contatos**: `<select>` de empresa + tabela de contatos da empresa selecionada + form de cadastro.
- **Pipeline**: board com 5 colunas por `stage` (lead → qualified → proposal → won/lost).
  Cada card mostra título, empresa, valor (BRL) e botão "Avançar →" (PATCH `stage` para o próximo).
  Read-only quanto a drag-and-drop; a movimentação é via botão. Aplica componentes de marca DEX
  (`PageHeader`, `Redline`) — ver [feat_0005_design_system_dex.md](feat_0005_design_system_dex.md).

---

## Error Cases

| Situação | Quem detecta | AppError / Resposta | HTTP Status |
|----------|-------------|---------------------|-------------|
| `id` não é inteiro válido | Controller | `{ error: 'Invalid id' }` | `400` |
| `name` ausente/vazio (company/contact) | Controller (Zod `.safeParse`) | `{ error: 'Name is required' }` | `400` |
| `type` inválido (≠ customer/supplier/both) | Controller (Zod) | `{ error: 'Invalid type' }` | `400` |
| `stage` inválido em opportunity | Controller (Zod) | `{ error: 'Invalid stage' }` | `400` |
| `company_id` inexistente (contact/opportunity) | Repository → FK violation → `AppError(400, 'Company not found')` | `{ error: 'Company not found' }` | `400` |
| Empresa não encontrada (patch/delete) | Repository → `AppError(404, 'Company not found')` | `{ error: 'Company not found' }` | `404` |
| Contato/Oportunidade não encontrado | Repository → `AppError(404, '... not found')` | `{ error: '... not found' }` | `404` |
| Deletar empresa com títulos AR/AP vinculados | Service → checa `ar.receivables`/`ap.payables` → `AppError(409, 'Company has linked records')` | `{ error: 'Company has linked records' }` | `409` |
| Falha de banco | `sendError()` | `{ error: 'Internal server error' }` | `500` |

> **Nota:** `crm.contacts`/`crm.opportunities` usam `ON DELETE CASCADE` (somem com a empresa).
> Já AR/AP **bloqueiam** a exclusão (409) — o service verifica essas duas tabelas antes do DELETE.

---

## Migration

Tabelas criadas via `CrmRepository.ensureSchema()` em tempo de boot (`CREATE SCHEMA/TABLE IF NOT EXISTS`),
seguindo o padrão de [todos.repository.ts](../server/features/todos/todos.repository.ts). Sem arquivo
de migration separado nesta fase de protótipo.

Para alterações futuras de schema, criar SQL idempotente em:
```
server/db/migrations/YYYYMMDDHHMMSS_<descricao>.sql
```

---

## Acceptance Criteria

- [ ] `GET /api/companies` retorna `[]` quando vazio (não 404)
- [ ] `GET /api/companies?type=customer` retorna empresas `customer` **e** `both`
- [ ] `POST /api/companies` com `{}` retorna `400` com `{ error: 'Name is required' }`
- [ ] `POST /api/companies` com `type: 'parceiro'` retorna `400` (`Invalid type`)
- [ ] `POST /api/companies` válido retorna `201` com o registro criado
- [ ] `PATCH /api/companies/999` (inexistente) retorna `404`
- [ ] `POST /api/contacts` com `company_id` inexistente retorna `400` (`Company not found`)
- [ ] `GET /api/contacts?company_id=:id` retorna apenas contatos daquela empresa
- [ ] `POST /api/opportunities` cria com `stage='lead'` por padrão quando omitido
- [ ] `PATCH /api/opportunities/:id` com `{ stage: 'won' }` move o card de coluna no board
- [ ] `DELETE` de empresa com título AR/AP vinculado retorna `409` (`Company has linked records`)
- [ ] `DELETE` de empresa sem vínculos retorna `204` e remove contatos/oportunidades em cascata
- [ ] A `CrmPage` exibe 3 abas e os estados loading/error/empty/filled em cada uma
- [ ] O board do Pipeline exibe 5 colunas por `stage` e o botão "Avançar" emite PATCH

---

# v2 — Funil configurável, Atividades e Relatórios

Evolução do CRM para capacidades próximas do Pipedrive: **gestão de funil** (múltiplos funis,
estágios configuráveis, arrastar-e-soltar, ganho/perda, deal apodrecendo) e **relatórios de
oportunidades** (funil de conversão, forecast, ganhos×perdas, desempenho por responsável).
Sem novas dependências: drag-and-drop HTML5 nativo e gráficos via `BarChart`/`DonutChart`/
`LineChart` de `@databricks/appkit-ui`.

## Data Model v2

### Novas tabelas

**`crm.pipelines`** — `id SERIAL PK`, `name TEXT NOT NULL`, `position INTEGER NOT NULL DEFAULT 0`,
`created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.

**`crm.stages`** — `id SERIAL PK`, `pipeline_id INTEGER NOT NULL REFERENCES crm.pipelines(id) ON DELETE CASCADE`,
`name TEXT NOT NULL`, `position INTEGER NOT NULL DEFAULT 0`,
`probability INTEGER NOT NULL DEFAULT 100 CHECK (probability BETWEEN 0 AND 100)`,
`created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.

**`crm.activities`** — `id SERIAL PK`, `opportunity_id INTEGER NOT NULL REFERENCES crm.opportunities(id) ON DELETE CASCADE`,
`type TEXT NOT NULL CHECK (type IN ('call','email','meeting','task','note'))`,
`subject TEXT NOT NULL`, `notes TEXT`, `due_date TIMESTAMPTZ`, `done BOOLEAN NOT NULL DEFAULT false`,
`created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.

### Evolução de `crm.opportunities` (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`)

`pipeline_id INTEGER REFERENCES crm.pipelines(id)`, `stage_id INTEGER REFERENCES crm.stages(id)`,
`status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','won','lost'))`, `lost_reason TEXT`,
`sort_index INTEGER NOT NULL DEFAULT 0`, `stage_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
`won_at TIMESTAMPTZ`, `lost_at TIMESTAMPTZ`. Coluna legada `stage` é mantida (não removida); as
leituras passam a usar `stage_id`/`status`.

### Seed + migração (idempotente, em `ensureSchema`)

- Sem pipeline existente → cria **"Funil de Vendas"** com estágios `Lead`(20), `Qualificado`(40),
  `Proposta`(60), `Negociação`(80).
- Backfill de oportunidades com `stage_id IS NULL`: enum legado → `stage_id` do funil padrão;
  `stage='won'→status='won'`, `stage='lost'→status='lost'`, demais → `status='open'`. `pipeline_id`
  recebe o funil padrão.

## API Contract v2

- **Pipelines** — `GET /api/pipelines` (estágios aninhados, ordenados por `position`), `POST /api/pipelines`,
  `PATCH /api/pipelines/:id`, `DELETE /api/pipelines/:id` (409 se for o último funil).
- **Stages** — `POST /api/stages`, `PATCH /api/stages/:id`, `DELETE /api/stages/:id` (409 se houver
  oportunidades abertas no estágio), `PATCH /api/stages/reorder` `{ items:[{id,position}] }`.
- **Opportunities** — `GET /api/opportunities?pipeline_id=&status=` (board usa `status=open`);
  `POST`/`PATCH`/`DELETE` como v1 + `PATCH` aceita `stage_id`, `status`, `lost_reason`, `sort_index`
  (mover coluna atualiza `stage_changed_at`; `status` ganho/perda seta `won_at`/`lost_at`);
  `PATCH /api/opportunities/reorder` `{ items:[{id,stage_id,sort_index}] }`.
- **Activities** — `GET /api/activities?opportunity_id=`, `POST`, `PATCH /api/activities/:id`
  (toggle `done`/editar), `DELETE /api/activities/:id`.
- **Insights** — `GET /api/opportunities/insights?pipeline_id=&from=&to=` → `{ funnel, forecast,
  won_lost, owner_performance }` (agregações SQL no repository; `weighted = amount*probability/100`).

## Frontend Behavior v2

`CrmPage` reorganizada em abas **Funil**, **Relatórios**, **Empresas**, **Contatos**.

- **Funil** (`PipelineBoard`): seletor de funil; colunas por estágio com cabeçalho `nº deals · valor
  total`; cards com barra de cor, título, empresa, valor (BRL), owner e selo de "apodrecendo"
  (`now - stage_changed_at` > limite); **drag-and-drop HTML5** entre colunas + drop zones **GANHO**/
  **PERDIDO**; atualização otimista + `PATCH /reorder`.
- **Detalhe** (`OpportunityDrawer`, `Sheet`): edição inline, mudar funil/estágio, marcar ganho/perdido
  (com motivo), timeline de atividades (criar/concluir/excluir, ícone por tipo).
- **Relatórios** (`CrmReports`): `KpiCard`s (em aberto, valor ponderado, win rate, ticket médio) +
  4 gráficos (funil de conversão, forecast por mês, ganhos×perdas + motivos, desempenho por owner),
  com filtro de funil e período.
- **Gestor de funis** (`PipelineManager`): criar/renomear funil, criar/renomear/reordenar/excluir
  estágios e ajustar probabilidade.

## Acceptance Criteria v2

- [ ] `ensureSchema` cria pipelines/stages/activities, semeia o funil padrão **uma vez** e faz backfill
      (idempotente em execuções repetidas).
- [ ] `GET /api/opportunities?pipeline_id=&status=open` retorna oportunidades abertas com `stage_name`/`probability`.
- [ ] Arrastar um card e soltar em outra coluna persiste via `PATCH /api/opportunities/reorder`.
- [ ] Soltar em GANHO/PERDIDO muda `status` e seta `won_at`/`lost_at`; perda exige/registra `lost_reason`.
- [ ] `DELETE /api/stages/:id` com oportunidades abertas retorna `409`.
- [ ] `GET /api/opportunities/insights` retorna as 4 seções com `weighted = amount*probability/100`.
- [ ] Drawer cria/conclui/exclui atividades em `crm.activities`.
- [ ] Regressão: CRUD de empresas/contatos e `DELETE` de empresa com AR/AP vinculado (409) seguem funcionando.
