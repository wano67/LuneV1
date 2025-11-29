import { z } from 'zod';

export const businessTopClientsSchema = z.object({
  businessId: z.string(),
  currency: z.string(),
  period: z.object({
    from: z.string(),
    to: z.string(),
  }),
  topClients: z.array(
    z.object({
      clientId: z.string(),
      name: z.string(),
      totalInvoiced: z.number(),
      totalPaid: z.number(),
      projectCount: z.number(),
      averageInvoice: z.number(),
      lastActivityAt: z.string().nullable(),
    }),
  ),
  generatedAt: z.string(),
});

export type BusinessTopClientsDto = z.infer<typeof businessTopClientsSchema>;
