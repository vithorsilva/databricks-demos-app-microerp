import type { Application } from 'express';
import { CrmRepository } from './crm.repository.js';
import { CrmService } from './crm.service.js';
import { CrmController } from './crm.controller.js';
import type { DbClient } from '../../lib/db.js';

interface AppKitWithLakebase {
  lakebase: DbClient;
  server: {
    extend(fn: (app: Application) => void): void;
  };
}

export async function registerCrmRoutes(appkit: AppKitWithLakebase): Promise<void> {
  const repo = new CrmRepository(appkit.lakebase);
  await repo.ensureSchema();

  const service = new CrmService(repo);
  const controller = new CrmController(service);

  appkit.server.extend((app) => {
    // Companies
    app.get('/api/companies', controller.listCompanies);
    app.post('/api/companies', controller.createCompany);
    app.patch('/api/companies/:id', controller.updateCompany);
    app.delete('/api/companies/:id', controller.deleteCompany);

    // Contacts
    app.get('/api/contacts', controller.listContacts);
    app.post('/api/contacts', controller.createContact);
    app.patch('/api/contacts/:id', controller.updateContact);
    app.delete('/api/contacts/:id', controller.deleteContact);

    // Opportunities
    app.get('/api/opportunities', controller.listOpportunities);
    app.post('/api/opportunities', controller.createOpportunity);
    app.patch('/api/opportunities/:id', controller.updateOpportunity);
    app.delete('/api/opportunities/:id', controller.deleteOpportunity);
  });
}
