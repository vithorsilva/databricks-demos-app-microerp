import { useState, useEffect, useCallback } from 'react';
import { receivablesApi } from './api.js';
import { crmApi } from '../crm/api.js';
import type { Receivable, ReceivableStatus, ReceivableSummary, CreateReceivableBody } from '@shared/receivables/types.js';
import type { Company } from '@shared/crm/types.js';

function msg(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

type Filter = ReceivableStatus | 'all';

export function useReceivables() {
  const [items, setItems] = useState<Receivable[]>([]);
  const [summary, setSummary] = useState<ReceivableSummary | null>(null);
  const [customers, setCustomers] = useState<Company[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback((withSpinner: boolean) => {
    if (withSpinner) setLoading(true);
    Promise.all([
      receivablesApi.list(filter === 'all' ? undefined : filter),
      receivablesApi.summary(),
    ])
      .then(([list, sum]) => {
        setItems(list);
        setSummary(sum);
      })
      .catch((e: unknown) => setError(msg(e, 'Failed to load receivables')))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    // efeito dispara o fetch; setState ocorre só nas callbacks assíncronas
    Promise.all([
      receivablesApi.list(filter === 'all' ? undefined : filter),
      receivablesApi.summary(),
    ])
      .then(([list, sum]) => {
        setItems(list);
        setSummary(sum);
      })
      .catch((e: unknown) => setError(msg(e, 'Failed to load receivables')))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    crmApi.listCompanies('customer').then(setCustomers).catch(() => { /* selects ficam vazios */ });
  }, []);

  const reload = useCallback(() => fetchData(false), [fetchData]);

  const createReceivable = useCallback(async (body: CreateReceivableBody) => {
    try {
      await receivablesApi.create(body);
      reload();
    } catch (e) {
      setError(msg(e, 'Failed to create receivable'));
    }
  }, [reload]);

  const settleReceivable = useCallback(async (id: number) => {
    try {
      await receivablesApi.settle(id);
      reload();
    } catch (e) {
      setError(msg(e, 'Failed to settle receivable'));
    }
  }, [reload]);

  const deleteReceivable = useCallback(async (id: number) => {
    try {
      await receivablesApi.remove(id);
      reload();
    } catch (e) {
      setError(msg(e, 'Failed to delete receivable'));
    }
  }, [reload]);

  return {
    items, summary, customers, filter, setFilter,
    loading, error, createReceivable, settleReceivable, deleteReceivable,
  };
}
