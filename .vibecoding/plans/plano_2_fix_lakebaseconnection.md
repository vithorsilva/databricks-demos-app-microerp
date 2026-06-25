# Corrigir "permission denied for schema app" na tela /todos

## Context

A tela `/todos` retorna **Internal server error**. Os logs da app deployada mostram:

```
[todos] Database setup failed: permission denied for schema app
[unhandled] error: permission denied for schema app  (code 42501)
    at TodoRepository.findAll (.../dist/features/todos/todos.repository.js:37)
```

Os paths do stack (`/app/python/source_code/...`) confirmam que o erro vem da **app deployada** no Databricks Apps.

### Causa raiz (confirmada pela skill `databricks-lakebase`)

Esta é a **causa #1 de erros de permissão no Lakebase**. O fluxo:

1. O Service Principal (SP) da app deployada tem permissão `CAN_CONNECT_AND_CREATE` ([databricks.yml:28](my-microerp/databricks.yml#L28)) — pode **criar** objetos novos, mas **não acessa schemas que pertencem a outra role**.
2. O código em [todos.repository.ts:23-37](my-microerp/server/features/todos/todos.repository.ts#L23-L37) roda `CREATE SCHEMA IF NOT EXISTS app` no startup. **Quem roda isso primeiro vira dono do schema.**
3. O schema `app` foi criado por uma identidade que **não é o SP** (provavelmente sua identidade de usuário, ao rodar a app localmente antes do deploy). Por isso o SP recebe `permission denied` ao tentar `SELECT FROM app.todos`.

O `try/catch` em `ensureSchema()` engole o erro e segue, então as rotas registram mas falham em runtime — exatamente o comportamento observado.

### Decisões do usuário
- Schema `app` está **vazio / pode dropar**.
- Não há certeza se a app foi rodada localmente antes — por isso o plano **verifica o dono atual** antes de dropar, para confirmar a causa.

## Abordagem recomendada: Drop + Redeploy

Como o schema pode ser dropado, a correção é dropar o schema `app` (de propriedade errada) e deixar o SP recriá-lo — agora como dono — no próximo deploy.

> **Nota:** esta correção é **operacional** (CLI/SQL contra o Lakebase + redeploy). **Nenhuma mudança de código da app é necessária** para resolver o erro. O código de bootstrap já está correto.

### Passos

Todos os comandos usam o profile `dex-producao` (de [.env:2](my-microerp/.env#L2)).
Endpoint: `projects/db-demo-microerp-dex/branches/production/endpoints/primary`

**1. Obter host e token OAuth para conectar via psql**

```bash
EP=projects/db-demo-microerp-dex/branches/production/endpoints/primary
databricks postgres get-endpoint $EP --profile dex-producao -o json
# extrair status.hosts.host

databricks postgres generate-database-credential $EP --profile dex-producao -o json
# extrair .token
```

Alternativa mais simples para rodar SQL ad-hoc: `databricks psql --project db-demo-microerp-dex -- -c "<SQL>"`.

**2. Verificar o dono atual do schema (confirmar a causa antes de dropar)**

```sql
SELECT nspname, pg_catalog.pg_get_userbyid(nspowner) AS owner
FROM pg_namespace WHERE nspname = 'app';
```

- Se o dono **não** for o client ID do SP da app → confirma a causa raiz (prosseguir com drop).
- Se o dono **for** o SP → a causa é outra; parar e reinvestigar (improvável dado o sintoma).

Confirmar também que está vazio antes de dropar:
```sql
SELECT count(*) FROM app.todos;
```

**3. Dropar o schema**

```bash
databricks psql --project db-demo-microerp-dex -- -c "DROP SCHEMA IF EXISTS app CASCADE;"
```

**4. Redeploy da app (o SP recria o schema e vira dono)**

```bash
# a partir de my-microerp/
databricks bundle deploy --profile dex-producao
databricks apps deploy my-microerp --profile dex-producao
```

No startup, `registerTodosRoutes` → `repo.ensureSchema()` roda `CREATE SCHEMA app` + `CREATE TABLE app.todos` **como o SP**, que passa a ser o dono e tem acesso total.

## Arquivos

**Nenhum arquivo de código a modificar.** A correção é operacional (Lakebase + redeploy).

Arquivos relevantes apenas para referência:
- [my-microerp/server/features/todos/todos.repository.ts](my-microerp/server/features/todos/todos.repository.ts) — bootstrap do schema (correto, sem mudanças)
- [my-microerp/databricks.yml](my-microerp/databricks.yml) — permissão `CAN_CONNECT_AND_CREATE` (correta)

### Melhoria opcional (não obrigatória para o fix)
Em [todos.repository.ts:33-36](my-microerp/server/features/todos/todos.repository.ts#L33-L36), o `catch` apenas faz `console.warn` e segue, mascarando o erro de permissão até o runtime. Opcionalmente, relançar o erro no `ensureSchema()` faria a app falhar no boot com mensagem clara, em vez de retornar Internal Server Error silencioso por request. Deixar a critério do usuário — não altera a causa raiz.

## Verificação

1. **Dono do schema após redeploy** — repetir a query do passo 2; o dono deve agora ser o client ID do SP (obtido via `databricks apps get my-microerp --profile dex-producao` → `service_principal_client_id`).
2. **Logs da app** — devem mostrar `[todos] Created schema and table app.todos` (ou "already exists" em deploys subsequentes), sem `Database setup failed`.
3. **Tela `/todos`** — abrir no navegador; deve carregar a lista vazia sem Internal server error.
4. **CRUD end-to-end** — criar um todo (POST), marcar como completo (PATCH), remover (DELETE) pela UI e confirmar que persistem.

## Para evitar recorrência

Regra de ouro do Lakebase Apps: **sempre deployar a app antes de rodá-la localmente.** Se for desenvolver localmente depois, peça ao dono do projeto para te atribuir `databricks_superuser` (criadores do projeto já têm), assim sua identidade ganha acesso DML aos schemas que o SP é dono — sem virar dono deles.
