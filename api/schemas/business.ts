import { z } from 'zod';

export const businessSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  legalForm: z.string().nullable(),
  registrationNumber: z.string().nullable(),
  taxId: z.string().nullable(),
  currency: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const businessSettingsSchema = z.object({
  businessId: z.string(),
  invoicePrefix: z.string().nullable(),
  invoiceNextNumber: z.number(),
  quotePrefix: z.string().nullable(),
  quoteNextNumber: z.number(),
  defaultVatRate: z.number().nullable(),
  defaultPaymentTermsDays: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const businessListSchema = z.array(
  z.object({
    business: businessSchema,
    settings: businessSettingsSchema,
  })
);

export const createBusinessBodySchema = z.object({
  name: z.string().min(1),
  legalForm: z.string().min(1).nullable().optional(),
  registrationNumber: z.string().min(1).nullable().optional(),
  taxId: z.string().min(1).nullable().optional(),
  currency: z.string().min(1).nullable().optional(),
  invoicePrefix: z.string().min(1).nullable().optional(),
  quotePrefix: z.string().min(1).nullable().optional(),
  defaultVatRate: z.number().min(0).max(100).nullable().optional(),
  defaultPaymentTermsDays: z.number().int().nonnegative().nullable().optional(),
});

export const updateBusinessProfileBodySchema = z.object({
  name: z.string().min(1).optional(),
  legalForm: z.string().min(1).nullable().optional(),
  registrationNumber: z.string().min(1).nullable().optional(),
  taxId: z.string().min(1).nullable().optional(),
  currency: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const updateBusinessSettingsBodySchema = z.object({
  invoicePrefix: z.string().min(1).nullable().optional(),
  invoiceNextNumber: z.number().int().positive().nullable().optional(),
  quotePrefix: z.string().min(1).nullable().optional(),
  quoteNextNumber: z.number().int().positive().nullable().optional(),
  defaultVatRate: z.number().min(0).max(100).nullable().optional(),
  defaultPaymentTermsDays: z.number().int().nonnegative().nullable().optional(),
});
