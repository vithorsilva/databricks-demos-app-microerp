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
  CreateOpportunityBody,
  UpdateOpportunityBody,
} from '@shared/crm/types.js';

export const crmApi = {
  // Companies
  listCompanies: (type?: CompanyType) =>
    api.get<CompanyListResponse>(`/api/companies${type ? `?type=${type}` : ''}`),
  createCompany: (body: CreateCompanyBody) => api.post<Company>('/api/companies', body),
  updateCompany: (id: number, body: UpdateCompanyBody) => api.patch<Company>(`/api/companies/${id}`, body),
  deleteCompany: (id: number) => api.delete<void>(`/api/companies/${id}`),

  // Contacts
  listContacts: (companyId?: number) =>
    api.get<ContactListResponse>(`/api/contacts${companyId ? `?company_id=${companyId}` : ''}`),
  createContact: (body: CreateContactBody) => api.post<Contact>('/api/contacts', body),
  updateContact: (id: number, body: UpdateContactBody) => api.patch<Contact>(`/api/contacts/${id}`, body),
  deleteContact: (id: number) => api.delete<void>(`/api/contacts/${id}`),

  // Opportunities
  listOpportunities: () => api.get<OpportunityListResponse>('/api/opportunities'),
  createOpportunity: (body: CreateOpportunityBody) => api.post<Opportunity>('/api/opportunities', body),
  updateOpportunity: (id: number, body: UpdateOpportunityBody) =>
    api.patch<Opportunity>(`/api/opportunities/${id}`, body),
  deleteOpportunity: (id: number) => api.delete<void>(`/api/opportunities/${id}`),
};
