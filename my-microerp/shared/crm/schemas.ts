import { z } from 'zod';

export const CompanyTypeEnum = z.enum(['customer', 'supplier', 'both']);
/** Legado v1 — mantido por compatibilidade; v2 usa stage_id + status. */
export const OpportunityStageEnum = z.enum(['lead', 'qualified', 'proposal', 'won', 'lost']);
export const OpportunityStatusEnum = z.enum(['open', 'won', 'lost']);
export const ActivityTypeEnum = z.enum(['call', 'email', 'meeting', 'task', 'note']);

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

// ── Pipelines & Stages ─────────────────────────────────────
export const StageSchema = z.object({
  id: z.number().int().positive(),
  pipeline_id: z.number().int().positive(),
  name: z.string().min(1),
  position: z.number().int(),
  probability: z.number().int().min(0).max(100),
  created_at: z.string(),
});

export const PipelineSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  position: z.number().int(),
  created_at: z.string(),
  stages: z.array(StageSchema),
});

export const CreatePipelineBodySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(120),
});

export const UpdatePipelineBodySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  position: z.number().int().optional(),
});

export const CreateStageBodySchema = z.object({
  pipeline_id: z.number().int().positive(),
  name: z.string().min(1, 'Nome é obrigatório').max(120),
  probability: z.number().int().min(0).max(100).optional(),
});

export const UpdateStageBodySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  probability: z.number().int().min(0).max(100).optional(),
  position: z.number().int().optional(),
});

export const ReorderStagesBodySchema = z.object({
  items: z.array(z.object({ id: z.number().int().positive(), position: z.number().int() })).min(1),
});

// ── Opportunities ──────────────────────────────────────────
export const OpportunitySchema = z.object({
  id: z.number().int().positive(),
  company_id: z.number().int().positive(),
  company_name: z.string(),
  title: z.string().min(1),
  pipeline_id: z.number().int().positive(),
  stage_id: z.number().int().positive(),
  stage_name: z.string(),
  probability: z.number().int(), // herdada do estágio
  status: OpportunityStatusEnum,
  amount: z.number().nullable(),
  owner: z.string().nullable(),
  lost_reason: z.string().nullable(),
  sort_index: z.number().int(),
  expected_close: z.string().nullable(),
  stage_changed_at: z.string(),
  won_at: z.string().nullable(),
  lost_at: z.string().nullable(),
  created_at: z.string(),
});

export const CreateOpportunityBodySchema = z.object({
  company_id: z.number().int().positive(),
  title: z.string().min(1, 'Title is required').max(200),
  pipeline_id: z.number().int().positive().optional(),
  stage_id: z.number().int().positive().optional(),
  amount: z.number().positive().nullish(),
  owner: z.string().max(120).nullish(),
  expected_close: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date')
    .nullish(),
});

export const UpdateOpportunityBodySchema = z.object({
  company_id: z.number().int().positive().optional(),
  title: z.string().min(1).max(200).optional(),
  pipeline_id: z.number().int().positive().optional(),
  stage_id: z.number().int().positive().optional(),
  status: OpportunityStatusEnum.optional(),
  lost_reason: z.string().max(500).nullish(),
  sort_index: z.number().int().optional(),
  amount: z.number().positive().nullish(),
  owner: z.string().max(120).nullish(),
  expected_close: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date')
    .nullish(),
});

export const ReorderOpportunitiesBodySchema = z.object({
  items: z
    .array(
      z.object({
        id: z.number().int().positive(),
        stage_id: z.number().int().positive(),
        sort_index: z.number().int(),
      })
    )
    .min(1),
});

// ── Activities ─────────────────────────────────────────────
export const ActivitySchema = z.object({
  id: z.number().int().positive(),
  opportunity_id: z.number().int().positive(),
  type: ActivityTypeEnum,
  subject: z.string().min(1),
  notes: z.string().nullable(),
  due_date: z.string().nullable(),
  done: z.boolean(),
  created_at: z.string(),
});

export const CreateActivityBodySchema = z.object({
  opportunity_id: z.number().int().positive(),
  type: ActivityTypeEnum,
  subject: z.string().min(1, 'Assunto é obrigatório').max(200),
  notes: z.string().max(2000).nullish(),
  due_date: z.string().nullish(),
});

export const UpdateActivityBodySchema = z.object({
  type: ActivityTypeEnum.optional(),
  subject: z.string().min(1).max(200).optional(),
  notes: z.string().max(2000).nullish(),
  due_date: z.string().nullish(),
  done: z.boolean().optional(),
});

// ── Insights / Reports ─────────────────────────────────────
export const FunnelStageReportSchema = z.object({
  stage_id: z.number().int(),
  stage_name: z.string(),
  position: z.number().int(),
  probability: z.number().int(),
  count: z.number().int(),
  value: z.number(),
  conversion: z.number(), // % de deals que alcançaram este estágio vs. o primeiro
});

export const ForecastMonthSchema = z.object({
  month: z.string(), // YYYY-MM
  value: z.number(),
  weighted: z.number(),
});

export const LostReasonSchema = z.object({
  reason: z.string(),
  count: z.number().int(),
  value: z.number(),
});

export const OwnerPerformanceSchema = z.object({
  owner: z.string(),
  open_count: z.number().int(),
  open_value: z.number(),
  won_count: z.number().int(),
  won_value: z.number(),
  lost_count: z.number().int(),
});

export const WonLostSummarySchema = z.object({
  open_count: z.number().int(),
  open_value: z.number(),
  weighted_value: z.number(),
  won_count: z.number().int(),
  won_value: z.number(),
  lost_count: z.number().int(),
  lost_value: z.number(),
  win_rate: z.number(),
  avg_ticket: z.number(),
  lost_reasons: z.array(LostReasonSchema),
});

export const InsightsResponseSchema = z.object({
  funnel: z.array(FunnelStageReportSchema),
  forecast: z.array(ForecastMonthSchema),
  won_lost: WonLostSummarySchema,
  owner_performance: z.array(OwnerPerformanceSchema),
});

// ── List responses ─────────────────────────────────────────
export const CompanyListResponseSchema = z.array(CompanySchema);
export const ContactListResponseSchema = z.array(ContactSchema);
export const OpportunityListResponseSchema = z.array(OpportunitySchema);
export const PipelineListResponseSchema = z.array(PipelineSchema);
export const ActivityListResponseSchema = z.array(ActivitySchema);
