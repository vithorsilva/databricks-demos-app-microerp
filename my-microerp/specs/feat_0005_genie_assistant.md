# Feature Spec: Assistente Genie na Home

## Summary

Integra o **Genie Space** já existente do cliente (que hoje só responde dentro do workspace Databricks)
**dentro do app**, na **Home**. Ao abrir o app o usuário encontra um chat conversacional no topo, onde
inicia um diálogo em linguagem natural sobre os dados, e logo abaixo os atalhos para os módulos
existentes (CRM, A Receber, A Pagar).

Diferente das features anteriores, esta **não usa as 4 camadas** (router/service/controller/repository)
nem o Lakebase: o AppKit fornece suporte **nativo** a Genie via plugin `genie()` (backend) e o
componente pronto `GenieChat` (frontend). Não há schema, contrato Zod novo, nem rotas custom.

- **Genie Space ID:** `01f17197d1111a0e817f0344e22c87ad`
- **Genie Space name:** `dex_interno_demo_microerpapp`

---

## Decisões

| Tema | Decisão |
|------|---------|
| Localização | Home (`/`) = chat do Genie no topo + atalhos dos módulos abaixo |
| Identidade de execução | **OBO (on-behalf-of)** — o plugin `genie()` e o `GenieChat` executam sempre como o usuário logado (`asUser`), então exige `user_api_scopes: [dashboards.genie]` no `databricks.yml`. Não há modo service-principal com o componente pronto. |
| UI | Componente pronto `GenieChat` de `@databricks/appkit-ui/react` (visual padrão AppKit) |
| Gráficos | Nativos — `GenieChat` usa `GenieQueryVisualization`, que infere o gráfico (bar/line/pie/scatter/area/radar/heatmap, via Recharts) e mostra abas **Chart (padrão) + Table**; sem gráfico possível mostra só a tabela |

**Consequência do OBO:** cada consulta respeita as permissões do usuário logado. Isto é imposto pelo
próprio plugin — todas as rotas do Genie são embrulhadas com `asUser(req)`, então o token encaminhado
(`x-forwarded-access-token`) precisa do escopo `dashboards.genie`. Sem o escopo, a API retorna
`Forbidden — Invalid scope, required scopes: genie`. Conceder CAN RUN no space resolve *permissão*, mas
não o *escopo do token* — os dois são necessários.

---

## Arquitetura

```text
Browser (GenieChat) → /api/genie/:alias/messages (SSE) → plugin genie() → API Genie → SQL Warehouse
                     ← stream: status / message_result / query_result ←
```

O plugin `genie()` (registrado sem argumentos) lê `DATABRICKS_GENIE_SPACE_ID` do ambiente e registra
o space sob o alias `default`. Monta os endpoints SSE automaticamente:

| Rota | Método | Função |
|------|--------|--------|
| `/api/genie/:alias/messages` | `POST` | Envia mensagem e faz stream do resultado |
| `/api/genie/:alias/conversations/:conversationId` | `GET` | Replay de conversa existente |

Nenhuma rota é escrita manualmente.

---

## Pontos de fiação

| Arquivo | Mudança |
|---------|---------|
| `server/server.ts` | importar `genie` e adicionar `genie()` ao array `plugins` (preservando `lakebase()`, `server()`) |
| `databricks.yml` | variáveis `genie_space_id`/`genie_space_name` + recurso `genie-space` (`genie_space`, `permission: CAN_RUN`) + valores no target |
| `app.yaml` | injetar `DATABRICKS_GENIE_SPACE_ID` via `valueFrom: genie-space` |
| `server/.env` (local) / `.env.example` | `DATABRICKS_GENIE_SPACE_ID` |
| `client/src/App.tsx` (`HomePage`) | `GenieChat alias="default"` em container de altura fixa + disclaimer + atalhos existentes |
| `tests/smoke.spec.ts` | seletores da nova Home |

`valueFrom` em `app.yaml` deve casar **exatamente** com o `name` do recurso em `databricks.yml`
(`genie-space`).

---

## Frontend Behavior

### User Stories
- Como usuário, ao abrir o app quero conversar com o assistente sobre meus dados em linguagem natural.
- Como usuário, quero ver a resposta com texto **e gráfico** quando o dado permitir, podendo alternar
  para a tabela.
- Como usuário, quero inspecionar o SQL gerado pela pergunta.
- Como usuário, quero continuar acessando os módulos (CRM, A Receber, A Pagar) a partir da Home.

### Estrutura da Home
- `PageHeader` com título e subtítulo (identidade DEX preservada via tokens/branding existentes).
- Seção do assistente: `GenieChat alias="default"` dentro de um container com **altura fixa**
  (gotcha: sem altura explícita o chat colapsa para 0). Streaming, histórico, SQL gerado e
  gráfico/tabela são tratados pelo próprio componente.
- Disclaimer discreto de IA (texto `text-xs text-muted-foreground`): respostas geradas por IA,
  conferir o SQL antes de confiar.
- `Card` "Módulos" existente com os atalhos para `/crm`, `/receivables`, `/payables` (reaproveitado).

### Estados (tratados pelo `GenieChat`)
| Estado | Comportamento |
|--------|---------------|
| streaming | indicador de progresso/status durante a resposta |
| sucesso | bolha de resposta + (quando aplicável) abas Chart/Table + SQL gerado expansível |
| sem gráfico | apenas tabela |
| dados vazios/malformados | não renderiza visualização |
| erro | mensagem de erro do stream |

---

## Convenções / Riscos

- Não alterar a versão de `@databricks/appkit*` (0.38.1).
- Container do `GenieChat` **precisa** de altura explícita.
- **Deploy antes de rodar local:** o recurso `genie-space` precisa existir/estar autorizado no deploy
  (mesma regra de ownership já válida para o Lakebase).
- Se aparecer `does not have required scopes: genie`, revisar o recurso `genie-space` no `databricks.yml`.

---

## Acceptance Criteria

- [ ] `server/server.ts` registra `genie()` preservando `lakebase()` e `server()`
- [ ] `databricks.yml` declara o recurso `genie-space` (`CAN_RUN`) com `space_id` =
      `01f17197d1111a0e817f0344e22c87ad` e `name` = `dex_interno_demo_microerpapp`
- [ ] `app.yaml` injeta `DATABRICKS_GENIE_SPACE_ID` via `valueFrom: genie-space`
- [ ] A Home renderiza o `GenieChat` (com altura fixa, não colapsado) acima dos atalhos de módulo
- [ ] Os atalhos para CRM / A Receber / A Pagar continuam acessíveis na Home
- [ ] Disclaimer de IA visível próximo ao chat
- [ ] Uma pergunta coberta pelo Space retorna resposta com streaming e, quando aplicável, gráfico+tabela
- [ ] O SQL gerado é inspecionável na resposta
- [ ] `databricks apps validate` passa (`tsc --noEmit` + lint AppKit)
- [ ] Smoke test atualizado para a nova Home (sem depender de resposta real do Genie)
