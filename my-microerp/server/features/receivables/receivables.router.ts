import type { Application } from 'express';
import { ReceivableRepository } from './receivables.repository.js';
import { ReceivableService } from './receivables.service.js';
import { ReceivableController } from './receivables.controller.js';
import type { DbClient } from '../../lib/db.js';

interface AppKitWithLakebase {
  lakebase: DbClient;
  server: {
    extend(fn: (app: Application) => void): void;
  };
}

export async function registerReceivablesRoutes(appkit: AppKitWithLakebase): Promise<void> {
  const repo = new ReceivableRepository(appkit.lakebase);
  await repo.ensureSchema();

  const service = new ReceivableService(repo);
  const controller = new ReceivableController(service);

  appkit.server.extend((app) => {
    app.get('/api/receivables/summary', controller.summary); // antes de :id
    app.get('/api/receivables', controller.list);
    app.post('/api/receivables', controller.create);
    app.post('/api/receivables/:id/settle', controller.settle);
    app.patch('/api/receivables/:id', controller.update);
    app.delete('/api/receivables/:id', controller.remove);
  });
}
