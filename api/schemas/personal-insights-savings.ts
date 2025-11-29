import { z } from 'zod';

export const dateOnlyStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format, expected YYYY-MM-DD');

export const personalSavingsPlanQuerySchema = z.object({
  targetAmount: z.number().positive(),
  targetDate: dateOnlyStringSchema,
  currentSavings: z.number().nonnegative().optional(),
});

export const personalSavingsPlanSchema = z.object({
  baseCurrency: z.string(),
  targetAmount: z.number(),
  targetDate: z.string(),
  today: z.string(),
  monthsRemaining: z.number(),
  daysRemaining: z.number(),
  estimatedMonthlyIncome: z.number(),
  estimatedMonthlySpending: z.number(),
  estimatedSavingsCapacity: z.number(),
  currentBalance: z.number(),
  effectiveCurrentSavings: z.number(),
  requiredMonthlySavings: z.number(),
  requiredDailySavings: z.number(),
  requiredSavingsRate: z.number(),
  status: z.enum(['on_track', 'stretch', 'unrealistic']),
  notes: z.array(z.string()),
  generatedAt: z.string(),
});

export type PersonalSavingsPlanDto = z.infer<typeof personalSavingsPlanSchema>;
