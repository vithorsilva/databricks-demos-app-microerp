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

    // Pipelines
    app.get('/api/pipelines', controller.listPipelines);
    app.post('/api/pipelines', controller.createPipeline);
    app.patch('/api/pipelines/:id', controller.updatePipeline);
    app.delete('/api/pipelines/:id', controller.deletePipeline);

    // Stages (rota fixa /reorder antes de /:id)
    app.post('/api/stages', controller.createStage);
    app.patch('/api/stages/reorder', controller.reorderStages);
    app.patch('/api/stages/:id', controller.updateStage);
    app.delete('/api/stages/:id', controller.deleteStage);

    // Opportunities (rotas fixas antes de /:id)
    app.get('/api/opportunities/insights', controller.getInsights);
    app.get('/api/opportunities', controller.listOpportunities);
    app.post('/api/opportunities', controller.createOpportunity);
    app.patch('/api/opportunities/reorder', controller.reorderOpportunities);
    app.patch('/api/opportunities/:id', controller.updateOpportunity);
    app.delete('/api/opportunities/:id', controller.deleteOpportunity);

    // Activities
    app.get('/api/activities', controller.listActivities);
    app.post('/api/activities', controller.createActivity);
    app.patch('/api/activities/:id', controller.updateActivity);
    app.delete('/api/activities/:id', controller.deleteActivity);
  });
}
