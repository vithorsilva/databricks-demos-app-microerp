# Integração do Genie no Micro ERP DEX — Assistente conversacional na Home

## Context

O cliente já criou um **Genie Space** no Databricks que está respondendo corretamente, mas hoje a
interação só acontece dentro do workspace Databricks. O objetivo é trazer essa conversa para **dentro
do app** (`my-microerp`), para que o usuário final inicie um diálogo com o agente diretamente pela
interface do ERP.

Resultado esperado: ao abrir o app, a **Home** apresenta um chat com o Genie no topo (onde o usuário
inicia a conversa em linguagem natural sobre seus dados), mantendo abaixo os atalhos para os módulos
existentes (CRM, A Receber, A Pagar).

O AppKit (0.38.1, já instalado) oferece suporte **nativo** a Genie — não é necessário reimplementar
streaming nem autenticação:
- **Backend:** plugin `genie()` de `@databricks/appkit` — monta endpoints SSE em `/api/genie/*` e faz
  proxy para a API do Genie, lendo o Space ID de `DATABRICKS_GENIE_SPACE_ID`.
- **Frontend:** componente pronto `GenieChat` de `@databricks/appkit-ui/react` — cuida de streaming,
  histórico de conversa, render do SQL gerado, **tabelas E gráficos** dos resultados.

### Gráficos (confirmado)
O `GenieChat` renderiza gráficos automaticamente, sem código adicional. Internamente ele usa
`GenieQueryVisualization`, que para cada resultado de query: infere o melhor tipo de gráfico
(`inferChartType` — bar/line/pie/scatter/area/radar/heatmap, via Recharts) e mostra abas
**"Chart" (padrão) + "Table"**; quando nenhum gráfico se encaixa, mostra só a tabela; quando os dados
estão vazios/malformados, não renderiza nada. A capacidade de "responder com informações e gráficos"
que o usuário já vê no Genie nativo vem incluída.

### Decisões confirmadas com o usuário
- **Localização:** Home = chat do Genie no topo + atalhos dos módulos abaixo.
- **Identidade de execução:** service principal do app (configuração padrão `genie()`, **sem** OBO /
  `user_api_scopes`). Todas as consultas rodam com a identidade do app.
- **UI:** componente pronto `GenieChat` (visual padrão AppKit), não UI custom.

### Space ID do Genie (fornecido)
- **Space ID:** `01f17197d1111a0e817f0344e22c87ad` — `genie_space_id` no `databricks.yml` e
  `DATABRICKS_GENIE_SPACE_ID` no `.env` local.
- **Nome do space:** `dex_interno_demo_microerpapp` — `genie_space_name` no `databricks.yml`.

## Arquivos a modificar

Todos sob `my-microerp/`. Nenhum arquivo novo de feature (router/service/repository) é necessário — o
plugin `genie()` já fornece os endpoints.

