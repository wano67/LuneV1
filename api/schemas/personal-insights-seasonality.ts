import { z } from 'zod';

export const personalSeasonalityPointSchema = z.object({
  month: z.string(), // YYYY-MM
  income: z.number(),
  spending: z.number(),
  net: z.number(),
  zScore: z.number(),
  isAnomaly: z.boolean(),
});

export const personalSeasonalitySchema = z.object({
  periodMonths: z.number(),
  currency: z.string(),
  points: z.array(personalSeasonalityPointSchema),
  generatedAt: z.string(),
});

export type PersonalSeasonalityDto = z.infer<typeof personalSeasonalitySchema>;
