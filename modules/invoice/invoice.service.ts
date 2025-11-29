// src/modules/invoice/invoice.service.ts
import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  BusinessId,
  ClientId,
  ProjectId,
  UserId,
  normalizeBusinessId,
  normalizeClientId,
  normalizeProjectId,
  normalizeUserId,
} from '@/modules/shared/ids';
import { assertBusinessOwnedByUser, assertUserExists } from '@/modules/shared/assertions';
import { InvoiceOwnershipError } from '@/modules/shared/errors';

export class InvoiceNotFoundError extends Error {
  constructor(message = 'Invoice not found') {
    super(message);
    this.name = 'InvoiceNotFoundError';
  }
}

export interface InvoiceItemInput {
  serviceId?: bigint | null;
  description?: string | null;
  quantity: number;
  unitPrice?: number;
  vatRate?: number | null;
}

export interface CreateInvoiceInput {
  userId: UserId;
  businessId: BusinessId;
  clientId: ClientId;
  projectId?: ProjectId | null;
  currency?: string | null;
  issuedAt?: Date;
  dueAt?: Date | null;
  notes?: string | null;
  items: InvoiceItemInput[];
}

export interface InvoiceWithItems {
  invoice: Prisma.invoicesGetPayload<{
    select: typeof invoiceSelect;
  }>;
  items: Prisma.invoice_linesGetPayload<{ select: typeof invoiceLineSelect }>[];
}

export interface InvoiceWithItemsAndPayments {
  invoice: Prisma.invoicesGetPayload<{
    include: {
      invoice_lines: { select: typeof invoiceLineSelect };
      invoice_payments: { select: typeof invoicePaymentSelect };
      businesses: { select: { user_id: true } };
    };
  }>;
  items: Prisma.invoice_linesGetPayload<{ select: typeof invoiceLineSelect }>[];
  payments: Prisma.invoice_paymentsGetPayload<{ select: typeof invoicePaymentSelect }>[];
}

