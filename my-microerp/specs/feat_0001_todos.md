# Feature Spec: Todos

> **Nota sobre spec retroativa**
> Este arquivo foi escrito *depois* do código existir, para servir de exemplo do formato SDD.
> Em uma spec prospectiva (o fluxo correto), este arquivo seria escrito *antes* de qualquer código,
> e as decisões aqui registradas guiariam a implementação — não o contrário.
> A estrutura e as seções são idênticas em ambos os casos.

---

## Summary

A feature Todos é um exemplo de CRUD completo sobre Databricks Lakebase (PostgreSQL).
Ela demonstra o padrão de arquitetura em camadas do projeto: schemas Zod compartilhados entre
client e server, API REST com contratos tipados, e componente React desacoplado via hook customizado.
O domínio é simples por design — o objetivo é validar a infraestrutura, não a regra de negócio.

---

## Data Model

**Tabela:** `app.todos`

| Coluna | Tipo PostgreSQL | Constraints | Descrição |
|--------|----------------|-------------|-----------|
| `id` | `SERIAL` | `PRIMARY KEY` | Identificador único auto-incrementado |
| `title` | `TEXT` | `NOT NULL` | Texto da tarefa |
| `completed` | `BOOLEAN` | `NOT NULL DEFAULT false` | Status de conclusão |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Data de criação |

**Schema Zod** (fonte de verdade em [shared/todos/schemas.ts](../shared/todos/schemas.ts)):

```ts
TodoSchema = z.object({
  id:         z.number().int().positive(),
  title:      z.string().min(1),
  completed:  z.boolean(),
  created_at: z.string(),
})
```

**Setup:** a tabela é criada automaticamente na inicialização do servidor via `TodoRepository.ensureSchema()`,
usando `CREATE TABLE IF NOT EXISTS`. Não há arquivo de migration separado — adequado para protótipos.
Em produção com dados reais, usar migrations versionadas (ver seção Migration).

---

## API Contract

Todos os endpoints estão sob `/api/todos`. Erros retornam `ErrorResponseSchema` (`{ error: string }`).

| Método | Path | Request Body | Response Body | Status de sucesso |
|--------|------|--------------|---------------|-------------------|
| `GET` | `/api/todos` | — | `TodoListResponseSchema` | `200` |
| `POST` | `/api/todos` | `CreateTodoBodySchema` | `TodoSchema` | `201` |
| `PATCH` | `/api/todos/:id` | — | `TodoSchema` | `200` |
| `DELETE` | `/api/todos/:id` | — | — | `204` |

### Detalhes por endpoint

**`GET /api/todos`**
- Retorna todos os registros, ordenados por `created_at DESC` (mais recentes primeiro)
- Sem paginação — adequado para o volume de demonstração

**`POST /api/todos`**
- Body: `{ "title": string }` validado por `CreateTodoBodySchema` (min 1, max 500 caracteres)
- O `title` é trimado antes de persistir (`title.trim()` no service)
- Retorna o todo criado com todos os campos

**`PATCH /api/todos/:id`**
- Faz toggle do campo `completed` (inverte o valor atual): `SET completed = NOT completed`
- Retorna o todo atualizado
- Não aceita body — a única operação de update é o toggle

**`DELETE /api/todos/:id`**
- Remove o registro permanentemente
- Retorna `204 No Content` sem body

---

## Frontend Behavior

### User Stories

- Como usuário, quero ver a lista de todos ao abrir a página, para saber o que tenho pendente
- Como usuário, quero adicionar um novo todo digitando um título e pressionando "Add" ou Enter
- Como usuário, quero marcar um todo como concluído clicando no checkbox, para registrar progresso
- Como usuário, quero desmarcar um todo concluído, caso precise reabri-lo
- Como usuário, quero deletar um todo que não é mais relevante
- Como usuário, quero ver quantos todos estão concluídos do total

### Estados da UI

| Estado | Quando ocorre | O que exibir |
|--------|--------------|--------------|
| **loading** | Aguardando `GET /api/todos` inicial | 3 skeletons animados |
| **error** | Qualquer operação falha | Mensagem de erro inline em vermelho |
| **empty** | Lista carregada com 0 itens | Texto "No todos yet. Add one above to get started." |
| **filled** | Lista com 1+ itens | Lista de todos + contador "`X of Y completed`" |

### Componentes

- `TodosPage` — shell da página, obtém estado do hook `useTodos`; não chama `fetch` diretamente
- `useTodos` — hook que gerencia `todos[]`, `loading`, `error`, e expõe `createTodo`, `toggleTodo`, `deleteTodo`
- O formulário de adição está inline no `TodosPage` (não é um componente separado — simplicidade intencional)

---

## Error Cases

| Situação | Quem detecta | AppError / Resposta | HTTP Status |
|----------|-------------|---------------------|-------------|
| `id` não é número inteiro válido | Controller | `{ error: 'Invalid id' }` | `400` |
| `title` ausente ou vazio | Controller (Zod `.safeParse`) | `{ error: 'title is required' }` | `400` |
| Todo não encontrado (toggle/delete) | Repository → `AppError(404, 'Todo not found')` | `{ error: 'Todo not found' }` | `404` |
| Falha de banco de dados | `sendError()` em `server/lib/errors.ts` | `{ error: 'Internal server error' }` | `500` |

O client (`ApiError` em `client/src/api/index.ts`) captura todos esses casos e expõe `error.status` e `error.message`.

---

## Migration

A tabela é criada via `TodoRepository.ensureSchema()` em tempo de boot — não há arquivo SQL separado.

Se no futuro for necessário alterar o schema (ex.: adicionar coluna `priority`), criar:

```
server/db/migrations/YYYYMMDDHHMMSS_add_priority_to_todos.sql
```

Com SQL idempotente:
```sql
ALTER TABLE app.todos ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0;
```

---

## Acceptance Criteria

- [ ] Ao carregar `/todos`, a lista é buscada de `GET /api/todos` e exibida em ordem decrescente de criação
- [ ] Durante o carregamento inicial, 3 skeletons são exibidos
- [ ] Um todo pode ser adicionado preenchendo o campo de título e submetendo o formulário
- [ ] O botão "Add" fica desabilitado enquanto o campo está vazio ou a requisição está em andamento
- [ ] Clicar no checkbox de um todo pendente marca-o como concluído (linha com `line-through`)
- [ ] Clicar no checkbox de um todo concluído remove a marcação (toggle)
- [ ] Clicar no botão de delete remove o todo da lista sem recarregar a página
- [ ] O contador "`X of Y completed`" atualiza após cada toggle
- [ ] Em caso de erro de rede ou API, uma mensagem de erro é exibida inline
- [ ] O estado vazio exibe mensagem orientativa quando não há todos
- [ ] `GET /api/todos` retorna array vazio `[]` quando não há registros (não retorna 404)
- [ ] `POST /api/todos` com body `{}` retorna `400` com `{ error: 'title is required' }`
- [ ] `PATCH /api/todos/999` (id inexistente) retorna `404` com `{ error: 'Todo not found' }`
- [ ] `DELETE /api/todos/999` (id inexistente) retorna `404` com `{ error: 'Todo not found' }`
