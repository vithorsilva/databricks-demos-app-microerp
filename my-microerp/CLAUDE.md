# AI Assistant Instructions

<!-- appkit-instructions-start -->
## Databricks AppKit

This project uses Databricks AppKit packages. For AI assistant guidance on using these packages, refer to:

- **@databricks/appkit** (Backend SDK): [./node_modules/@databricks/appkit/CLAUDE.md](./node_modules/@databricks/appkit/CLAUDE.md)
- **@databricks/appkit-ui** (UI Integration, Charts, Tables, SSE, and more.): [./node_modules/@databricks/appkit-ui/CLAUDE.md](./node_modules/@databricks/appkit-ui/CLAUDE.md)

### Databricks Skills

For enhanced AI assistance with Databricks CLI operations, authentication, data exploration, and app development, install the Databricks skills:

```bash
databricks aitools install
```
<!-- appkit-instructions-end -->

---

## Project Architecture Conventions

### Layer Responsibilities

**Backend** — cada camada só conhece a imediatamente abaixo:

| Camada | Arquivo | Pode fazer | Não pode |
|--------|---------|------------|----------|
| Router | `server/features/<f>/<f>.router.ts` | `appkit.server.extend()`, instanciar controller | lógica, SQL, Zod parse |
| Controller | `server/features/<f>/<f>.controller.ts` | parse de `req.body` com Zod `.safeParse()`, `sendError()`, `res.json()` | SQL, regras de negócio |
| Service | `server/features/<f>/<f>.service.ts` | chamar repository, lançar `AppError` | Express types, SQL |
| Repository | `server/features/<f>/<f>.repository.ts` | SQL puro, `<Entity>Schema.parse()` em rows | Express types, `AppError` |

**Frontend:**

| Camada | Arquivo | Pode fazer | Não pode |
|--------|---------|------------|----------|
| Page | `client/src/features/<f>/<F>Page.tsx` | renderizar, chamar hooks | `fetch`, `useState` para dados do servidor |
| Hook | `client/src/features/<f>/hooks.ts` | `useState`, `useEffect`, chamar `<f>Api.*` | `fetch` direto |
| Feature API | `client/src/features/<f>/api.ts` | `api.get/post/patch/delete`, tipos de `@shared` | conhecer outros features |
| API Client | `client/src/api/index.ts` | `fetch`, normalizar erros | conhecer URLs de features |

### Shared Types

- `shared/<feature>/schemas.ts` — schemas Zod são a **fonte única de verdade**
- `shared/<feature>/types.ts` — tipos sempre via `z.infer<typeof ...Schema>`, nunca escritos à mão
- Server importa com path relativo: `../../../shared/todos/schemas.js`
- Client importa via alias: `@shared/todos/types.js`
- Nunca importar schemas Zod no client para validação runtime de respostas do servidor — use apenas os tipos TypeScript

### Error Handling

- Servidor: todos os erros passam por `sendError()` de `server/lib/errors.ts`
- Resposta de erro sempre tem shape `{ error: string }` (matches `ErrorResponseSchema`)
- Client: `ApiError` de `client/src/api/index.ts` carrega `status` e `message`

### API URL Convention

- Todas as rotas: `/api/<recurso>` — sem nome de plugin no path
- Nomes de recurso: substantivos no plural — `/api/todos`, `/api/orders`, `/api/customers`

### Adding a New Feature

1. Escrever `specs/<feature>.md` (obrigatório antes de qualquer código)
2. Criar `shared/<feature>/schemas.ts` e `shared/<feature>/types.ts`; exportar de `shared/index.ts`
3. Criar `server/features/<feature>/` com os 4 arquivos: repository → service → controller → router
4. Importar o router em `server/server.ts`
5. Criar `client/src/features/<feature>/` com: `api.ts`, `hooks.ts`, `<Feature>Page.tsx`
6. Adicionar rota em `client/src/App.tsx`

### File Naming

- Server: `<feature>.repository.ts`, `<feature>.service.ts`, `<feature>.controller.ts`, `<feature>.router.ts`
- Client: `api.ts`, `hooks.ts`, `<Feature>Page.tsx` (PascalCase)
- Shared: `schemas.ts`, `types.ts`
