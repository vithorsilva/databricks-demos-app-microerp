# Spec-Driven Development

Cada feature começa com um arquivo `specs/<feature>.md` escrito e revisado **antes** de qualquer código.

## Template

```markdown
# Feature Spec: <Nome>

## Summary
Descrição em um parágrafo do que essa feature entrega e por quê.

## Data Model
Tabelas e colunas novas ou modificadas.
Referencie os schemas Zod pelo nome: ex. `TodoSchema` em `shared/todos/schemas.ts`.

## API Contract

| Método | Path | Request Schema | Response Schema | Status |
|--------|------|----------------|-----------------|--------|
| GET    | /api/resource         | —                    | `ResourceListResponseSchema` | 200 |
| POST   | /api/resource         | `CreateResourceBodySchema` | `ResourceSchema`         | 201 |
| PATCH  | /api/resource/:id     | `UpdateResourceBodySchema` | `ResourceSchema`         | 200 |
| DELETE | /api/resource/:id     | —                    | —                        | 204 |

Erros sempre retornam `{ error: string }` (`ErrorResponseSchema`).

## Frontend Behavior
- User stories em bullet points
- Estados a implementar: loading, error, empty, filled
- Componentes necessários

## Error Cases

| Situação | AppError | HTTP Status |
|----------|----------|-------------|
| Recurso não encontrado | `AppError(404, '...')` | 404 |
| Input inválido | validação Zod no controller | 400 |

## Migration
Nome do arquivo SQL caso haja alteração no schema do banco:
`server/db/migrations/YYYYMMDDHHMMSS_<descricao>.sql`

## Acceptance Criteria
- [ ] ...
- [ ] ...
```

## Convenções

- Nome do arquivo: `specs/<feature-no-plural>.md` — ex. `specs/customers.md`
- Um arquivo por domínio de negócio
- Schemas Zod ficam em `shared/<feature>/schemas.ts` e são criados junto com a spec

## Índice de Specs

| Arquivo | Domínio | Status |
|---------|---------|--------|
| [feat_0001_todos.md](feat_0001_todos.md) | Todos (CRUD de exemplo) | implementado |
| [feat_0005_design_system_dex.md](feat_0005_design_system_dex.md) | Identidade visual DEX (tokens + componentes de marca) | spec |
| [feat_0002_crm.md](feat_0002_crm.md) | CRM — empresas, contatos, pipeline | spec |
| [feat_0003_accounts_receivable.md](feat_0003_accounts_receivable.md) | Contas a Receber (AR) | spec |
| [feat_0004_accounts_payable.md](feat_0004_accounts_payable.md) | Contas a Pagar (AP) | spec |

> Ordem de implementação (por dependência de FK): Design System → CRM → AR → AP.
> `feat_0001_todos.md` documenta o feature existente e serve como referência de formato.

## Convenções de Lakebase (toda feature com banco)

Features que criam tabelas no Lakebase (Postgres) devem seguir estas regras — descobertas em
produção e detalhadas no [README principal](../README.md#lakebase-ordem-de-implantação-leia-antes-do-primeiro-deploy):

### 1. Ownership de schema é do Service Principal

Schemas são criados no boot via `ensureSchema()` (`CREATE SCHEMA IF NOT EXISTS ...`). **Quem roda
esse comando primeiro vira dono.** Como o SP só tem `CAN_CONNECT_AND_CREATE` (não acessa schemas
de outra role), o schema **precisa ser criado pelo SP** — ou seja, **faça deploy antes de rodar
local**. Rodar `npm run dev` antes do primeiro deploy faz sua identidade virar dona do schema, e a
app deployada quebra com `permission denied for schema <schema>` (`42501`).

### 2. Tipos de coluna ↔ schema Zod: cuidado com datas

O driver `pg` converte `TIMESTAMPTZ`/`TIMESTAMP` em objeto `Date` do JavaScript. Se o schema Zod
declara o campo como `z.string()` (o padrão neste projeto — ver `created_at` em `TodoSchema`), o
`.parse(row)` no repository **falha com `ZodError`** ("expected string, received Date").

**Regra:** no repository, retorne colunas temporais já como texto via cast SQL `coluna::text`
(ex.: `SELECT id, title, completed, created_at::text FROM app.todos`). Isso mantém o schema Zod
como fonte única de verdade (`z.string()`) sem transformar a row no código. Aplique o cast em
**todas** as queries que retornam a coluna (SELECT, INSERT ... RETURNING, UPDATE ... RETURNING).

Registre essas duas decisões nas seções **Data Model** e **Migration** da spec da feature.
