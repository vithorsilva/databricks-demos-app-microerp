import { createApp, lakebase, server } from '@databricks/appkit';
import { registerTodosRoutes } from './features/todos/todos.router.js';
import { registerCrmRoutes } from './features/crm/crm.router.js';
import { registerReceivablesRoutes } from './features/receivables/receivables.router.js';
import { registerPayablesRoutes } from './features/payables/payables.router.js';

createApp({
  plugins: [
    lakebase(),
    server(),
  ],
  async onPluginsReady(appkit) {
    await registerTodosRoutes(appkit);
    // CRM cria crm.companies — deve vir antes de AR/AP (FK target).
    await registerCrmRoutes(appkit);
    await registerReceivablesRoutes(appkit);
    await registerPayablesRoutes(appkit);
  },
}).catch(console.error);
