import { z } from 'zod';

export const projectSchema = z.object({
  id: z.string(),
  userId: z.string(),
  businessId: z.string().nullable(),
  clientId: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  startDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  completedAt: z.string().nullable(),
  budgetAmount: z.number().nullable(),
  currency: z.string().nullable(),
  priority: z.string().nullable(),
  progressManualPct: z.number().nullable(),
  progressAutoMode: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const projectListSchema = z.array(projectSchema);

export const createProjectServiceItemSchema = z.object({
  serviceId: z.string(),
  quantity: z.number(),
  customLabel: z.string().optional(),
});

export const createProjectBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  currency: z.string().min(1).nullable().optional(),
  status: z.string().optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.string().optional(),
  budgetAmount: z.number().nullable().optional(),
  clientId: z.string().nullable().optional(),
  services: z.array(createProjectServiceItemSchema).optional(),
});

export const updateProjectBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.string().optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  completedAt: z.string().nullable().optional(),
  priority: z.string().optional(),
  budgetAmount: z.number().nonnegative().nullable().optional(),
  currency: z.string().min(1).optional(),
  progressManualPct: z.number().min(0).max(100).nullable().optional(),
  progressAutoMode: z.string().nullable().optional(),
  clientId: z.string().nullable().optional(),
});
