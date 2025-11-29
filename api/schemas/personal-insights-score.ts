import { z } from 'zod';

export const personalScoreSchema = z.object({
  score: z.number(),
  grade: z.string(),
  explanation: z.array(z.string()),
  inputs: z.object({
    savingsRate: z.number(),
    volatility: z.number(),
    monthsInRed: z.number(),
    periodMonths: z.number(),
  }),
  generatedAt: z.string(),
});

export type PersonalScoreDto = z.infer<typeof personalScoreSchema>;
