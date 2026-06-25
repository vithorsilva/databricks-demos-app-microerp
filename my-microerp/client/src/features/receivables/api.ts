import { api } from '../../api/index.js';
import type {
  Receivable,
  ReceivableStatus,
  ReceivableListResponse,
  ReceivableSummary,
  CreateReceivableBody,
  UpdateReceivableBody,
} from '@shared/receivables/types.js';

export const receivablesApi = {
  list: (status?: ReceivableStatus) =>
    api.get<ReceivableListResponse>(`/api/receivables${status ? `?status=${status}` : ''}`),
  summary: () => api.get<ReceivableSummary>('/api/receivables/summary'),
  create: (body: CreateReceivableBody) => api.post<Receivable>('/api/receivables', body),
  update: (id: number, body: UpdateReceivableBody) => api.patch<Receivable>(`/api/receivables/${id}`, body),
  settle: (id: number) => api.post<Receivable>(`/api/receivables/${id}/settle`, {}),
  remove: (id: number) => api.delete<void>(`/api/receivables/${id}`),
};
