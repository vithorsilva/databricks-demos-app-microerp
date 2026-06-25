# Especificação de Desenvolvimento — Micro ERP DEX

## Context

O usuário quer um **Micro ERP** com três módulos básicos — **Contas a Pagar (AP)**,
**Contas a Receber (AR)** e **CRM** — sobre o app já scaffolded em `my-microerp/`
(Databricks AppKit: React 19 + Express + Lakebase PostgreSQL). O app hoje só tem a
feature de exemplo `todos`. O projeto adota **Spec-Driven Development (SDD)**:
toda feature começa por `specs/<feature>.md` antes de qualquer código
([my-microerp/specs/README.md](my-microerp/specs/README.md)), e segue uma arquitetura
em camadas rígida ([my-microerp/CLAUDE.md](my-microerp/CLAUDE.md)).

Decisões confirmadas com o usuário:
- **Modelagem integrada**: o CRM é a fonte única de contrapartes (empresas/contatos).
  AR referencia `cliente_id`; AP referencia `fornecedor_id` — ambos apontando para `crm.companies`.
- **AP/AR = CRUD + baixa/status**: títulos com vencimento, valor e status
  (`pending` / `paid` / `overdue`), ação de "dar baixa", filtro por status e indicadores agregados.
- **CRM = Contatos/Empresas + Pipeline** de oportunidades.
- **Identidade visual DEX** entra como uma feature de design system (tokens, marca, regras).

O entregável desta tarefa é o **conjunto de specs SDD** (um arquivo por domínio) +
a spec do design system DEX, prontas para guiar a implementação. As specs ficam em
`my-microerp/specs/`. Nenhum código é escrito nesta fase — as specs são o artefato.

> **Nota de escopo:** o resultado do plano é *escrever os arquivos de spec*. A implementação
> de cada módulo (schemas Zod → repository → service → controller → router → page/hook)
> acontece depois, guiada por estas specs, na ordem da seção "Ordem de Implementação".

---

## Arquitetura-alvo (resumo do padrão existente)

Cada feature replica o padrão de `todos` ([my-microerp/CLAUDE.md](my-microerp/CLAUDE.md)):

```
shared/<feature>/schemas.ts      ← fonte única de verdade (Zod); types via z.infer
shared/<feature>/types.ts
shared/index.ts                  ← re-exporta schemas + types
server/features/<feature>/
  <feature>.repository.ts        ← SQL puro + Schema.parse(rows); ensureSchema()
  <feature>.service.ts           ← regras de negócio, lança AppError
  <feature>.controller.ts        ← Zod .safeParse(req.body), sendError(), res.json()
  <feature>.router.ts            ← appkit.server.extend()
server/server.ts                 ← registra os routers em onPluginsReady
client/src/features/<feature>/
  api.ts                         ← api.get/post/patch/delete (de client/src/api)
  hooks.ts                       ← useState/useEffect, chama <feature>Api.*
  <Feature>Page.tsx              ← UI; estados loading/error/empty/filled
client/src/App.tsx               ← adiciona rota + NavLink
```

Convenções herdadas (não reinventar):
- Erros sempre `{ error: string }` (`ErrorResponseSchema`), via `sendError()` em
  [server/lib/errors.ts](my-microerp/server/lib/errors.ts) e `AppError(status, msg)`.
- Repository cria schema no boot com `CREATE SCHEMA/TABLE IF NOT EXISTS`
  (ver [todos.repository.ts](my-microerp/server/features/todos/todos.repository.ts)) — sem migrations separadas para protótipo.
- Server importa shared com path relativo `../../../shared/<f>/schemas.js`; client usa alias `@shared/<f>/types.js`.
- Rotas: `/api/<recurso-plural>`.

---

## Modelo de Dados (visão integrada)

Três schemas PostgreSQL no Lakebase: `crm`, `ap`, `ar`. (Mantém o padrão `app.*` do todos; cada domínio ganha seu schema.)

