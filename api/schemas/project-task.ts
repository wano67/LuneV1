import { z } from 'zod';

export const dateOnlyStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format, expected YYYY-MM-DD');

export const projectTaskSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.enum(['todo', 'in_progress', 'blocked', 'done']),
  startDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  completedAt: z.string().nullable(),
  progressPct: z.number().min(0).max(100),
  sortIndex: z.number(),
  estimatedHours: z.number().nullable(),
  actualHours: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const projectTaskListSchema = z.array(projectTaskSchema);

export const createProjectTaskBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  status: z.enum(['todo', 'in_progress', 'blocked', 'done']).optional(),
  startDate: dateOnlyStringSchema.nullable().optional(),
  dueDate: dateOnlyStringSchema.nullable().optional(),
  progressPct: z.number().min(0).max(100).optional(),
  sortIndex: z.number().optional(),
  estimatedHours: z.number().nonnegative().nullable().optional(),
});

export const updateProjectTaskBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(['todo', 'in_progress', 'blocked', 'done']).optional(),
  startDate: dateOnlyStringSchema.nullable().optional(),
  dueDate: dateOnlyStringSchema.nullable().optional(),
  completedAt: dateOnlyStringSchema.nullable().optional(),
  progressPct: z.number().min(0).max(100).optional(),
  sortIndex: z.number().optional(),
  estimatedHours: z.number().nonnegative().nullable().optional(),
  actualHours: z.number().nonnegative().nullable().optional(),
});
