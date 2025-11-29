import { z } from 'zod';

const dateOnlyStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format, expected YYYY-MM-DD');

export const personalTransactionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  accountId: z.string(),
  direction: z.enum(['in', 'out', 'transfer']),
  amount: z.number(),
  currency: z.string(),
  occurredAt: z.string(),
  label: z.string(),
  category: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const personalTransactionListSchema = z.array(personalTransactionSchema);

export const createPersonalTransactionBodySchema = z.object({
  accountId: z.string().min(1),
  direction: z.enum(['in', 'out', 'transfer']),
  amount: z.number().positive(),
  currency: z.string().min(1).optional(),
  occurredAt: dateOnlyStringSchema,
  label: z.string().min(1),
  category: z.string().optional(),
  notes: z.string().optional(),
});

export const updatePersonalTransactionBodySchema = z.object({
  direction: z.enum(['in', 'out', 'transfer']).optional(),
  amount: z.number().positive().optional(),
  currency: z.string().min(1).optional(),
  occurredAt: dateOnlyStringSchema.optional(),
  label: z.string().min(1).optional(),
  category: z.string().optional(),
  notes: z.string().optional(),
});

export const listPersonalTransactionsQuerySchema = z.object({
  accountId: z.string().optional(),
  dateFrom: dateOnlyStringSchema.optional(),
  dateTo: dateOnlyStringSchema.optional(),
  direction: z.enum(['in', 'out', 'transfer']).optional(),
});
