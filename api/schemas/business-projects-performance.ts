import { z } from 'zod';

export const businessProjectsPerformanceSchema = z.object({
  businessId: z.string(),
  totalProjects: z.number(),
  completedProjects: z.number(),
  onTimeProjects: z.number(),
  onTimeRate: z.number(), // 0..1
  averageDurationDays: z.number(), // 0 if no completed projects
  averageDelayDays: z.number(), // moyenne des retards positifs, 0 si aucun
  statusDistribution: z.array(
    z.object({
      status: z.string(),
      count: z.number(),
    }),
  ),
  generatedAt: z.string(),
});

export type BusinessProjectsPerformanceDto = z.infer<typeof businessProjectsPerformanceSchema>;
