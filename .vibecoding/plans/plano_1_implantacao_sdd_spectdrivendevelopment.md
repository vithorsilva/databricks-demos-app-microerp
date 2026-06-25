# Plano: Organização Pré-SDD do MicroERP

## Contexto

O projeto está em estado de prova-de-conceito (Todo CRUD) com stack AppKit + React 19 + TypeScript + Express + Lakebase. Antes de enviar a primeira spec de feature real, precisamos estabelecer a estrutura modular, as camadas e as convenções que todas as features futuras vão seguir. A ideia é que a spec descreva **o quê** construir, e a estrutura aqui já defina **como** isso será construído.

---

## Estrutura-Alvo (my-microerp/)

```
my-microerp/
├── shared/                              # NOVO — contrato compartilhado client+server
│   ├── appkit-types/                    # existente (gerado pelo appkit typegen)
│   ├── index.ts                         # barrel re-export
│   └── todos/
│       ├── schemas.ts                   # Zod schemas (fonte única de verdade)
│       └── types.ts                     # tipos inferidos via z.infer<>
│
├── server/
│   ├── server.ts                        # inalterado (AppKit init)
│   ├── lib/
│   │   ├── errors.ts                    # NOVO — AppError + sendError()
│   │   └── db.ts                        # NOVO — interface DbClient tipada
│   └── features/
│       └── todos/
│           ├── todos.repository.ts      # SQL puro, retorna tipos de domínio
│           ├── todos.service.ts         # regras de negócio, lança AppError
│           ├── todos.controller.ts      # parse HTTP, chama service, envia resposta
│           └── todos.router.ts          # registra rotas via appkit.server.extend()
│
├── client/src/
│   ├── App.tsx                          # atualizar import path apenas
│   ├── api/
│   │   └── index.ts                     # NOVO — fetch client centralizado
│   └── features/
│       └── todos/
│           ├── api.ts                   # wrappers tipados sobre api/index.ts
│           ├── hooks.ts                 # useTodos (estado async + actions)
│           └── TodosPage.tsx            # movido de pages/lakebase/LakebasePage.tsx
│
└── specs/
    └── README.md                        # NOVO — convenção de specs
```

**Removidos após refator:** `server/routes/` e `client/src/pages/` (inteiros).

---

## Camadas e Responsabilidades

### Backend (cada camada só conhece a imediatamente abaixo)

| Camada | Arquivo | Pode fazer | Não pode |
|--------|---------|------------|----------|
| Router | `todos.router.ts` | `appkit.server.extend()`, instanciar controller | lógica, SQL, Zod parse |
| Controller | `todos.controller.ts` | `req.body` parse com Zod `.safeParse()`, `sendError()`, `res.json()` | SQL, regras de negócio |
| Service | `todos.service.ts` | chamar repository, lançar `AppError` | Express types, SQL |
| Repository | `todos.repository.ts` | SQL, `TodoSchema.parse()` em rows | Express types, `AppError` |

### Frontend

| Camada | Arquivo | Pode fazer | Não pode |
|--------|---------|------------|----------|
| Page | `TodosPage.tsx` | renderizar, chamar hooks | `fetch`, `useState` para dados server |
| Hook | `hooks.ts` | `useState`, `useEffect`, chamar `todosApi.*` | `fetch` direto |
| Feature API | `features/todos/api.ts` | `api.get/post/patch/delete`, tipos de `@shared` | conhecer outros features |
| API Client | `api/index.ts` | `fetch`, normalizar erros, header Content-Type | conhecer URLs de features |

---

## Módulo Shared — Fonte Única de Verdade

`shared/todos/schemas.ts` — todos os outros arquivos derivam daqui:
```ts
export const TodoSchema = z.object({ id, title, completed, created_at })
export const CreateTodoBodySchema = z.object({ title: z.string().min(1).max(500) })
export const UpdateTodoBodySchema = z.object({ completed: z.boolean() })
export const TodoListResponseSchema = z.array(TodoSchema)
export const ErrorResponseSchema = z.object({ error: z.string() })
```

