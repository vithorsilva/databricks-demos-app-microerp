import { createApp, lakebase, server } from '@databricks/appkit';
import { registerTodosRoutes } from './features/todos/todos.router.js';
import { registerCrmRoutes } from './features/crm/crm.router.js';
import { CrmRepository } from './features/crm/crm.repository.js';
import { registerReceivablesRoutes } from './features/receivables/receivables.router.js';
import { registerPayablesRoutes } from './features/payables/payables.router.js';

createApp({
  plugins: [
    lakebase(),
    server(),
  ],
  async onPluginsReady(appkit) {
    await registerTodosRoutes(appkit);
    // CRM cria crm.companies/opportunities — deve vir antes de AR/AP (FK target).
    // ar.receivables.opportunity_id referencia crm.opportunities, então garantimos o
    // schema do CRM primeiro; depois registramos AR (obtendo o service) e por fim o CRM
    // com o ReceivableService injetado (para gerar contas a receber ao ganhar). ensureSchema é idempotente.
    await new CrmRepository(appkit.lakebase).ensureSchema();
    const receivableService = await registerReceivablesRoutes(appkit);
    await registerCrmRoutes(appkit, receivableService);
    await registerPayablesRoutes(appkit);
  },
}).catch(console.error);
