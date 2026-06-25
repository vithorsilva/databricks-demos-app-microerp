import { z } from 'zod';

export const ReceivableStatusEnum = z.enum(['pending', 'paid', 'overdue']);

export const ReceivableSchema = z.object({
  id: z.number().int().positive(),
  customer_id: z.number().int().positive(),
  customer_name: z.string(),
  description: z.string().min(1),
  amount: z.number().positive(),
  due_date: z.string(),
  status: ReceivableStatusEnum,
  paid_at: z.string().nullable(),
  created_at: z.string(),
});

export const CreateReceivableBodySchema = z.object({
  customer_id: z.number().int().positive(),
  description: z.string().min(1, 'Description is required').max(500),
  amount: z.number().positive('Amount must be greater than 0'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
});

export const UpdateReceivableBodySchema = CreateReceivableBodySchema.partial();

export const ReceivableSummarySchema = z.object({
  total_pending: z.number(),
  total_overdue: z.number(),
  total_received_month: z.number(),
  count_overdue: z.number().int(),
});

export const ReceivableListResponseSchema = z.array(ReceivableSchema);