`shared/todos/types.ts` — todos os tipos são `z.infer<typeof ...Schema>`, nunca escritos à mão.

### Ajustes de build necessários (mínimos, não tocam pipeline AppKit)

1. **`tsconfig.client.json`** — adicionar `"shared"` em `include` e alias:
   ```json
   "paths": { "@shared/*": ["../shared/*"] }
   ```
2. **`vite.config.ts`** — na `resolve.alias`:
   ```ts
   '@shared': path.resolve(__dirname, '../shared')
   ```
3. **`vitest.config.ts`** — mesmo alias que o Vite.

> `tsconfig.server.json` já inclui `shared/**/*` — nenhuma mudança necessária no lado server.

---

## Convenção de Erros

- Servidor: todos os erros passam por `sendError()` em `server/lib/errors.ts`
- Resposta sempre tem shape `{ error: string }` (matches `ErrorResponseSchema`)
- Cliente: `ApiError` de `client/src/api/index.ts` carrega `status` e `message`

---

## Convenção de URL

- Todas as rotas: `/api/<recurso>` — sem nome de plugin no path
- Nomes de recurso: substantivos no plural — `/api/todos`, `/api/orders`
- Mudança imediata: `/api/lakebase/todos` → `/api/todos`

---

## Specs Directory

`specs/<feature>.md` é escrito **antes** de qualquer código da feature.

Seções obrigatórias:
1. **Summary** — parágrafo descritivo
2. **Data Model** — tabelas/colunas, referencia schemas Zod pelo nome
3. **API Contract** — método, path, request/response schemas
4. **Frontend Behavior** — user stories, estados: loading/error/empty
5. **Error Cases** — AppError codes e HTTP status
6. **Acceptance Criteria** — lista testável

---

## Atualizações no CLAUDE.md

Adicionar após o bloco gerenciado pelo AppKit (`<!-- appkit-instructions-end -->`):

- Convenções de camadas (tabela acima)
- Regras de importação do `shared/` (server usa path relativo; client usa `@shared/*`)
- Padrão de URL `/api/<recurso>`
- Disciplina SDD: spec antes de código

---

## Sequência de Implementação

**Commit 1 — `refactor: server feature/layer structure`**
1. Criar `shared/todos/schemas.ts`, `shared/todos/types.ts`, `shared/index.ts`
2. Atualizar `tsconfig.client.json`, `vite.config.ts`, `vitest.config.ts` (alias `@shared`)
3. Criar `server/lib/errors.ts` e `server/lib/db.ts`
4. Criar `server/features/todos/` (repository → service → controller → router)
5. Atualizar `server/server.ts` — trocar import; deletar `server/routes/`

**Commit 2 — `refactor: client feature/api/hooks structure`**
6. Criar `client/src/api/index.ts`
7. Criar `client/src/features/todos/api.ts`, `hooks.ts`, `TodosPage.tsx`
8. Atualizar `client/src/App.tsx` — trocar import path; deletar `client/src/pages/`

**Commit 3 — `docs: SDD conventions`**
9. Criar `specs/README.md`
10. Atualizar `CLAUDE.md`

---

## Verificação

```bash
npm run typecheck   # zero erros TypeScript — prova que shared funciona em ambos lados
npm run lint        # zero warnings
npm run build       # client → client/dist/; server → dist/server.js
npm run dev         # dev server sobe na porta 8000
curl localhost:8000/api/todos   # retorna []
npm run test:smoke  # Playwright smoke passa
```

**Prova de type-safety:** `Todo` é inferido de `TodoSchema` → repository faz `TodoSchema.parse(row)` → `api.ts` tipado como `Promise<Todo>` → TypeScript quebra em compilação se DB e UI divergirem.