**CRM**
- `crm.companies` — empresas/pessoas que são cliente e/ou fornecedor
  `id SERIAL PK · name TEXT NOT NULL · type TEXT CHECK (customer|supplier|both) · tax_id TEXT · email TEXT · phone TEXT · notes TEXT · created_at TIMESTAMPTZ`
- `crm.contacts` — pessoas vinculadas a uma empresa
  `id · company_id FK→crm.companies(id) · name NOT NULL · role TEXT · email TEXT · phone TEXT · created_at`
- `crm.opportunities` — pipeline de vendas
  `id · company_id FK→crm.companies(id) · title NOT NULL · stage TEXT CHECK (lead|qualified|proposal|won|lost) · amount NUMERIC(14,2) · owner TEXT · expected_close DATE · created_at`

**Contas a Receber (AR)**
- `ar.receivables`
  `id · customer_id FK→crm.companies(id) · description TEXT NOT NULL · amount NUMERIC(14,2) NOT NULL CHECK > 0 · due_date DATE NOT NULL · status TEXT CHECK (pending|paid|overdue) DEFAULT 'pending' · paid_at DATE NULL · created_at`

**Contas a Pagar (AP)**
- `ap.payables`
  `id · supplier_id FK→crm.companies(id) · description TEXT NOT NULL · amount NUMERIC(14,2) NOT NULL CHECK > 0 · due_date DATE NOT NULL · status TEXT CHECK (pending|paid|overdue) DEFAULT 'pending' · paid_at DATE NULL · created_at`

**Regras de status (AP e AR, idênticas):**
- `pending` ao criar. `paid` após baixa (define `paid_at`). `overdue` é **derivado em leitura**:
  título `pending` com `due_date < hoje` é exibido como `overdue` (não muda a coluna; o repository calcula no SELECT via `CASE`). Decisão registrada para evitar job de atualização.

**Valores monetários:** `NUMERIC(14,2)` no banco; no Zod e na API trafegam como **número** (`z.number()`), formatação BRL só na UI.

---

## Specs a criar (arquivos entregues por esta tarefa)

Ordem dos arquivos em `my-microerp/specs/` (numeração contínua à existente `feat_0001_todos.md`):

1. `feat_0002_crm.md` — **CRM** (companies, contacts, opportunities)
2. `feat_0003_accounts_receivable.md` — **Contas a Receber**
3. `feat_0004_accounts_payable.md` — **Contas a Pagar**
4. `feat_0005_design_system_dex.md` — **Identidade visual DEX**

Cada spec dos módulos segue **exatamente** o template de
[specs/README.md](my-microerp/specs/README.md): Summary · Data Model · API Contract ·
Frontend Behavior (user stories + estados loading/error/empty/filled + componentes) ·
Error Cases · Migration · Acceptance Criteria.

### feat_0002_crm.md — contrato resumido
- **API** (`/api/companies`, `/api/contacts`, `/api/opportunities`):
  - `GET/POST /api/companies`, `PATCH/DELETE /api/companies/:id` (filtro `?type=`)
  - `GET/POST /api/contacts` (`?company_id=`), `PATCH/DELETE /api/contacts/:id`
  - `GET/POST /api/opportunities`, `PATCH /api/opportunities/:id` (mudar stage/dados), `DELETE`
- **Schemas Zod** em `shared/crm/schemas.ts`: `CompanySchema`, `CreateCompanyBodySchema`,
  `UpdateCompanyBodySchema`, `ContactSchema`, `OpportunitySchema`, `*BodySchema`, list responses.
- **Frontend**: página `CrmPage` com 3 abas/seções (Empresas, Contatos, Pipeline).
  Pipeline em colunas por `stage` (board kanban simples read-only + ação de avançar estágio via PATCH).
- **Error cases**: empresa não encontrada (404); `name` vazio (400); `type` inválido (400);
  deletar empresa com títulos vinculados → 409 com `{ error: 'Company has linked records' }`.

