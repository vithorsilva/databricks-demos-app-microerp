import type { z } from 'zod';
import type {
  ReceivableSchema,
  CreateReceivableBodySchema,
  UpdateReceivableBodySchema,
  ReceivableSummarySchema,
  ReceivableListResponseSchema,
  ReceivableStatusEnum,
} from './schemas.js';

export type ReceivableStatus = z.infer<typeof ReceivableStatusEnum>;
export type Receivable = z.infer<typeof ReceivableSchema>;
export type CreateReceivableBody = z.infer<typeof CreateReceivableBodySchema>;
export type UpdateReceivableBody = z.infer<typeof UpdateReceivableBodySchema>;
export type ReceivableSummary = z.infer<typeof ReceivableSummarySchema>;
export type ReceivableListResponse = z.infer<typeof ReceivableListResponseSchema>;
