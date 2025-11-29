import { z } from 'zod';

export const personalIncomeSourcesSchema = z.object({
  period: z.object({ from: z.string(), to: z.string() }),
  currency: z.string(),
  sources: z.array(
    z.object({
      source: z.string(),
      total: z.number(),
      transactionCount: z.number(),
      shareOfIncome: z.number(), // 0-1
      tag: z.string().nullable(),
    }),
  ),
  topSource: z.string().nullable(),
  generatedAt: z.string(),
});

export type PersonalIncomeSourcesDto = z.infer<typeof personalIncomeSourcesSchema>;
