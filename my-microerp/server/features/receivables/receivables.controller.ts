import type { Request, Response } from 'express';
import {
  CreateReceivableBodySchema,
  UpdateReceivableBodySchema,
  ReceivableStatusEnum,
} from '../../../shared/receivables/schemas.js';
import { sendError } from '../../lib/errors.js';
import type { ReceivableService } from './receivables.service.js';

function parseId(req: Request): number | null {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  return isNaN(id) ? null : id;
}

function firstZodMessage(error: { issues: { message: string }[] }, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

export class ReceivableController {
  constructor(private readonly service: ReceivableService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    try {
      const statusParam = typeof req.query.status === 'string' ? req.query.status : undefined;
      const parsedStatus = statusParam ? ReceivableStatusEnum.safeParse(statusParam) : null;
      if (parsedStatus && !parsedStatus.success) {
        res.status(400).json({ error: 'Invalid status' });
        return;
      }
      const items = await this.service.list(parsedStatus?.data);
      res.json(items);
    } catch (err) {
      sendError(res, err);
    }
  };

  summary = async (_req: Request, res: Response): Promise<void> => {
    try {
      res.json(await this.service.summary());
    } catch (err) {
      sendError(res, err);
    }
  };

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = CreateReceivableBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: firstZodMessage(parsed.error, 'Invalid receivable') });
        return;
      }
      const item = await this.service.create(parsed.data);
      res.status(201).json(item);
    } catch (err) {
      sendError(res, err);
    }
  };

  update = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseId(req);
      if (id === null) {
        res.status(400).json({ error: 'Invalid id' });
        return;
      }
      const parsed = UpdateReceivableBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: firstZodMessage(parsed.error, 'Invalid receivable') });
        return;
      }
      const item = await this.service.update(id, parsed.data);
      res.json(item);
    } catch (err) {
      sendError(res, err);
    }
  };

  settle = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseId(req);
      if (id === null) {
        res.status(400).json({ error: 'Invalid id' });
        return;
      }
      const item = await this.service.settle(id);
      res.json(item);
    } catch (err) {
      sendError(res, err);
    }
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseId(req);
      if (id === null) {
        res.status(400).json({ error: 'Invalid id' });
        return;
      }
      await this.service.remove(id);
      res.status(204).send();
    } catch (err) {
      sendError(res, err);
    }
  };
}
