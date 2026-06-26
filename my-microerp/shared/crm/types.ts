import type { z } from 'zod';
import type {
  CompanySchema,
  CreateCompanyBodySchema,
  UpdateCompanyBodySchema,
  ContactSchema,
  CreateContactBodySchema,
  UpdateContactBodySchema,
  StageSchema,
  PipelineSchema,
  CreatePipelineBodySchema,
  UpdatePipelineBodySchema,
  CreateStageBodySchema,
  UpdateStageBodySchema,
  ReorderStagesBodySchema,
  OpportunitySchema,
  CreateOpportunityBodySchema,
  UpdateOpportunityBodySchema,
  InstallmentSchema,
  WinOpportunityBodySchema,
  ReorderOpportunitiesBodySchema,
  ActivitySchema,
  CreateActivityBodySchema,
  UpdateActivityBodySchema,
  FunnelStageReportSchema,
  ForecastMonthSchema,
  LostReasonSchema,
  OwnerPerformanceSchema,
  WonLostSummarySchema,
  InsightsResponseSchema,
  CompanyListResponseSchema,
  ContactListResponseSchema,
  OpportunityListResponseSchema,
  PipelineListResponseSchema,
  ActivityListResponseSchema,
  CompanyTypeEnum,
  OpportunityStageEnum,
  OpportunityStatusEnum,
  ActivityTypeEnum,
} from './schemas.js';

export type CompanyType = z.infer<typeof CompanyTypeEnum>;
export type OpportunityStage = z.infer<typeof OpportunityStageEnum>;
export type OpportunityStatus = z.infer<typeof OpportunityStatusEnum>;
export type ActivityType = z.infer<typeof ActivityTypeEnum>;

export type Company = z.infer<typeof CompanySchema>;
export type CreateCompanyBody = z.infer<typeof CreateCompanyBodySchema>;
export type UpdateCompanyBody = z.infer<typeof UpdateCompanyBodySchema>;

export type Contact = z.infer<typeof ContactSchema>;
export type CreateContactBody = z.infer<typeof CreateContactBodySchema>;
export type UpdateContactBody = z.infer<typeof UpdateContactBodySchema>;

export type Stage = z.infer<typeof StageSchema>;
export type Pipeline = z.infer<typeof PipelineSchema>;
export type CreatePipelineBody = z.infer<typeof CreatePipelineBodySchema>;
export type UpdatePipelineBody = z.infer<typeof UpdatePipelineBodySchema>;
export type CreateStageBody = z.infer<typeof CreateStageBodySchema>;
export type UpdateStageBody = z.infer<typeof UpdateStageBodySchema>;
export type ReorderStagesBody = z.infer<typeof ReorderStagesBodySchema>;

export type Opportunity = z.infer<typeof OpportunitySchema>;
export type CreateOpportunityBody = z.infer<typeof CreateOpportunityBodySchema>;
export type UpdateOpportunityBody = z.infer<typeof UpdateOpportunityBodySchema>;
export type Installment = z.infer<typeof InstallmentSchema>;
export type WinOpportunityBody = z.infer<typeof WinOpportunityBodySchema>;
export type ReorderOpportunitiesBody = z.infer<typeof ReorderOpportunitiesBodySchema>;

export type Activity = z.infer<typeof ActivitySchema>;
export type CreateActivityBody = z.infer<typeof CreateActivityBodySchema>;
export type UpdateActivityBody = z.infer<typeof UpdateActivityBodySchema>;

export type FunnelStageReport = z.infer<typeof FunnelStageReportSchema>;
export type ForecastMonth = z.infer<typeof ForecastMonthSchema>;
export type LostReason = z.infer<typeof LostReasonSchema>;
export type OwnerPerformance = z.infer<typeof OwnerPerformanceSchema>;
export type WonLostSummary = z.infer<typeof WonLostSummarySchema>;
export type InsightsResponse = z.infer<typeof InsightsResponseSchema>;

export type CompanyListResponse = z.infer<typeof CompanyListResponseSchema>;
export type ContactListResponse = z.infer<typeof ContactListResponseSchema>;
export type OpportunityListResponse = z.infer<typeof OpportunityListResponseSchema>;
export type PipelineListResponse = z.infer<typeof PipelineListResponseSchema>;
export type ActivityListResponse = z.infer<typeof ActivityListResponseSchema>;
