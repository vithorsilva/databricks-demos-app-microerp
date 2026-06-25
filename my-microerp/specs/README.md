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

## Exemplo

`specs/todos.md` — documenta o feature existente e serve como referência.
