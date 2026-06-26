# Melhorias no CRM

## Context

Três ajustes pedidos pelo usuário no módulo CRM do microERP:

1. **Histórico de oportunidades por empresa** — hoje as empresas aparecem só numa tabela plana ([CrmPage.tsx](my-microerp/client/src/features/crm/CrmPage.tsx#L151) `CompaniesSection`), sem visão de detalhe. O board ([PipelineBoard.tsx](my-microerp/client/src/features/crm/PipelineBoard.tsx)) só mostra oportunidades `status='open'` (filtro em [hooks.ts:235](my-microerp/client/src/features/crm/hooks.ts#L235)). Ao marcar Ganha/Perdida a oportunidade some, e não há onde revê-la nem retomá-la.
2. **E-mail de contato** — o schema de contato já tem `email` e `phone` ([schemas.ts:43](my-microerp/shared/crm/schemas.ts#L43)), mas o formulário em `ContactsSection` ([CrmPage.tsx:293](my-microerp/client/src/features/crm/CrmPage.tsx#L293)) só envia `name` e `role`, e não há edição de contatos existentes.
3. **Ganha → Contas a Receber** — marcar como Ganha hoje só ajusta timestamps ([crm.repository.ts:559](my-microerp/server/features/crm/crm.repository.ts#L559)); não cria nada em `ar.receivables`. O usuário quer que gere contas a receber, **com suporte a parcelamento** (definir parcelas e vencimentos).

### Decisões do usuário
- **Ganha sem valor:** bloquear — não é possível confirmar Ganha com total de parcelas ≤ 0.
- **AR parcelado:** ao ganhar, abrir diálogo para definir as parcelas (valor + vencimento de cada). Gera 1 `ar.receivables` por parcela, vinculado à oportunidade.
- **Contato:** e-mail + telefone, com criar **e editar** (permitir preencher e-mail de quem já existe).
- **Reabrir oportunidade ganha:** remover os contas a receber **pendentes** (não baixados) gerados por ela.

---

## Item 2 — E-mail/telefone de contato (criar + editar) · *o mais simples, fazer primeiro*

Sem mudança de backend (schema/rotas já suportam `email`/`phone` e `PATCH /api/contacts/:id`).

- **[hooks.ts](my-microerp/client/src/features/crm/hooks.ts) `useContacts`** — adicionar `updateContact(id, body)` chamando `crmApi.updateContact` (já existe em [api.ts:50](my-microerp/client/src/features/crm/api.ts#L50)) e atualizando o estado local.
- **[CrmPage.tsx](my-microerp/client/src/features/crm/CrmPage.tsx) `ContactsSection`**:
  - Formulário de novo contato: adicionar inputs **E-mail** e **Telefone** (espelhar o padrão de `CompaniesSection`, [linhas 195-196](my-microerp/client/src/features/crm/CrmPage.tsx#L195)); enviar `email`/`phone` em `createContact`.
  - Tabela: adicionar coluna Telefone e um botão de **editar** por linha → abre edição inline (ou um `Sheet`/`Dialog` pequeno) com nome, cargo, e-mail, telefone → `updateContact`.
  - Observação: o schema valida `email` como e-mail (`z.string().email()`), então enviar `undefined` quando vazio (nunca string vazia).

---

## Item 1 — Histórico de oportunidades por empresa + retomar

**Backend — filtro por empresa em oportunidades:**
- **[crm.repository.ts](my-microerp/server/features/crm/crm.repository.ts) `findOpportunities`** — aceitar `companyId?` e adicionar `o.company_id = $n` ao WHERE (mesmo padrão do filtro de `status`/`pipelineId`, [linha 457](my-microerp/server/features/crm/crm.repository.ts#L457)).
- **[crm.service.ts](my-microerp/server/features/crm/crm.service.ts) `listOpportunities`** e **[crm.controller.ts](my-microerp/server/features/crm/crm.controller.ts) `listOpportunities`** — propagar `company_id` (usar `parseQueryInt(req,'company_id')`, já disponível).
- **[api.ts](my-microerp/client/src/features/crm/api.ts) `listOpportunities`** — aceitar `companyId` em `opts` e mandar `company_id` no querystring (`qs` já existe).

**Frontend — drawer de detalhe da empresa:**
- **[hooks.ts](my-microerp/client/src/features/crm/hooks.ts)** — novo hook `useCompanyOpportunities(companyId)` que busca **todas** as oportunidades da empresa (sem filtro de status), expondo `reopen(id)` = `crmApi.updateOpportunity(id, { status: 'open' })` + reload.
- **Novo componente** `client/src/features/crm/CompanyDrawer.tsx` — `Sheet` (reusar padrão de [OpportunityDrawer.tsx](my-microerp/client/src/features/crm/OpportunityDrawer.tsx)) listando as oportunidades da empresa agrupadas/etiquetadas por status (Aberta / Ganha / Perdida) com título, valor, estágio, datas (`won_at`/`lost_at`) e `lost_reason`. Para Ganha/Perdida, botão **Reabrir** → `reopen(id)`.
- **[CrmPage.tsx](my-microerp/client/src/features/crm/CrmPage.tsx) `CompaniesSection`** — tornar a linha (nome) clicável para abrir o `CompanyDrawer` da empresa selecionada (manter o botão de excluir com `stopPropagation`).

> Reabrir aciona, no backend, a remoção dos AR pendentes (ver Item 3 / wiring), pois `updateOpportunity` passa a tratar a transição `won → open`.

---

## Item 3 — Ganha gera Contas a Receber (parcelado)

### Schema / shared
- **[shared/receivables/schemas.ts](my-microerp/shared/receivables/schemas.ts)** — adicionar `opportunity_id: z.number().int().positive().nullable()` ao `ReceivableSchema` (rastreia origem; permite dedupe e remoção no reabrir).
- **[shared/crm/schemas.ts](my-microerp/shared/crm/schemas.ts)** — novo `WinOpportunityBodySchema`:
  ```
  installments: array({ description?: string<=500, amount: number.positive(), due_date: /^\d{4}-\d{2}-\d{2}$/ }).min(1)
  ```
  Exportar tipo em `shared/crm/types.ts`.

### Receivables (backend)
- **[receivables.repository.ts](my-microerp/server/features/receivables/receivables.repository.ts)**:
  - `ensureSchema`: `ALTER TABLE ar.receivables ADD COLUMN IF NOT EXISTS opportunity_id INTEGER REFERENCES crm.opportunities(id) ON DELETE SET NULL` (mesmo padrão idempotente do v2 de oportunidades).
  - `SELECT_COLS` e `create`: incluir `opportunity_id`.
  - `createForOpportunity(opportunityId, customerId, items[])` — insere N parcelas numa transação, com `opportunity_id` preenchido. `description` por parcela (ex.: `"<título> — Parcela i/N"`).
  - `deletePendingByOpportunity(opportunityId)` — `DELETE ... WHERE opportunity_id=$1 AND status='pending'` (não remove parcelas já baixadas).
- **[receivables.service.ts](my-microerp/server/features/receivables/receivables.service.ts)** — expor `createForOpportunity(...)` e `deletePendingByOpportunity(id)`.

### CRM (backend) — orquestração
- **[crm.repository.ts](my-microerp/server/features/crm/crm.repository.ts)** — tornar `getOpportunityById` público (precisamos de `company_id`/status atual; renomear/expor como `findOpportunityById`).
- **[crm.service.ts](my-microerp/server/features/crm/crm.service.ts)** — injetar `ReceivableService` (opcional) no construtor:
  - `winOpportunity(id, installments)`: busca a oportunidade; **bloqueia** se soma das parcelas ≤ 0 (`AppError(400)`); valida que ainda não está `won` (evita AR duplicado); chama `repo.updateOpportunity(id,{status:'won'})`; depois `receivableService.createForOpportunity(id, opp.company_id, installments)`; retorna a oportunidade atualizada.
  - `updateOpportunity`: ao detectar transição `won → open` (status atual era `won` e novo é `open`), chamar `receivableService.deletePendingByOpportunity(id)` após a atualização.
- **[crm.controller.ts](my-microerp/server/features/crm/crm.controller.ts)** — handler `winOpportunity` (parse de `WinOpportunityBodySchema`).
- **[crm.router.ts](my-microerp/server/features/crm/crm.router.ts)** — `app.post('/api/opportunities/:id/win', controller.winOpportunity)` (antes da rota `/:id` genérica não é necessário pois o sufixo difere, mas manter junto das demais de opportunities).

### Wiring (server.ts)
- **[server.ts](my-microerp/server/server.ts)** — hoje cada `register*` constrói tudo isolado, e AR é registrado depois do CRM (FK depende de `crm.companies`). Ajustar para que `CrmService` receba o `ReceivableService`:
  - `registerReceivablesRoutes` passa a **retornar** o `ReceivableService`.
  - `registerCrmRoutes` ganha parâmetro opcional `receivableService`.
  - Ordem em `onPluginsReady`: garantir `crm.companies` (CRM `ensureSchema`) **antes** do AR `ensureSchema`. Como o CRM precisa do AR service e o AR precisa do schema CRM, separar “ensure schema” da construção do service: ex. construir/ensure CRM repo → construir/ensure AR (obtendo o service) → registrar rotas do CRM já com o `receivableService`. Manter `todos` e `payables` como estão.

### CRM (frontend) — fluxo de ganhar com parcelas
- **[api.ts](my-microerp/client/src/features/crm/api.ts)** — `winOpportunity(id, body)` → `POST /api/opportunities/:id/win`.
- **[hooks.ts](my-microerp/client/src/features/crm/hooks.ts) `useBoard`** — `winOpportunity(id, installments)` chamando a api e aplicando `applyUpdated` (remove do board, igual ao update para `won`).
- **Novo componente** `client/src/features/crm/WinDialog.tsx` — `Dialog`/`Sheet` com editor de parcelas:
  - Pré-preenche 1 parcela = `opportunity.amount`, vencimento = `expected_close` ou hoje+30d.
  - Atalho “parcelar em N vezes”: divide o total em N parcelas mensais (1º vencimento = previsão/hoje+30d). Permite editar valor/vencimento de cada parcela e adicionar/remover.
  - Confirmar **desabilitado** se total ≤ 0 ou alguma parcela inválida (atende ao “bloquear sem valor”).
- **[OpportunityDrawer.tsx](my-microerp/client/src/features/crm/OpportunityDrawer.tsx)** — botão **Ganho** abre o `WinDialog` em vez de `onUpdate({status:'won'})`. (Perdido continua via `PATCH {status:'lost'}`.)
- **[PipelineBoard.tsx](my-microerp/client/src/features/crm/PipelineBoard.tsx)** — soltar na drop zone **GANHO** (`dropOnZone('won')`, [linha 86](my-microerp/client/src/features/crm/PipelineBoard.tsx#L86)) passa a abrir o `WinDialog` (estado `winTarget` no board) em vez de marcar won direto. O `WinDialog` é renderizado no board e compartilhado com o drawer.

---

## Verificação (end-to-end)

Rodar o app (`npm run dev` em `my-microerp`, conforme o projeto) e, na aba CRM:

1. **Contato:** aba Contatos → selecionar empresa → criar contato com e-mail+telefone; editar um contato existente para preencher e-mail. Confirmar que persiste (recarregar) e que e-mail inválido é rejeitado.
2. **Histórico/retomar:** marcar uma oportunidade como Ganha e outra Perdida; na aba Empresas, clicar na empresa e ver ambas no drawer com status; clicar **Reabrir** numa delas e confirmar que volta ao board (`status='open'`).
3. **Ganha → AR parcelado:** marcar oportunidade como Ganha → diálogo de parcelas; tentar confirmar com total 0 (deve bloquear); definir 3 parcelas mensais e confirmar; conferir na tela de Contas a Receber que surgiram 3 lançamentos com cliente, valores e vencimentos corretos (vinculados via `opportunity_id`).
4. **Reabrir remove AR pendente:** reabrir a oportunidade ganha do passo 3 e confirmar que os AR **pendentes** dela some(m); se um deles tiver sido baixado, ele permanece.
5. Conferir build/tsc (`npm run build` ou `tsc`) sem erros de tipo (schemas/types são fonte única de verdade — atualizar `shared/*/types.ts` via `z.infer`).
