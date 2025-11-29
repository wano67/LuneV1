import { z } from 'zod';

export const invoiceLineSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  serviceId: z.string().nullable(),
  description: z.string(),
  quantity: z.number(),
  unit: z.string().nullable(),
  unitPrice: z.number(),
  vatRate: z.number().nullable(),
  discountPct: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const invoicePaymentSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  amount: z.number(),
  paidAt: z.string(),
  method: z.string().nullable(),
  notes: z.string().nullable(),
  transactionId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const invoiceSchema = z.object({
  id: z.string(),
  businessId: z.string(),
  clientId: z.string(),
  projectId: z.string().nullable(),
  quoteId: z.string().nullable(),
  number: z.string(),
  status: z.string(),
  currency: z.string().nullable(),
  issuedAt: z.string(),
  dueAt: z.string(),
  subtotalAmount: z.number(),
  discountAmount: z.number(),
  vatAmount: z.number(),
  totalAmount: z.number(),
  amountPaid: z.number(),
  amountDue: z.number(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const invoiceWithItemsSchema = z.object({
  invoice: invoiceSchema,
  items: z.array(invoiceLineSchema),
});

export const invoiceWithItemsAndPaymentsSchema = z.object({
  invoice: invoiceSchema,
  items: z.array(invoiceLineSchema),
  payments: z.array(invoicePaymentSchema),
});

export const dateOnlyStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/,'Invalid date format, expected YYYY-MM-DD');

export const createInvoiceLineBodySchema = z.object({
  serviceId: z.string().nullable().optional(),
  description: z.string().optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().optional(),
  vatRate: z.number().nullable().optional(),
});

export const createInvoiceBodySchema = z.object({
  clientId: z.string(),
  projectId: z.string().nullable().optional(),
  currency: z.string().optional(),
  issuedAt: dateOnlyStringSchema.optional(),
  dueAt: dateOnlyStringSchema.optional(),
  notes: z.string().nullable().optional(),
  items: z.array(createInvoiceLineBodySchema).min(1),
});

export const createInvoicePaymentBodySchema = z.object({
  amount: z.number().positive(),
  accountId: z.string().min(1),
  paidAt: dateOnlyStringSchema.optional(),
  method: z.string().min(1),
  notes: z.string().nullable().optional(),
  label: z.string().optional(),
});


export const invoiceListSchema = z.array(invoiceWithItemsSchema);

export const updateInvoiceBodySchema = z.object({
  status: z.string().optional(),
  dueAt: dateOnlyStringSchema.optional(),
  notes: z.string().nullable().optional(),
});
