import { api } from '../../api/index.js';
import type {
  Payable,
  PayableStatus,
  PayableListResponse,
  PayableSummary,
  CreatePayableBody,
  UpdatePayableBody,
} from '@shared/payables/types.js';

export const payablesApi = {
  list: (status?: PayableStatus) =>
    api.get<PayableListResponse>(`/api/payables${status ? `?status=${status}` : ''}`),
  summary: () => api.get<PayableSummary>('/api/payables/summary'),
  create: (body: CreatePayableBody) => api.post<Payable>('/api/payables', body),
  update: (id: number, body: UpdatePayableBody) => api.patch<Payable>(`/api/payables/${id}`, body),
  settle: (id: number) => api.post<Payable>(`/api/payables/${id}/settle`, {}),
  remove: (id: number) => api.delete<void>(`/api/payables/${id}`),
};
