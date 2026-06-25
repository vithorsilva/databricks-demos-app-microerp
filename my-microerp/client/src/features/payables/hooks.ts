import { useState, useEffect, useCallback } from 'react';
import { payablesApi } from './api.js';
import { crmApi } from '../crm/api.js';
import type { Payable, PayableStatus, PayableSummary, CreatePayableBody } from '@shared/payables/types.js';
import type { Company } from '@shared/crm/types.js';

function msg(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

type Filter = PayableStatus | 'all';

export function usePayables() {
  const [items, setItems] = useState<Payable[]>([]);
  const [summary, setSummary] = useState<PayableSummary | null>(null);
  const [suppliers, setSuppliers] = useState<Company[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback((withSpinner: boolean) => {
    if (withSpinner) setLoading(true);
    Promise.all([
      payablesApi.list(filter === 'all' ? undefined : filter),
      payablesApi.summary(),
    ])
      .then(([list, sum]) => {
        setItems(list);
        setSummary(sum);
      })
      .catch((e: unknown) => setError(msg(e, 'Failed to load payables')))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    // efeito dispara o fetch; setState ocorre só nas callbacks assíncronas
    Promise.all([
      payablesApi.list(filter === 'all' ? undefined : filter),
      payablesApi.summary(),
    ])
      .then(([list, sum]) => {
        setItems(list);
        setSummary(sum);
      })
      .catch((e: unknown) => setError(msg(e, 'Failed to load payables')))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    crmApi.listCompanies('supplier').then(setSuppliers).catch(() => { /* selects ficam vazios */ });
  }, []);

  const reload = useCallback(() => fetchData(false), [fetchData]);

  const createPayable = useCallback(async (body: CreatePayableBody) => {
    try {
      await payablesApi.create(body);
      reload();
    } catch (e) {
      setError(msg(e, 'Failed to create payable'));
    }
  }, [reload]);

  const settlePayable = useCallback(async (id: number) => {
    try {
      await payablesApi.settle(id);
      reload();
    } catch (e) {
      setError(msg(e, 'Failed to settle payable'));
    }
  }, [reload]);

  const deletePayable = useCallback(async (id: number) => {
    try {
      await payablesApi.remove(id);
      reload();
    } catch (e) {
      setError(msg(e, 'Failed to delete payable'));
    }
  }, [reload]);

  return {
    items, summary, suppliers, filter, setFilter,
    loading, error, createPayable, settlePayable, deletePayable,
  };
}
