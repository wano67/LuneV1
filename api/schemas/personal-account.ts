import { z } from 'zod';

export const personalAccountSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  type: z.string().nullable(),
  currency: z.string().nullable(),
  isArchived: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const personalAccountListSchema = z.array(personalAccountSchema);

export const createPersonalAccountBodySchema = z.object({
  name: z.string().min(1),
  type: z.string().optional(),
  currency: z.string().min(1).optional(),
  initialBalance: z.number().optional(),
  isArchived: z.boolean().optional(),
});

export const updatePersonalAccountBodySchema = z.object({
  name: z.string().min(1).optional(),
  type: z.string().optional(),
  currency: z.string().min(1).optional(),
  isArchived: z.boolean().optional(),
});