### 0. Spec da feature (obrigatório antes do código)
`specs/feat_0005_genie_assistant.md` (novo) — seguindo a convenção do `CLAUDE.md` ("Escrever
`specs/<feature>.md` é obrigatório antes de qualquer código") e o padrão de nomenclatura dos specs
existentes (`feat_0001_todos.md` … `feat_0004_accounts_payable.md`; próximo número = `0005`).
Conteúdo: objetivo, decisões (Home = chat + atalhos, service principal, GenieChat pronto, gráficos
nativos), pontos de fiação (plugin, databricks.yml, app.yaml, frontend), Space ID/nome e critérios de
aceite. Esta entrega **não** usa as 5 camadas (router/service/repository/etc.) porque o plugin `genie()`
fornece os endpoints — registrar isso explicitamente na spec.

### 1. Backend — registrar o plugin
[server/server.ts](my-microerp/server/server.ts)
- Importar `genie` de `@databricks/appkit` (junto de `createApp, lakebase, server`).
- Adicionar `genie()` (sem argumentos) ao array `plugins`, preservando `lakebase()` e `server()`.
- Nada muda em `onPluginsReady` — os endpoints `/api/genie/*` são montados pelo próprio plugin.

### 2. Deploy — declarar o recurso Genie e injetar o env
[databricks.yml](my-microerp/databricks.yml)
- Adicionar variáveis `genie_space_id` e `genie_space_name` no bloco `variables`.
- Adicionar recurso `genie-space` (tipo `genie_space`, `permission: CAN_RUN`) em
  `resources.apps.app.resources`, ao lado do `postgres` existente.
- Preencher os valores em `targets.default.variables`.
- **Não** habilitar `user_api_scopes` (decisão: service principal).

[app.yaml](my-microerp/app.yaml)
- Adicionar injeção de env:
  ```yaml
  env:
    - name: LAKEBASE_ENDPOINT
      valueFrom: postgres
    - name: DATABRICKS_GENIE_SPACE_ID
      valueFrom: genie-space
  ```
  (o `valueFrom` deve casar exatamente com o `name` do recurso em `databricks.yml`).

### 3. Desenvolvimento local
`server/.env` (não versionado)
- Adicionar `DATABRICKS_GENIE_SPACE_ID=<SPACE_ID>` para rodar localmente.
- Atualizar [.env.example](my-microerp/.env.example) com a chave (sem valor real) para documentar.

### 4. Frontend — Home com chat + atalhos
[client/src/App.tsx](my-microerp/client/src/App.tsx) — função `HomePage`
- Importar `GenieChat` de `@databricks/appkit-ui/react`.
- Reestruturar `HomePage`:
  - Topo: `PageHeader` (título "Assistente DEX" / subtítulo) + um container com **altura explícita
    fixa** (ex.: `style={{ height: 600 }}` ou classe equivalente) envolvendo `<GenieChat />`.
    > **Gotcha conhecido:** sem altura explícita no container pai, o `GenieChat` colapsa para altura
    > zero. Isto é mandatório.
  - Abaixo do chat: manter o `Card` "Módulos" atual com os atalhos para CRM / A Receber / A Pagar
    (reaproveitar o JSX já existente em `HomePage`).
- Adicionar um disclaimer discreto perto do chat (padrão do guia de confiança AI), ex.:
  `<p className="text-xs text-muted-foreground">Respostas geradas por IA a partir dos seus dados via
  Genie — confira o SQL gerado antes de confiar nos resultados.</p>`
- Como a identidade é service principal, **não** alegar OBO na UI; opcionalmente uma nota curta de que
  as consultas rodam com a identidade do app. (Identidade do usuário via `/api/whoami` não é necessária
  para esta entrega — pode ficar como evolução futura se quiserem OBO.)
- Manter `var(--grad-header)` / branding existentes; o `GenieChat` herda o tema AppKit.

### 5. Smoke test
[tests/smoke.spec.ts](my-microerp/tests/smoke.spec.ts) (ou caminho equivalente em `tests/`)
- Atualizar seletores: a Home agora tem o título "Assistente DEX" (ou o escolhido) e o chat.
- Usar apenas APIs de locator do Playwright (`getByRole`, `getByText`, `getByPlaceholder`).
- Não depender de resposta real do Genie no smoke (apenas presença dos elementos da UI).

## Convenções a respeitar
- AppKit já instalado em 0.38.1 — **não** alterar a versão de `@databricks/appkit*` no `package.json`.
- Antes de escrever chamadas a APIs do AppKit, confirmar assinaturas reais com
  `npx @databricks/appkit docs ./docs/plugins/genie.md` e `npx @databricks/appkit docs "GenieChat"`.
- Memória do projeto: **deploy antes de rodar local** (ownership do schema Lakebase). Para o Genie isso
  também se aplica porque o recurso `genie-space` precisa existir/estar autorizado no deploy.

## Verificação (end-to-end)

1. **Validação estática:**
   `cd my-microerp && npm run typegen` (se aplicável) e `databricks apps validate --profile <PROFILE>`
   — deve passar `tsc --noEmit` e o lint do AppKit.
2. **Local:** definir `DATABRICKS_GENIE_SPACE_ID` em `server/.env`, rodar `npm run dev`, abrir a Home e:
   - confirmar que o chat renderiza com altura correta (não colapsado);
   - enviar uma pergunta (ex.: "Quantas empresas temos cadastradas?" ou algo coberto pelo Space) e
     verificar streaming de status → resposta → SQL gerado / tabela.
3. **Deploy:** `databricks bundle deploy --profile <PROFILE>` e depois verificar
   `databricks apps get my-microerp --profile <PROFILE> -o json` (estado `RUNNING`) e
   `databricks apps logs my-microerp --follow --profile <PROFILE>`.
4. **Pós-deploy:** abrir o app publicado, repetir uma pergunta e confirmar que a resposta vem do Space
   correto. Se aparecer erro de escopo `genie`, revisar o recurso `genie-space` no `databricks.yml`.

## Commit
Seguir a convenção do histórico (`feat`), ex.:
`feat: Assistente Genie na Home (chat + gráficos)`. Apenas quando você pedir o commit.

## Riscos / pontos de atenção
- **Space ID ausente** bloqueia tudo — obter antes de começar.
- **Container sem altura** → chat invisível (gotcha #1 do guia).
- **`valueFrom` divergente** entre `app.yaml` e `databricks.yml` → env não injetado.
- **Governança:** com service principal, todos os usuários veem os mesmos dados. Se no futuro o cliente
  quiser respeitar permissões por usuário, migrar para OBO (adicionar `user_api_scopes: [dashboards.genie]`
  e redeploy) — fora do escopo desta entrega.
