import type {
  Company,
  CompanyType,
  Contact,
  Opportunity,
  CreateCompanyBody,
  UpdateCompanyBody,
  CreateContactBody,
  UpdateContactBody,
  CreateOpportunityBody,
  UpdateOpportunityBody,
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

  // Opportunities
  listOpportunities(): Promise<Opportunity[]> {
    return this.repo.findOpportunities();
  }

  createOpportunity(body: CreateOpportunityBody): Promise<Opportunity> {
    return this.repo.createOpportunity({ ...body, title: body.title.trim() });
  }

  updateOpportunity(id: number, body: UpdateOpportunityBody): Promise<Opportunity> {
    return this.repo.updateOpportunity(id, body);
  }

  deleteOpportunity(id: number): Promise<void> {
    return this.repo.deleteOpportunity(id);
  }
}
