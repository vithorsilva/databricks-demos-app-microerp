# Feature Spec: CRM

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