### feat_0003_accounts_receivable.md — contrato resumido
- **API** (`/api/receivables`):
  - `GET /api/receivables?status=pending|paid|overdue` (status `overdue` filtra os derivados)
  - `POST /api/receivables` (body: `customer_id, description, amount, due_date`)
  - `PATCH /api/receivables/:id` (editar campos) e `POST /api/receivables/:id/settle` (baixa → `paid` + `paid_at = today`)
  - `DELETE /api/receivables/:id`
  - `GET /api/receivables/summary` → `{ total_pending, total_overdue, total_received_month, count_overdue }`
- **Schemas** em `shared/receivables/schemas.ts`: `ReceivableSchema` (inclui `customer_name` join,
  `status` derivado), `CreateReceivableBodySchema`, `UpdateReceivableBodySchema`, `ReceivableSummarySchema`.
- **Frontend** `ReceivablesPage`: KPIs no topo (cards com indicadores DEX), filtro por status,
  tabela de títulos (cliente, descrição, valor BRL, vencimento, status badge), botão "Dar baixa",
  form de novo título com `<select>` de cliente (busca em `/api/companies?type=customer|both`).
- **Error cases**: `amount <= 0` (400); `customer_id` inexistente (400/404); `due_date` inválida (400);
  baixa de título já pago (409 `Already settled`); título não encontrado (404).

### feat_0004_accounts_payable.md — contrato resumido
- Espelha AR trocando `receivables`→`payables`, `customer_id`→`supplier_id`,
  `total_received_month`→`total_paid_month`, e fornecedores filtrados por `type=supplier|both`.
- Mesma estrutura de KPIs, filtro, baixa e error cases. Reaproveita as mesmas convenções de UI.

### feat_0005_design_system_dex.md — identidade visual
Documenta como aplicar o **PADRÃO VISUAL DEX (tema claro)** sobre o AppKit/shadcn:

- **Mapeamento de tokens** em [client/src/index.css](my-microerp/client/src/index.css)
  (hoje os tokens shadcn estão comentados → usam default). Descomentar `:root` e mapear:
  | Token shadcn | Valor DEX |
  |---|---|
  | `--primary` | `#0d4a8b` (dex-blue) — estrutural/interativo |
  | `--primary-foreground` | `#ffffff` |
  | `--background` | `#ffffff` (canvas branco predominante) |
  | `--foreground` | `#051a35` (dex-blue-dark) |
  | `--card` / `--popover` | `#ffffff` |
  | `--muted` | `#f4f5f8` (bg-subtle: sidebar/header/seções) |
  | `--muted-foreground` | `#6b7080` (fg-tertiary) |
  | `--accent` / `--destructive` | `#ed1c24` (dex-red — só acento/CTA) |
  | `--border` / `--input` | `#e8eaf0` |
  | `--ring` | `rgba(13,74,139,0.15)` (foco azul) |
  | `--success` | `#1d8a3e` · `--warning`/danger conforme paleta |
  | `--radius` | `6px` (cards 6–8px) |
  - Valores literais hex/oklch; manter **somente tema claro** (remover/neutralizar o bloco `prefers-color-scheme: dark`, pois a marca define tema claro).
  - Variáveis de marca extra (`--dex-red-deep`, `--grad-blue`, sombras `--shadow-card/modal`) adicionadas como custom properties próprias para uso pontual.
- **Componentes de marca** (novos, em `client/src/components/brand/`):
  - `Redline` — barra 56×4px, raio 2px, `--dex-red`, **sempre antes** de título/section-tag.
  - `ColorBars` — assinatura rodapé (vermelho·azul·branco·azul·vermelho).
  - `PageHeader` — título com 1ª palavra em `--dex-red` (foco) + Redline acima + subtítulo.
  - `KpiCard` — card branco, borda `--border`, hover sobe 3px + `--shadow-card` + borda `--dex-red`.
