import type { Request, Response } from 'express';
import {
  CreateCompanyBodySchema,
  UpdateCompanyBodySchema,
  CreateContactBodySchema,
  UpdateContactBodySchema,
  CreateOpportunityBodySchema,
  UpdateOpportunityBodySchema,
  ReorderOpportunitiesBodySchema,
  CreatePipelineBodySchema,
  UpdatePipelineBodySchema,
  CreateStageBodySchema,
  UpdateStageBodySchema,
  ReorderStagesBodySchema,
  CreateActivityBodySchema,
  UpdateActivityBodySchema,
  CompanyTypeEnum,
  OpportunityStatusEnum,
  WinOpportunityBodySchema,
} from '../../../shared/crm/schemas.js';
import { sendError } from '../../lib/errors.js';
import type { CrmService } from './crm.service.js';

function parseId(req: Request): number | null {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  return isNaN(id) ? null : id;
}

function parseQueryInt(req: Request, key: string): number | undefined {
  const v = req.query[key];
  if (typeof v !== 'string' || v === '') return undefined;
  const n = parseInt(v, 10);
  return isNaN(n) ? undefined : n;
}

function queryStr(req: Request, key: string): string | undefined {
  const v = req.query[key];
  return typeof v === 'string' && v !== '' ? v : undefined;
}

