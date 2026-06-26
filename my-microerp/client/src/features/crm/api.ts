import { api } from '../../api/index.js';
import type {
  Company,
  CompanyType,
  CompanyListResponse,
  CreateCompanyBody,
  UpdateCompanyBody,
  Contact,
  ContactListResponse,
  CreateContactBody,
  UpdateContactBody,
  Opportunity,
  OpportunityListResponse,
  OpportunityStatus,
  CreateOpportunityBody,
  UpdateOpportunityBody,
  ReorderOpportunitiesBody,
  Pipeline,
  PipelineListResponse,
  CreatePipelineBody,
  UpdatePipelineBody,
  Stage,
  CreateStageBody,
  UpdateStageBody,
  ReorderStagesBody,
  Activity,
  ActivityListResponse,
  CreateActivityBody,
  UpdateActivityBody,
  InsightsResponse,
} from '@shared/crm/types.js';

function qs(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
}

export const crmApi = {
  // Companies
  listCompanies: (type?: CompanyType) => api.get<CompanyListResponse>(`/api/companies${type ? `?type=${type}` : ''}`),
  createCompany: (body: CreateCompanyBody) => api.post<Company>('/api/companies', body),
  updateCompany: (id: number, body: UpdateCompanyBody) => api.patch<Company>(`/api/companies/${id}`, body),
  deleteCompany: (id: number) => api.delete<void>(`/api/companies/${id}`),

  // Contacts
  listContacts: (companyId?: number) =>
    api.get<ContactListResponse>(`/api/contacts${companyId ? `?company_id=${companyId}` : ''}`),
  createContact: (body: CreateContactBody) => api.post<Contact>('/api/contacts', body),
  updateContact: (id: number, body: UpdateContactBody) => api.patch<Contact>(`/api/contacts/${id}`, body),
  deleteContact: (id: number) => api.delete<void>(`/api/contacts/${id}`),

  // Pipelines
  listPipelines: () => api.get<PipelineListResponse>('/api/pipelines'),
  createPipeline: (body: CreatePipelineBody) => api.post<Pipeline>('/api/pipelines', body),
  updatePipeline: (id: number, body: UpdatePipelineBody) => api.patch<Pipeline>(`/api/pipelines/${id}`, body),
  deletePipeline: (id: number) => api.delete<void>(`/api/pipelines/${id}`),

  // Stages
  createStage: (body: CreateStageBody) => api.post<Stage>('/api/stages', body),
  updateStage: (id: number, body: UpdateStageBody) => api.patch<Stage>(`/api/stages/${id}`, body),
  deleteStage: (id: number) => api.delete<void>(`/api/stages/${id}`),
  reorderStages: (body: ReorderStagesBody) => api.patch<void>('/api/stages/reorder', body),

  // Opportunities
  listOpportunities: (opts?: { pipelineId?: number; status?: OpportunityStatus }) =>
    api.get<OpportunityListResponse>(
      `/api/opportunities${qs({ pipeline_id: opts?.pipelineId, status: opts?.status })}`
    ),
  createOpportunity: (body: CreateOpportunityBody) => api.post<Opportunity>('/api/opportunities', body),
  updateOpportunity: (id: number, body: UpdateOpportunityBody) =>
    api.patch<Opportunity>(`/api/opportunities/${id}`, body),
  deleteOpportunity: (id: number) => api.delete<void>(`/api/opportunities/${id}`),
  reorderOpportunities: (body: ReorderOpportunitiesBody) => api.patch<void>('/api/opportunities/reorder', body),

  // Activities
  listActivities: (opportunityId: number) =>
    api.get<ActivityListResponse>(`/api/activities?opportunity_id=${opportunityId}`),
  createActivity: (body: CreateActivityBody) => api.post<Activity>('/api/activities', body),
  updateActivity: (id: number, body: UpdateActivityBody) => api.patch<Activity>(`/api/activities/${id}`, body),
  deleteActivity: (id: number) => api.delete<void>(`/api/activities/${id}`),

  // Insights
  getInsights: (opts?: { pipelineId?: number; from?: string; to?: string }) =>
    api.get<InsightsResponse>(
      `/api/opportunities/insights${qs({ pipeline_id: opts?.pipelineId, from: opts?.from, to: opts?.to })}`
    ),
};
