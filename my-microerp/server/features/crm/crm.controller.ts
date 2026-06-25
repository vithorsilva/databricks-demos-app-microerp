import type { Request, Response } from 'express';
import {
  CreateCompanyBodySchema,
  UpdateCompanyBodySchema,
  CreateContactBodySchema,
  UpdateContactBodySchema,
  CreateOpportunityBodySchema,
  UpdateOpportunityBodySchema,
  CompanyTypeEnum,
} from '../../../shared/crm/schemas.js';
import { sendError } from '../../lib/errors.js';
import type { CrmService } from './crm.service.js';

function parseId(req: Request): number | null {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  return isNaN(id) ? null : id;
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

  // ── Opportunities ────────────────────────────────────────
  listOpportunities = async (_req: Request, res: Response): Promise<void> => {
    try {
      const opps = await this.service.listOpportunities();
      res.json(opps);
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
}
