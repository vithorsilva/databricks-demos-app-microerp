import type { z } from 'zod';
import type {
  CompanySchema,
  CreateCompanyBodySchema,
  UpdateCompanyBodySchema,
  ContactSchema,
  CreateContactBodySchema,
  UpdateContactBodySchema,
  OpportunitySchema,
  CreateOpportunityBodySchema,
  UpdateOpportunityBodySchema,
  CompanyListResponseSchema,
  ContactListResponseSchema,
  OpportunityListResponseSchema,
  CompanyTypeEnum,
  OpportunityStageEnum,
} from './schemas.js';

export type CompanyType = z.infer<typeof CompanyTypeEnum>;
export type OpportunityStage = z.infer<typeof OpportunityStageEnum>;

export type Company = z.infer<typeof CompanySchema>;
export type CreateCompanyBody = z.infer<typeof CreateCompanyBodySchema>;
export type UpdateCompanyBody = z.infer<typeof UpdateCompanyBodySchema>;

export type Contact = z.infer<typeof ContactSchema>;
export type CreateContactBody = z.infer<typeof CreateContactBodySchema>;
export type UpdateContactBody = z.infer<typeof UpdateContactBodySchema>;

export type Opportunity = z.infer<typeof OpportunitySchema>;
export type CreateOpportunityBody = z.infer<typeof CreateOpportunityBodySchema>;
export type UpdateOpportunityBody = z.infer<typeof UpdateOpportunityBodySchema>;

export type CompanyListResponse = z.infer<typeof CompanyListResponseSchema>;
export type ContactListResponse = z.infer<typeof ContactListResponseSchema>;
export type OpportunityListResponse = z.infer<typeof OpportunityListResponseSchema>;
