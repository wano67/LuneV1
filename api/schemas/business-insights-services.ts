import { z } from 'zod';

export const businessTopServicesSchema = z.object({
  businessId: z.string(),
  currency: z.string(),
  period: z.object({
    from: z.string(),
    to: z.string(),
  }),
  topServices: z.array(
    z.object({
      serviceId: z.string(),
      name: z.string(),
      totalInvoiced: z.number(),
      totalPaid: z.number(),
      projectCount: z.number(),
      averagePrice: z.number(),
      lastActivityAt: z.string().nullable(),
    }),
  ),
  generatedAt: z.string(),
});

export type BusinessTopServicesDto = z.infer<typeof businessTopServicesSchema>;
