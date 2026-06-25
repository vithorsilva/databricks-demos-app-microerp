import type { z } from 'zod';
import type {
  PayableSchema,
  CreatePayableBodySchema,
  UpdatePayableBodySchema,
  PayableSummarySchema,
  PayableListResponseSchema,
  PayableStatusEnum,
} from './schemas.js';

export type PayableStatus = z.infer<typeof PayableStatusEnum>;
export type Payable = z.infer<typeof PayableSchema>;
export type CreatePayableBody = z.infer<typeof CreatePayableBodySchema>;
export type UpdatePayableBody = z.infer<typeof UpdatePayableBodySchema>;
export type PayableSummary = z.infer<typeof PayableSummarySchema>;
export type PayableListResponse = z.infer<typeof PayableListResponseSchema>;