- **Aplicação no layout** ([client/src/App.tsx](my-microerp/client/src/App.tsx)):
  header com faixa `--grad-header`, logo COLORIDA DEX sobre branco, nav com estado ativo azul,
  `ColorBars` no rodapé. NavLinks: Home · CRM · A Receber · A Pagar.
- **Regras de aplicação** (replicadas do briefing como checklist): vermelho só como acento;
  azul estrutural; sem emoji decorativo; setas funcionais ok (→ ↑ ↗ ★ ·); CTA primário vermelho
  (hover `--dex-red-deep`), CTA secundário borda azul; inputs foco azul + ring; cards flat por padrão.
- **Assets**: a logo colorida (`dex-color-*`) deve ser adicionada em `client/public/`; a spec
  registra o caminho esperado e que a versão branca **nunca** é usada sobre branco.

---

## Ordem de Implementação (pós-aprovação das specs)

Por dependência de FK (CRM é base das contrapartes):

1. **Design System DEX** primeiro (tokens em `index.css` + componentes `brand/`) — toda página nova já nasce com a marca.
2. **CRM** (`companies` → `contacts` → `opportunities`) — fornece os selects de contraparte.
3. **Contas a Receber** (depende de `crm.companies`).
4. **Contas a Pagar** (espelha AR).
5. Atualizar `client/src/App.tsx` (rotas + nav) e `server/server.ts` (registrar routers) a cada módulo.

Cada módulo segue os 6 passos de "Adding a New Feature" do
[CLAUDE.md](my-microerp/CLAUDE.md) e replica o estilo de
[todos.repository.ts](my-microerp/server/features/todos/todos.repository.ts) (ensureSchema no boot).

---

## Arquivos criados/modificados

**Criados nesta tarefa (specs — o entregável):**
- `my-microerp/specs/feat_0002_crm.md`
- `my-microerp/specs/feat_0003_accounts_receivable.md`
- `my-microerp/specs/feat_0004_accounts_payable.md`
- `my-microerp/specs/feat_0005_design_system_dex.md`

**Modificado:**
- `my-microerp/specs/README.md` — adicionar os 4 novos arquivos à seção "Exemplo/Índice" (opcional, manter índice atualizado).

**Referenciados como molde (não alterados nesta fase):**
- [my-microerp/specs/feat_0001_todos.md](my-microerp/specs/feat_0001_todos.md), [my-microerp/CLAUDE.md](my-microerp/CLAUDE.md), [my-microerp/server/features/todos/todos.repository.ts](my-microerp/server/features/todos/todos.repository.ts), [my-microerp/client/src/index.css](my-microerp/client/src/index.css), [my-microerp/client/src/App.tsx](my-microerp/client/src/App.tsx)

---

## Verificação

Como as specs são o entregável desta fase, a verificação é de **completude e consistência**, não de runtime:

1. **Aderência ao template**: cada `feat_000X_*.md` contém todas as seções do
   [specs/README.md](my-microerp/specs/README.md) (Summary, Data Model, API Contract,
   Frontend Behavior, Error Cases, Migration, Acceptance Criteria).
2. **Consistência de contrato**: nomes de schema Zod citados nas specs batem entre si
   (ex.: AR e AP referenciam `crm.companies` e o mesmo enum de status); rotas seguem `/api/<plural>`.
3. **Cobertura das decisões**: modelagem integrada (FKs para `crm.companies`), baixa/status +
   indicadores, pipeline no CRM, e a seção DEX com mapa de tokens — todos presentes.
4. **Acceptance Criteria executáveis**: cada spec lista critérios verificáveis no estilo do
   `feat_0001_todos.md` (ex.: "`POST /api/receivables` com `amount: 0` retorna `400`").

Verificação de runtime ocorrerá na fase de implementação seguinte: `npm run dev` em
`my-microerp/`, criar empresa → criar título → dar baixa → conferir KPIs, e checar a aplicação
visual DEX (canvas branco, redline, CTA vermelho, ColorBars no rodapé).
