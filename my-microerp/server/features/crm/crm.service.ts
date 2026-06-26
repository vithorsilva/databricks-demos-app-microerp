import type {
  Company,
  CompanyType,
  Contact,
  Opportunity,
  Pipeline,
  Stage,
  Activity,
  InsightsResponse,
  CreateCompanyBody,
  UpdateCompanyBody,
  CreateContactBody,
  UpdateContactBody,
  CreateOpportunityBody,
  UpdateOpportunityBody,
  ReorderOpportunitiesBody,
  CreatePipelineBody,
  UpdatePipelineBody,
  CreateStageBody,
  UpdateStageBody,
  ReorderStagesBody,
  CreateActivityBody,
  UpdateActivityBody,
} from '../../../shared/crm/types.js';
import { AppError } from '../../lib/errors.js';
import type { CrmRepository } from './crm.repository.js';

export class CrmService {
  constructor(private readonly repo: CrmRepository) {}

  // Companies
  listCompanies(type?: CompanyType): Promise<Company[]> {
    return this.repo.findCompanies(type);
  }

  createCompany(body: CreateCompanyBody): Promise<Company> {
    return this.repo.createCompany({ ...body, name: body.name.trim() });
  }

  updateCompany(id: number, body: UpdateCompanyBody): Promise<Company> {
    return this.repo.updateCompany(id, body);
  }

  async deleteCompany(id: number): Promise<void> {
    const linked = await this.repo.countLinkedRecords(id);
    if (linked > 0) throw new AppError(409, 'Company has linked records');
    return this.repo.deleteCompany(id);
  }

  // Contacts
  listContacts(companyId?: number): Promise<Contact[]> {
    return this.repo.findContacts(companyId);
  }

  createContact(body: CreateContactBody): Promise<Contact> {
    return this.repo.createContact({ ...body, name: body.name.trim() });
  }

  updateContact(id: number, body: UpdateContactBody): Promise<Contact> {
    return this.repo.updateContact(id, body);
  }

  deleteContact(id: number): Promise<void> {
    return this.repo.deleteContact(id);
  }

  // Pipelines
  listPipelines(): Promise<Pipeline[]> {
    return this.repo.findPipelines();
  }

  createPipeline(body: CreatePipelineBody): Promise<Pipeline> {
    return this.repo.createPipeline({ ...body, name: body.name.trim() });
  }

  updatePipeline(id: number, body: UpdatePipelineBody): Promise<Pipeline> {
    return this.repo.updatePipeline(id, body);
  }

  async deletePipeline(id: number): Promise<void> {
    const total = await this.repo.countPipelines();
    if (total <= 1) throw new AppError(409, 'Não é possível excluir o único funil');
    return this.repo.deletePipeline(id);
  }

  // Stages
  createStage(body: CreateStageBody): Promise<Stage> {
    return this.repo.createStage({ ...body, name: body.name.trim() });
  }

  updateStage(id: number, body: UpdateStageBody): Promise<Stage> {
    return this.repo.updateStage(id, body);
  }

  reorderStages(body: ReorderStagesBody): Promise<void> {
    return this.repo.reorderStages(body);
  }

  async deleteStage(id: number): Promise<void> {
    const linked = await this.repo.countOpportunitiesInStage(id);
    if (linked > 0) throw new AppError(409, 'Estágio possui oportunidades');
    return this.repo.deleteStage(id);
  }

  // Opportunities
  listOpportunities(pipelineId?: number, status?: string): Promise<Opportunity[]> {
    return this.repo.findOpportunities(pipelineId, status);
  }

  createOpportunity(body: CreateOpportunityBody): Promise<Opportunity> {
    return this.repo.createOpportunity({ ...body, title: body.title.trim() });
  }

  updateOpportunity(id: number, body: UpdateOpportunityBody): Promise<Opportunity> {
    if (body.status === 'lost' && body.lost_reason !== undefined && body.lost_reason !== null) {
      body = { ...body, lost_reason: body.lost_reason.trim() };
    }
    return this.repo.updateOpportunity(id, body);
  }

  reorderOpportunities(body: ReorderOpportunitiesBody): Promise<void> {
    return this.repo.reorderOpportunities(body);
  }

  deleteOpportunity(id: number): Promise<void> {
    return this.repo.deleteOpportunity(id);
  }

  // Activities
  listActivities(opportunityId: number): Promise<Activity[]> {
    return this.repo.findActivities(opportunityId);
  }

  createActivity(body: CreateActivityBody): Promise<Activity> {
    return this.repo.createActivity({ ...body, subject: body.subject.trim() });
  }

  updateActivity(id: number, body: UpdateActivityBody): Promise<Activity> {
    return this.repo.updateActivity(id, body);
  }

  deleteActivity(id: number): Promise<void> {
    return this.repo.deleteActivity(id);
  }

  // Insights
  async getInsights(pipelineId: number | undefined, from?: string, to?: string): Promise<InsightsResponse> {
    const pid = pipelineId ?? (await this.repo.getDefaultPipelineId());
    if (pid === null) throw new AppError(404, 'Nenhum funil encontrado');
    return this.repo.getInsights(pid, from, to);
  }
}
