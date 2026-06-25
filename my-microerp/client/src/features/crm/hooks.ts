import { useState, useEffect, useCallback } from 'react';
import { crmApi } from './api.js';
import type {
  Company,
  CompanyType,
  Contact,
  Opportunity,
  CreateCompanyBody,
  CreateContactBody,
  CreateOpportunityBody,
  UpdateOpportunityBody,
} from '@shared/crm/types.js';

function msg(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

export function useCompanies(type?: CompanyType) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((withSpinner: boolean) => {
    if (withSpinner) setLoading(true);
    crmApi
      .listCompanies(type)
      .then(setCompanies)
      .catch((e: unknown) => setError(msg(e, 'Failed to load companies')))
      .finally(() => setLoading(false));
  }, [type]);

  useEffect(() => {
    // efeito apenas dispara o fetch; setState ocorre nas callbacks assíncronas
    crmApi
      .listCompanies(type)
      .then(setCompanies)
      .catch((e: unknown) => setError(msg(e, 'Failed to load companies')))
      .finally(() => setLoading(false));
  }, [type]);

  const createCompany = useCallback(async (body: CreateCompanyBody) => {
    try {
      await crmApi.createCompany(body);
      load(false);
    } catch (e) {
      setError(msg(e, 'Failed to create company'));
    }
  }, [load]);

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
    // Sem empresa selecionada não há o que buscar; a página esconde a tabela
    // nesse caso (companyId === undefined), então não tocamos no estado aqui.
    if (companyId === undefined) return;
    crmApi
      .listContacts(companyId)
      .then(setContacts)
      .catch((e: unknown) => setError(msg(e, 'Failed to load contacts')))
      .finally(() => setLoading(false));
  }, [companyId]);

  const createContact = useCallback(async (body: CreateContactBody) => {
    try {
      const created = await crmApi.createContact(body);
      setContacts((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {
      setError(msg(e, 'Failed to create contact'));
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

  return { contacts, loading, error, createContact, deleteContact };
}

export function useOpportunities() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    crmApi
      .listOpportunities()
      .then(setOpportunities)
      .catch((e: unknown) => setError(msg(e, 'Failed to load opportunities')))
      .finally(() => setLoading(false));
  }, []);

  const createOpportunity = useCallback(async (body: CreateOpportunityBody) => {
    try {
      const created = await crmApi.createOpportunity(body);
      setOpportunities((prev) => [created, ...prev]);
    } catch (e) {
      setError(msg(e, 'Failed to create opportunity'));
    }
  }, []);

  const updateOpportunity = useCallback(async (id: number, body: UpdateOpportunityBody) => {
    try {
      const updated = await crmApi.updateOpportunity(id, body);
      setOpportunities((prev) => prev.map((o) => (o.id === id ? updated : o)));
    } catch (e) {
      setError(msg(e, 'Failed to update opportunity'));
    }
  }, []);

  return { opportunities, loading, error, createOpportunity, updateOpportunity };
}
