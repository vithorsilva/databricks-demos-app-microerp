import { useState, useEffect, useCallback } from 'react';
import { crmApi } from './api.js';
import type {
  Company,
  CompanyType,
  Contact,
  Opportunity,
  Pipeline,
  Activity,
  InsightsResponse,
  CreateCompanyBody,
  CreateContactBody,
  UpdateContactBody,
  CreateOpportunityBody,
  UpdateOpportunityBody,
  WinOpportunityBody,
  CreateStageBody,
  UpdateStageBody,
  CreateActivityBody,
  ReorderOpportunitiesBody,
} from '@shared/crm/types.js';

function msg(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

export function useCompanies(type?: CompanyType) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (withSpinner: boolean) => {
      if (withSpinner) setLoading(true);
      crmApi
        .listCompanies(type)
        .then(setCompanies)
        .catch((e: unknown) => setError(msg(e, 'Failed to load companies')))
        .finally(() => setLoading(false));
    },
    [type]
  );

  useEffect(() => {
    crmApi
      .listCompanies(type)
      .then(setCompanies)
      .catch((e: unknown) => setError(msg(e, 'Failed to load companies')))
      .finally(() => setLoading(false));
  }, [type]);

  const createCompany = useCallback(
    async (body: CreateCompanyBody) => {
      try {
        await crmApi.createCompany(body);
        load(false);
      } catch (e) {
        setError(msg(e, 'Failed to create company'));
      }
    },
    [load]
  );

  const deleteCompany = useCallback(async (id: number) => {
    try {
      await crmApi.deleteCompany(id);
      setCompanies((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      setError(msg(e, 'Failed to delete company'));
    }
  }, []);

  return { companies, loading, error, createCompany, deleteCompany };
}

export function useContacts(companyId?: number) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (companyId === undefined) return;
    crmApi
      .listContacts(companyId)
      .then(setContacts)
      .catch((e: unknown) => setError(msg(e, 'Failed to load contacts')))
      .finally(() => setLoading(false));
  }, [companyId]);

  const createContact = useCallback(async (body: CreateContactBody): Promise<Contact | null> => {
    try {
      const created = await crmApi.createContact(body);
      setContacts((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      return created;
    } catch (e) {
      setError(msg(e, 'Failed to create contact'));
      return null;
    }
  }, []);

  const updateContact = useCallback(async (id: number, body: UpdateContactBody): Promise<Contact | null> => {
    try {
      const updated = await crmApi.updateContact(id, body);
      setContacts((prev) => prev.map((c) => (c.id === id ? updated : c)).sort((a, b) => a.name.localeCompare(b.name)));
      return updated;
    } catch (e) {
      setError(msg(e, 'Failed to update contact'));
      return null;
    }
  }, []);

  const deleteContact = useCallback(async (id: number) => {
    try {
      await crmApi.deleteContact(id);
      setContacts((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      setError(msg(e, 'Failed to delete contact'));
    }
  }, []);

  return { contacts, loading, error, createContact, updateContact, deleteContact };
}

/** Carrega os funis e expõe o funil atualmente selecionado + CRUD de funis/estágios. */
export function usePipelines() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [currentId, setCurrentId] = useState<number | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<Pipeline[]> => {
    try {
      const list = await crmApi.listPipelines();
      setPipelines(list);
      setCurrentId((prev) => (prev && list.some((p) => p.id === prev) ? prev : list[0]?.id));
      return list;
    } catch (e) {
      setError(msg(e, 'Falha ao carregar funis'));
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const current = pipelines.find((p) => p.id === currentId);

  const createPipeline = useCallback(
    async (name: string) => {
      try {
        const created = await crmApi.createPipeline({ name });
        await reload();
        setCurrentId(created.id);
      } catch (e) {
        setError(msg(e, 'Falha ao criar funil'));
      }
    },
    [reload]
  );

  const renamePipeline = useCallback(
    async (id: number, name: string) => {
      try {
        await crmApi.updatePipeline(id, { name });
        await reload();
      } catch (e) {
        setError(msg(e, 'Falha ao renomear funil'));
      }
    },
    [reload]
  );

  const deletePipeline = useCallback(
    async (id: number) => {
      try {
        await crmApi.deletePipeline(id);
        await reload();
      } catch (e) {
        setError(msg(e, 'Falha ao excluir funil'));
      }
    },
    [reload]
  );

  const createStage = useCallback(
    async (body: CreateStageBody) => {
      try {
        await crmApi.createStage(body);
        await reload();
      } catch (e) {
        setError(msg(e, 'Falha ao criar estágio'));
      }
    },
    [reload]
  );

  const updateStage = useCallback(
    async (id: number, body: UpdateStageBody) => {
      try {
        await crmApi.updateStage(id, body);
        await reload();
      } catch (e) {
        setError(msg(e, 'Falha ao atualizar estágio'));
      }
    },
    [reload]
  );

  const deleteStage = useCallback(
    async (id: number) => {
      try {
        await crmApi.deleteStage(id);
        await reload();
      } catch (e) {
        setError(msg(e, 'Falha ao excluir estágio'));
      }
    },
    [reload]
  );

  return {
    pipelines,
    current,
    currentId,
    setCurrentId,
    loading,
    error,
    reload,
    createPipeline,
    renamePipeline,
    deletePipeline,
    createStage,
    updateStage,
    deleteStage,
  };
}

/** Oportunidades em aberto de um funil + mutações (otimista no reorder/status). */
export function useBoard(pipelineId?: number) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (pipelineId === undefined) return;
    crmApi
      .listOpportunities({ pipelineId, status: 'open' })
      .then(setOpportunities)
      .catch((e: unknown) => setError(msg(e, 'Falha ao carregar oportunidades')))
      .finally(() => setLoading(false));
  }, [pipelineId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const createOpportunity = useCallback(
    async (body: CreateOpportunityBody) => {
      try {
        const created = await crmApi.createOpportunity(body);
        if (created.status === 'open' && created.pipeline_id === pipelineId) {
          setOpportunities((prev) => [...prev, created]);
        }
        return created;
      } catch (e) {
        setError(msg(e, 'Falha ao criar oportunidade'));
        return null;
      }
    },
    [pipelineId]
  );

  /** Aplica resultado do servidor: remove se saiu do board (ganho/perdido/outro funil). */
  const applyUpdated = useCallback(
    (updated: Opportunity) => {
      setOpportunities((prev) => {
        const stillOnBoard = updated.status === 'open' && updated.pipeline_id === pipelineId;
        const without = prev.filter((o) => o.id !== updated.id);
        return stillOnBoard ? [...without, updated] : without;
      });
    },
    [pipelineId]
  );

  const updateOpportunity = useCallback(
    async (id: number, body: UpdateOpportunityBody) => {
      try {
        const updated = await crmApi.updateOpportunity(id, body);
        applyUpdated(updated);
        return updated;
      } catch (e) {
        setError(msg(e, 'Falha ao atualizar oportunidade'));
        reload();
        return null;
      }
    },
    [applyUpdated, reload]
  );

  const winOpportunity = useCallback(
    async (id: number, body: WinOpportunityBody) => {
      try {
        const updated = await crmApi.winOpportunity(id, body);
        applyUpdated(updated);
        return updated;
      } catch (e) {
        setError(msg(e, 'Falha ao marcar como ganha'));
        return null;
      }
    },
    [applyUpdated]
  );

  /** Move otimista no estado e persiste via /reorder. `next` é a lista resultante. */
  const persistReorder = useCallback(
    async (next: Opportunity[], items: ReorderOpportunitiesBody['items']) => {
      setOpportunities(next);
      try {
        await crmApi.reorderOpportunities({ items });
      } catch (e) {
        setError(msg(e, 'Falha ao reordenar'));
        reload();
      }
    },
    [reload]
  );

  const deleteOpportunity = useCallback(async (id: number) => {
    try {
      await crmApi.deleteOpportunity(id);
      setOpportunities((prev) => prev.filter((o) => o.id !== id));
    } catch (e) {
      setError(msg(e, 'Falha ao excluir oportunidade'));
    }
  }, []);

  return {
    opportunities,
    loading,
    error,
    reload,
    createOpportunity,
    updateOpportunity,
    winOpportunity,
    persistReorder,
    deleteOpportunity,
  };
}

/** Todas as oportunidades de uma empresa (qualquer status) + reabrir uma fechada. */
export function useCompanyOpportunities(companyId?: number) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (companyId === undefined) return;
    crmApi
      .listOpportunities({ companyId })
      .then(setOpportunities)
      .catch((e: unknown) => setError(msg(e, 'Falha ao carregar oportunidades')))
      .finally(() => setLoading(false));
  }, [companyId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const reopen = useCallback(async (id: number) => {
    try {
      const updated = await crmApi.updateOpportunity(id, { status: 'open' });
      setOpportunities((prev) => prev.map((o) => (o.id === id ? updated : o)));
      return updated;
    } catch (e) {
      setError(msg(e, 'Falha ao reabrir oportunidade'));
      return null;
    }
  }, []);

  return { opportunities, loading, error, reload, reopen };
}

export function useActivities(opportunityId?: number) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (opportunityId === undefined) return;
    crmApi
      .listActivities(opportunityId)
      .then(setActivities)
      .catch((e: unknown) => setError(msg(e, 'Falha ao carregar atividades')))
      .finally(() => setLoading(false));
  }, [opportunityId]);

  const createActivity = useCallback(async (body: CreateActivityBody) => {
    try {
      const created = await crmApi.createActivity(body);
      setActivities((prev) => [created, ...prev]);
    } catch (e) {
      setError(msg(e, 'Falha ao criar atividade'));
    }
  }, []);

  const toggleActivity = useCallback(async (id: number, done: boolean) => {
    try {
      const updated = await crmApi.updateActivity(id, { done });
      setActivities((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (e) {
      setError(msg(e, 'Falha ao atualizar atividade'));
    }
  }, []);

  const deleteActivity = useCallback(async (id: number) => {
    try {
      await crmApi.deleteActivity(id);
      setActivities((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      setError(msg(e, 'Falha ao excluir atividade'));
    }
  }, []);

  return { activities, loading, error, createActivity, toggleActivity, deleteActivity };
}

export function useInsights(pipelineId?: number, from?: string, to?: string) {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (pipelineId === undefined) return;
    crmApi
      .getInsights({ pipelineId, from: from || undefined, to: to || undefined })
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => setError(msg(e, 'Falha ao carregar relatórios')))
      .finally(() => setLoading(false));
  }, [pipelineId, from, to]);

  return { data, loading, error };
}
