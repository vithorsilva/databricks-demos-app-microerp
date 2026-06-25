import { z } from 'zod';

export const PayableStatusEnum = z.enum(['pending', 'paid', 'overdue']);

export const PayableSchema = z.object({
  id: z.number().int().positive(),
  supplier_id: z.number().int().positive(),
  supplier_name: z.string(),
  description: z.string().min(1),
  amount: z.number().positive(),
  due_date: z.string(),
  status: PayableStatusEnum,
  paid_at: z.string().nullable(),
  created_at: z.string(),
});

export const CreatePayableBodySchema = z.object({
  supplier_id: z.number().int().positive(),
  description: z.string().min(1, 'Description is required').max(500),
  amount: z.number().positive('Amount must be greater than 0'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
});

export const UpdatePayableBodySchema = CreatePayableBodySchema.partial();

export const PayableSummarySchema = z.object({
  total_pending: z.number(),
  total_overdue: z.number(),
  total_paid_month: z.number(),
  count_overdue: z.number().int(),
});

export const PayableListResponseSchema = z.array(PayableSchema);
