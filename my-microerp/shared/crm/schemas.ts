import { z } from 'zod';

export const CompanyTypeEnum = z.enum(['customer', 'supplier', 'both']);
export const OpportunityStageEnum = z.enum(['lead', 'qualified', 'proposal', 'won', 'lost']);

// ── Companies ──────────────────────────────────────────────
export const CompanySchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  type: CompanyTypeEnum,
  tax_id: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
});

export const CreateCompanyBodySchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  type: CompanyTypeEnum,
  tax_id: z.string().max(40).nullish(),
  email: z.string().email().max(200).nullish(),
  phone: z.string().max(40).nullish(),
  notes: z.string().max(2000).nullish(),
});

export const UpdateCompanyBodySchema = CreateCompanyBodySchema.partial();

// ── Contacts ───────────────────────────────────────────────
export const ContactSchema = z.object({
  id: z.number().int().positive(),
  company_id: z.number().int().positive(),
  name: z.string().min(1),
  role: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  created_at: z.string(),
});

export const CreateContactBodySchema = z.object({
  company_id: z.number().int().positive(),
  name: z.string().min(1, 'Name is required').max(200),
  role: z.string().max(120).nullish(),
  email: z.string().email().max(200).nullish(),
  phone: z.string().max(40).nullish(),
});

export const UpdateContactBodySchema = CreateContactBodySchema.partial();

// ── Opportunities ──────────────────────────────────────────
export const OpportunitySchema = z.object({
  id: z.number().int().positive(),
  company_id: z.number().int().positive(),
  company_name: z.string(),
  title: z.string().min(1),
  stage: OpportunityStageEnum,
  amount: z.number().nullable(),
  owner: z.string().nullable(),
  expected_close: z.string().nullable(),
  created_at: z.string(),
});

export const CreateOpportunityBodySchema = z.object({
  company_id: z.number().int().positive(),
  title: z.string().min(1, 'Title is required').max(200),
  stage: OpportunityStageEnum.optional(),
  amount: z.number().positive().nullish(),
  owner: z.string().max(120).nullish(),
  expected_close: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date').nullish(),
});

export const UpdateOpportunityBodySchema = CreateOpportunityBodySchema.partial();

// ── List responses ─────────────────────────────────────────
export const CompanyListResponseSchema = z.array(CompanySchema);
export const ContactListResponseSchema = z.array(ContactSchema);
export const OpportunityListResponseSchema = z.array(OpportunitySchema);