/** Primeira mensagem de erro do Zod, ou um fallback. */
function firstZodMessage(error: { issues: { message: string }[] }, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

export class CrmController {
  constructor(private readonly service: CrmService) {}

  // ── Companies ────────────────────────────────────────────
  listCompanies = async (req: Request, res: Response): Promise<void> => {
    try {
      const typeParam = typeof req.query.type === 'string' ? req.query.type : undefined;
      const parsedType = typeParam ? CompanyTypeEnum.safeParse(typeParam) : null;
      if (parsedType && !parsedType.success) {
        res.status(400).json({ error: 'Invalid type' });
        return;
      }
      const companies = await this.service.listCompanies(parsedType?.data);
      res.json(companies);
    } catch (err) {
      sendError(res, err);
    }
  };

  createCompany = async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = CreateCompanyBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: firstZodMessage(parsed.error, 'Invalid company') });
        return;
      }
      const company = await this.service.createCompany(parsed.data);
      res.status(201).json(company);
    } catch (err) {
      sendError(res, err);
    }
  };

  updateCompany = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseId(req);
      if (id === null) {
        res.status(400).json({ error: 'Invalid id' });
        return;
      }
      const parsed = UpdateCompanyBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: firstZodMessage(parsed.error, 'Invalid company') });
        return;
      }
      const company = await this.service.updateCompany(id, parsed.data);
      res.json(company);
    } catch (err) {
      sendError(res, err);
    }
  };

  deleteCompany = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseId(req);
      if (id === null) {
        res.status(400).json({ error: 'Invalid id' });
        return;
      }
      await this.service.deleteCompany(id);
      res.status(204).send();
    } catch (err) {
      sendError(res, err);
    }
  };

  // ── Contacts ─────────────────────────────────────────────
  listContacts = async (req: Request, res: Response): Promise<void> => {
    try {
      const raw = typeof req.query.company_id === 'string' ? req.query.company_id : undefined;
      let companyId: number | undefined;
      if (raw !== undefined) {
        const n = parseInt(raw, 10);
        if (isNaN(n)) {
          res.status(400).json({ error: 'Invalid company_id' });
          return;
        }
        companyId = n;
      }
      const contacts = await this.service.listContacts(companyId);
      res.json(contacts);
    } catch (err) {
      sendError(res, err);
    }
  };

  createContact = async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = CreateContactBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: firstZodMessage(parsed.error, 'Invalid contact') });
        return;
      }
      const contact = await this.service.createContact(parsed.data);
      res.status(201).json(contact);
    } catch (err) {
      sendError(res, err);
    }
  };

  updateContact = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseId(req);
      if (id === null) {
        res.status(400).json({ error: 'Invalid id' });
        return;
      }
      const parsed = UpdateContactBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: firstZodMessage(parsed.error, 'Invalid contact') });
        return;
      }
      const contact = await this.service.updateContact(id, parsed.data);
      res.json(contact);
    } catch (err) {
      sendError(res, err);
    }
  };

  deleteContact = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseId(req);
      if (id === null) {
        res.status(400).json({ error: 'Invalid id' });
        return;
      }
      await this.service.deleteContact(id);
      res.status(204).send();
    } catch (err) {
      sendError(res, err);
    }
  };

  // ── Pipelines ────────────────────────────────────────────
  listPipelines = async (_req: Request, res: Response): Promise<void> => {
    try {
      res.json(await this.service.listPipelines());
    } catch (err) {
      sendError(res, err);
    }
  };

  createPipeline = async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = CreatePipelineBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: firstZodMessage(parsed.error, 'Invalid pipeline') });
        return;
      }
      res.status(201).json(await this.service.createPipeline(parsed.data));
    } catch (err) {
      sendError(res, err);
    }
  };

  updatePipeline = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseId(req);
      if (id === null) {
        res.status(400).json({ error: 'Invalid id' });
        return;
      }
      const parsed = UpdatePipelineBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: firstZodMessage(parsed.error, 'Invalid pipeline') });
        return;
      }
      res.json(await this.service.updatePipeline(id, parsed.data));
    } catch (err) {
      sendError(res, err);
    }
  };

  deletePipeline = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseId(req);
      if (id === null) {
        res.status(400).json({ error: 'Invalid id' });
        return;
      }
      await this.service.deletePipeline(id);
      res.status(204).send();
    } catch (err) {
      sendError(res, err);
    }
  };

  // ── Stages ───────────────────────────────────────────────
  createStage = async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = CreateStageBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: firstZodMessage(parsed.error, 'Invalid stage') });
        return;
      }
      res.status(201).json(await this.service.createStage(parsed.data));
    } catch (err) {
      sendError(res, err);
    }
  };

  reorderStages = async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = ReorderStagesBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: firstZodMessage(parsed.error, 'Invalid reorder') });
        return;
      }
      await this.service.reorderStages(parsed.data);
      res.status(204).send();
    } catch (err) {
      sendError(res, err);
    }
  };

  updateStage = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseId(req);
      if (id === null) {
        res.status(400).json({ error: 'Invalid id' });
        return;
      }
      const parsed = UpdateStageBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: firstZodMessage(parsed.error, 'Invalid stage') });
        return;
      }
      res.json(await this.service.updateStage(id, parsed.data));
    } catch (err) {
      sendError(res, err);
    }
  };

  deleteStage = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseId(req);
      if (id === null) {
        res.status(400).json({ error: 'Invalid id' });
        return;
      }
      await this.service.deleteStage(id);
      res.status(204).send();
    } catch (err) {
      sendError(res, err);
    }
  };

  // ── Opportunities ────────────────────────────────────────
  listOpportunities = async (req: Request, res: Response): Promise<void> => {
    try {
      const pipelineId = parseQueryInt(req, 'pipeline_id');
      const companyId = parseQueryInt(req, 'company_id');
      const statusRaw = queryStr(req, 'status');
      let status: string | undefined;
      if (statusRaw !== undefined) {
        const parsed = OpportunityStatusEnum.safeParse(statusRaw);
        if (!parsed.success) {
          res.status(400).json({ error: 'Invalid status' });
          return;
        }
        status = parsed.data;
      }
      const opps = await this.service.listOpportunities(pipelineId, status, companyId);
      res.json(opps);
    } catch (err) {
      sendError(res, err);
    }
  };

  getInsights = async (req: Request, res: Response): Promise<void> => {
    try {
      const pipelineId = parseQueryInt(req, 'pipeline_id');
      const from = queryStr(req, 'from');
      const to = queryStr(req, 'to');
      res.json(await this.service.getInsights(pipelineId, from, to));
    } catch (err) {
      sendError(res, err);
    }
  };

  createOpportunity = async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = CreateOpportunityBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: firstZodMessage(parsed.error, 'Invalid opportunity') });
        return;
      }
      const opp = await this.service.createOpportunity(parsed.data);
      res.status(201).json(opp);
    } catch (err) {
      sendError(res, err);
    }
  };

  reorderOpportunities = async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = ReorderOpportunitiesBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: firstZodMessage(parsed.error, 'Invalid reorder') });
        return;
      }
      await this.service.reorderOpportunities(parsed.data);
      res.status(204).send();
    } catch (err) {
      sendError(res, err);
    }
  };

  updateOpportunity = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseId(req);
      if (id === null) {
        res.status(400).json({ error: 'Invalid id' });
        return;
      }
      const parsed = UpdateOpportunityBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: firstZodMessage(parsed.error, 'Invalid opportunity') });
        return;
      }
      const opp = await this.service.updateOpportunity(id, parsed.data);
      res.json(opp);
    } catch (err) {
      sendError(res, err);
    }
  };

  winOpportunity = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseId(req);
      if (id === null) {
        res.status(400).json({ error: 'Invalid id' });
        return;
      }
      const parsed = WinOpportunityBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: firstZodMessage(parsed.error, 'Parcelas inválidas') });
        return;
      }
      const opp = await this.service.winOpportunity(id, parsed.data);
      res.json(opp);
    } catch (err) {
      sendError(res, err);
    }
  };

  deleteOpportunity = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseId(req);
      if (id === null) {
        res.status(400).json({ error: 'Invalid id' });
        return;
      }
      await this.service.deleteOpportunity(id);
      res.status(204).send();
    } catch (err) {
      sendError(res, err);
    }
  };

  // ── Activities ───────────────────────────────────────────
  listActivities = async (req: Request, res: Response): Promise<void> => {
    try {
      const opportunityId = parseQueryInt(req, 'opportunity_id');
      if (opportunityId === undefined) {
        res.status(400).json({ error: 'Invalid opportunity_id' });
        return;
      }
      res.json(await this.service.listActivities(opportunityId));
    } catch (err) {
      sendError(res, err);
    }
  };

  createActivity = async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = CreateActivityBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: firstZodMessage(parsed.error, 'Invalid activity') });
        return;
      }
      res.status(201).json(await this.service.createActivity(parsed.data));
    } catch (err) {
      sendError(res, err);
    }
  };

  updateActivity = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseId(req);
      if (id === null) {
        res.status(400).json({ error: 'Invalid id' });
        return;
      }
      const parsed = UpdateActivityBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: firstZodMessage(parsed.error, 'Invalid activity') });
        return;
      }
      res.json(await this.service.updateActivity(id, parsed.data));
    } catch (err) {
      sendError(res, err);
    }
  };

  deleteActivity = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseId(req);
      if (id === null) {
        res.status(400).json({ error: 'Invalid id' });
        return;
      }
      await this.service.deleteActivity(id);
      res.status(204).send();
    } catch (err) {
      sendError(res, err);
    }
  };
}
