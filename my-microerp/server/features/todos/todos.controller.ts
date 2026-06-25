import type { Request, Response } from 'express';
import { CreateTodoBodySchema } from '../../../shared/todos/schemas.js';
import { sendError } from '../../lib/errors.js';
import type { TodoService } from './todos.service.js';

export class TodoController {
  constructor(private readonly service: TodoService) {}

  list = async (_req: Request, res: Response): Promise<void> => {
    try {
      const todos = await this.service.listTodos();
      res.json(todos);
    } catch (err) {
      sendError(res, err);
    }
  };

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = CreateTodoBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'title is required' });
        return;
      }
      const todo = await this.service.createTodo(parsed.data.title);
      res.status(201).json(todo);
    } catch (err) {
      sendError(res, err);
    }
  };

  toggle = async (req: Request, res: Response): Promise<void> => {
    try {
      const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const id = parseInt(rawId, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid id' });
        return;
      }
      const todo = await this.service.toggleTodo(id);
      res.json(todo);
    } catch (err) {
      sendError(res, err);
    }
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    try {
      const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const id = parseInt(rawId, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid id' });
        return;
      }
      await this.service.deleteTodo(id);
      res.status(204).send();
    } catch (err) {
      sendError(res, err);
    }
  };
}