const invoiceSelect = {
  id: true,
  business_id: true,
  client_id: true,
  project_id: true,
  quote_id: true,
  invoice_number: true,
  invoice_date: true,
  due_date: true,
  status: true,
  currency: true,
  payment_terms_days: true,
  subtotal_ht: true,
  discount_total: true,
  vat_total: true,
  total_ht: true,
  total_ttc: true,
  amount_paid_cached: true,
  notes: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.invoicesSelect;

const invoiceLineSelect = {
  id: true,
  invoice_id: true,
  service_id: true,
  description: true,
  quantity: true,
  unit: true,
  unit_price: true,
  vat_rate: true,
  discount_pct: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.invoice_linesSelect;

const invoicePaymentSelect = {
  id: true,
  invoice_id: true,
  transaction_id: true,
  amount: true,
  paid_at: true,
  method: true,
  notes: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.invoice_paymentsSelect;

export class InvoicesService {
  constructor(private readonly prismaClient: PrismaClient) {}

  async createInvoice(input: CreateInvoiceInput): Promise<InvoiceWithItems> {
    const userId = normalizeUserId(input.userId);
    const businessId = normalizeBusinessId(input.businessId);
    await assertUserExists(this.prismaClient, userId);
    const business = await assertBusinessOwnedByUser(this.prismaClient, businessId, userId);

    if (!input.items || input.items.length === 0) {
      throw new Error('At least one invoice item is required');
    }

    const normalizedClientId = normalizeClientId(input.clientId);

    let client = await this.prismaClient.clients.findUnique({
      where: { id: normalizedClientId },
      select: { id: true, business_id: true, name: true },
    });

    if (client && client.business_id !== businessId) {
      client = null as any;
    }

    if (!client) {
      let projectClient = await (this.prismaClient as any).client.findUnique({
        where: { id: normalizedClientId },
        select: {
          id: true,
          business_id: true,
          client_id: true,
          name: true,
          email: true,
          phone: true,
          vat_number: true,
          address: true,
          notes: true,
        },
      });

      if ((!projectClient || projectClient.business_id !== businessId) && input.projectId) {
        const projectId = normalizeProjectId(input.projectId);
        const proj = await this.prismaClient.project.findUnique({
          where: { id: projectId },
          select: { client_id: true, business_id: true, user_id: true },
        });
        if (proj && proj.business_id === businessId && proj.user_id === userId && proj.client_id) {
          projectClient = await (this.prismaClient as any).client.findUnique({
            where: { id: proj.client_id },
            select: {
              id: true,
              business_id: true,
              client_id: true,
              name: true,
              email: true,
              phone: true,
              vat_number: true,
              address: true,
              notes: true,
            },
          });
        }
      }

      if (!projectClient || projectClient.business_id !== businessId) {
        throw new Error('Client not found for this business');
      }

      let targetClientId = projectClient.client_id ?? null;
      if (targetClientId === null) {
        const existingClient = await this.prismaClient.clients.findFirst({
          where: { business_id: businessId, name: projectClient.name },
          select: { id: true },
        });
        if (existingClient) {
          targetClientId = existingClient.id;
        } else {
          const createdClient = await this.prismaClient.clients.create({
            data: {
              business_id: businessId,
              name: projectClient.name,
              email: projectClient.email,
              phone: projectClient.phone,
              vat_number: projectClient.vat_number,
              billing_address: projectClient.address,
              notes: projectClient.notes,
            },
            select: { id: true },
          });
          targetClientId = createdClient.id;
        }
      }

      client = { id: targetClientId, business_id: businessId, name: projectClient.name } as any;
    }

    if (!client || client.business_id !== businessId) {
      throw new Error('Client not found for this business');
    }

    let projectId: bigint | null = null;
    if (input.projectId !== undefined && input.projectId !== null) {
      projectId = normalizeProjectId(input.projectId);
      const project = await this.prismaClient.project.findUnique({
        where: { id: projectId },
        select: { id: true, user_id: true, business_id: true },
      });
      if (!project || project.user_id !== userId || project.business_id !== businessId) {
        throw new Error('Project not found for this business');
      }
    }

    const settings = await this.prismaClient.business_settings.findUnique({
      where: { business_id: businessId },
      select: {
        invoice_prefix: true,
        invoice_next_number: true,
        default_payment_terms_days: true,
      },
    });
    const prefix = settings?.invoice_prefix ?? 'INV-';
    const nextNumber = settings?.invoice_next_number ?? 1;
    const invoiceNumber = `${prefix}${nextNumber}`;

    const paymentTermsDays = settings?.default_payment_terms_days ?? 30;
    const issuedAt = input.issuedAt ?? new Date();
    const dueAt =
      input.dueAt ?? new Date(issuedAt.getTime() + paymentTermsDays * 24 * 60 * 60 * 1000);

    const itemsWithPricing = await this.enrichItemsWithServiceDefaults(
      userId,
      businessId,
      input.items,
    );
    const totals = this.computeTotals(itemsWithPricing);

    const created = await this.prismaClient.$transaction(async (tx) => {
      const invoice = await tx.invoices.create({
        data: {
          business_id: businessId,
          client_id: client.id,
          project_id: projectId,
          quote_id: null,
          invoice_number: invoiceNumber,
          invoice_date: issuedAt,
          due_date: dueAt,
          status: 'issued',
          currency: input.currency ?? business.currency ?? 'EUR',
          payment_terms_days: paymentTermsDays,
          subtotal_ht: totals.subtotal,
          discount_total: totals.discount,
          vat_total: totals.vat,
          total_ht: totals.subtotal.minus(totals.discount),
          total_ttc: totals.total,
          amount_paid_cached: new Prisma.Decimal(0),
          notes: input.notes ?? null,
        },
        select: invoiceSelect,
      });

      await tx.invoice_lines.createMany({
        data: itemsWithPricing.map((item) => ({
          invoice_id: invoice.id,
          service_id: item.serviceId ?? null,
          description: item.description ?? '',
          quantity: new Prisma.Decimal(item.quantity),
          unit: null,
          unit_price: new Prisma.Decimal(item.unitPrice ?? 0),
          vat_rate: new Prisma.Decimal(item.vatRate ?? 0),
          discount_pct: new Prisma.Decimal(0),
        })),
      });

      await tx.business_settings.update({
        where: { business_id: businessId },
        data: { invoice_next_number: nextNumber + 1 },
      });

      const items = await tx.invoice_lines.findMany({
        where: { invoice_id: invoice.id },
        select: invoiceLineSelect,
        orderBy: { id: 'asc' },
      });

      return { invoice, items };
    });

    return created;
  }

  async listInvoicesForBusiness(options: {
    userId: UserId;
    businessId: BusinessId;
  }): Promise<InvoiceWithItems[]> {
    const userId = normalizeUserId(options.userId);
    const businessId = normalizeBusinessId(options.businessId);
    await assertUserExists(this.prismaClient, userId);
    await assertBusinessOwnedByUser(this.prismaClient, businessId, userId);

    const invoices = await this.prismaClient.invoices.findMany({
      where: { business_id: businessId },
      select: invoiceSelect,
      orderBy: { created_at: 'desc' },
    });

    const invoiceIds = invoices.map((inv) => inv.id);
    const lines = await this.prismaClient.invoice_lines.findMany({
      where: { invoice_id: { in: invoiceIds } },
      select: invoiceLineSelect,
      orderBy: [{ invoice_id: 'asc' }, { id: 'asc' }],
    });

    const linesByInvoice = new Map<
      bigint,
      Prisma.invoice_linesGetPayload<{ select: typeof invoiceLineSelect }>[]
    >();
    lines.forEach((line) => {
      const arr = linesByInvoice.get(line.invoice_id) ?? [];
      arr.push(line);
      linesByInvoice.set(line.invoice_id, arr);
    });

    return invoices.map((invoice) => ({
      invoice,
      items: linesByInvoice.get(invoice.id) ?? [],
    }));
  }

  async getInvoiceWithItemsForUser(options: {
    userId: UserId;
    invoiceId: bigint;
  }): Promise<InvoiceWithItemsAndPayments> {
    const userId = normalizeUserId(options.userId);
    await assertUserExists(this.prismaClient, userId);

    const invoice = await this.prismaClient.invoices.findUnique({
      where: { id: options.invoiceId },
      include: {
        invoice_lines: { select: invoiceLineSelect, orderBy: { id: 'asc' } },
        invoice_payments: { select: invoicePaymentSelect, orderBy: { id: 'asc' } },
        businesses: { select: { user_id: true } },
      },
    });

    if (!invoice) {
      throw new InvoiceNotFoundError();
    }

    if (invoice.businesses?.user_id !== userId) {
      throw new InvoiceOwnershipError();
    }

    return {
      invoice,
      items: invoice.invoice_lines,
      payments: invoice.invoice_payments,
    };
  }

  async updateInvoice(options: {
    userId: UserId;
    invoiceId: bigint;
    status?: string;
    dueAt?: Date;
    notes?: string | null;
  }): Promise<InvoiceWithItemsAndPayments> {
    const userId = normalizeUserId(options.userId);
    const invoiceId = BigInt(options.invoiceId);
    await assertUserExists(this.prismaClient, userId);

    const invoice = await this.prismaClient.invoices.findUnique({
      where: { id: invoiceId },
      select: { id: true, businesses: { select: { user_id: true } } },
    });

    if (!invoice) {
      throw new InvoiceNotFoundError();
    }

    if (invoice.businesses?.user_id !== userId) {
      throw new InvoiceOwnershipError();
    }

    const data: Prisma.invoicesUpdateInput = {};
    if (options.status !== undefined) data.status = options.status;
    if (options.dueAt !== undefined) data.due_date = options.dueAt;
    if (options.notes !== undefined) data.notes = options.notes;

    await this.prismaClient.invoices.update({
      where: { id: invoiceId },
      data,
    });

    return this.getInvoiceWithItemsForUser({ userId, invoiceId });
  }

  async deleteInvoice(options: { userId: UserId; invoiceId: bigint }): Promise<void> {
    const userId = normalizeUserId(options.userId);
    const invoiceId = BigInt(options.invoiceId);
    await assertUserExists(this.prismaClient, userId);

    const invoice = await this.prismaClient.invoices.findUnique({
      where: { id: invoiceId },
      select: { id: true, businesses: { select: { user_id: true } } },
    });

    if (!invoice) {
      throw new InvoiceNotFoundError();
    }

    if (invoice.businesses?.user_id !== userId) {
      throw new InvoiceOwnershipError();
    }

    const paymentCount = await this.prismaClient.invoice_payments.count({
      where: { invoice_id: invoiceId },
    });
    if (paymentCount > 0) {
      throw new Error('Cannot delete invoice with payments');
    }

    await this.prismaClient.$transaction(async (tx) => {
      await tx.invoice_lines.deleteMany({ where: { invoice_id: invoiceId } });
      await tx.invoices.delete({ where: { id: invoiceId } });
    });
  }

  private async enrichItemsWithServiceDefaults(
    userId: bigint,
    businessId: bigint,
    items: InvoiceItemInput[],
  ): Promise<Required<InvoiceItemInput>[]> {
    const serviceIds = items
      .map((i) => i.serviceId)
      .filter((id): id is bigint => id !== undefined && id !== null);

    const services = serviceIds.length
      ? await this.prismaClient.services.findMany({
          where: { id: { in: serviceIds }, business_id: businessId },
          select: {
            id: true,
            business_id: true,
            name: true,
            default_price: true,
            default_vat_rate: true,
          },
        })
      : [];

    const map = new Map<bigint, (typeof services)[number]>();
    services.forEach((s) => map.set(s.id, s));

    return items.map((item) => {
      const svc = item.serviceId ? map.get(item.serviceId) : undefined;
      if (item.serviceId && svc) {
        if (svc.business_id !== null && svc.business_id !== businessId) {
          throw new InvoiceOwnershipError('Service not attached to this business');
        }
      }

      const unitPrice = item.unitPrice ?? (svc ? Number(svc.default_price ?? 0) : 0);
      if (!item.description && !svc) {
        throw new Error('Item description is required when service is not provided');
      }

      return {
        serviceId: item.serviceId ?? null,
        description: item.description ?? (svc ? svc.name ?? 'Service' : ''),
        quantity: item.quantity,
        unitPrice,
        vatRate: item.vatRate ?? (svc?.default_vat_rate ? Number(svc.default_vat_rate) : 0),
      };
    });
  }

  private computeTotals(items: Required<InvoiceItemInput>[]) {
    const subtotal = items.reduce(
      (sum, item) => sum.add(new Prisma.Decimal(item.unitPrice).mul(item.quantity)),
      new Prisma.Decimal(0),
    );
    const vat = items.reduce((sum, item) => {
      const rate = item.vatRate ?? 0;
      const line = new Prisma.Decimal(item.unitPrice).mul(item.quantity);
      return sum.add(line.mul(rate).div(100));
    }, new Prisma.Decimal(0));
    const discount = new Prisma.Decimal(0);
    const total = subtotal.minus(discount).add(vat);
    return { subtotal, vat, discount, total };
  }
}

export const invoicesService = new InvoicesService(prisma);
export const invoiceService = invoicesService;
