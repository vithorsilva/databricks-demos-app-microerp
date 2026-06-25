import type { Application } from 'express';
import { PayableRepository } from './payables.repository.js';
import { PayableService } from './payables.service.js';
import { PayableController } from './payables.controller.js';
import type { DbClient } from '../../lib/db.js';

interface AppKitWithLakebase {
  lakebase: DbClient;
  server: {
    extend(fn: (app: Application) => void): void;
  };
}

export async function registerPayablesRoutes(appkit: AppKitWithLakebase): Promise<void> {
  const repo = new PayableRepository(appkit.lakebase);
  await repo.ensureSchema();

  const service = new PayableService(repo);
  const controller = new PayableController(service);

  appkit.server.extend((app) => {
    app.get('/api/payables/summary', controller.summary); // antes de :id
    app.get('/api/payables', controller.list);
    app.post('/api/payables', controller.create);
    app.post('/api/payables/:id/settle', controller.settle);
    app.patch('/api/payables/:id', controller.update);
    app.delete('/api/payables/:id', controller.remove);
  });
}
