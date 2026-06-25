import { createApp, lakebase, server } from '@databricks/appkit';
import { registerTodosRoutes } from './features/todos/todos.router.js';

createApp({
  plugins: [
    lakebase(),
    server(),
  ],
  async onPluginsReady(appkit) {
    await registerTodosRoutes(appkit);
  },
}).catch(console.error);
