import type { Application } from 'express';
import { TodoRepository } from './todos.repository.js';
import { TodoService } from './todos.service.js';
import { TodoController } from './todos.controller.js';
import type { DbClient } from '../../lib/db.js';

interface AppKitWithLakebase {
  lakebase: DbClient;
  server: {
    extend(fn: (app: Application) => void): void;
  };
}

export async function registerTodosRoutes(appkit: AppKitWithLakebase): Promise<void> {
  const repo = new TodoRepository(appkit.lakebase);
  await repo.ensureSchema();

  const service = new TodoService(repo);
  const controller = new TodoController(service);

  appkit.server.extend((app) => {
    app.get('/api/todos', controller.list);
    app.post('/api/todos', controller.create);
    app.patch('/api/todos/:id', controller.toggle);
    app.delete('/api/todos/:id', controller.remove);
  });
}
