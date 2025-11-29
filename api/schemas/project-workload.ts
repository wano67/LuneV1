import { z } from 'zod';
import { projectTaskTimeInsightSchema } from './project-insights-tasks';

export const projectWorkloadStatusBucketSchema = z.object({
  status: z.enum(['todo', 'in_progress', 'blocked', 'done']),
  estimatedHours: z.number(),
  actualHours: z.number(),
});

export const projectWorkloadPeriodBucketSchema = z.object({
  periodKey: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  estimatedHours: z.number(),
  actualHours: z.number(),
});

export const projectWorkloadOverviewSchema = z.object({
  projectId: z.string(),
  totalEstimatedHours: z.number(),
  totalActualHours: z.number(),
  remainingHours: z.number(),
  completionRate: z.number(),
  granularity: z.enum(['week', 'month']),
  rangeStart: z.string().nullable(),
  rangeEnd: z.string().nullable(),
  byStatus: z.array(projectWorkloadStatusBucketSchema),
  byPeriod: z.array(projectWorkloadPeriodBucketSchema),
  topByActualHours: z.array(projectTaskTimeInsightSchema),
  topByOverrun: z.array(projectTaskTimeInsightSchema),
  generatedAt: z.string(),
});

export type ProjectWorkloadOverviewDto = z.infer<typeof projectWorkloadOverviewSchema>;
