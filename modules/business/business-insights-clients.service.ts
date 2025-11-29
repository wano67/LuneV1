import { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizeBusinessId, normalizeUserId } from '@/modules/shared/ids';
import { assertBusinessOwnedByUser, assertUserExists } from '@/modules/shared/assertions';

const decimalToNumber = (value: any): number => {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value.toNumber === 'function') return value.toNumber();
  return Number(value);
};

export class BusinessInsightsClientsService {
  constructor(private readonly prismaClient: PrismaClient) {}

  private defaultFrom(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  }

  private toDateOnly(value?: string): Date | undefined {
    if (!value) return undefined;
    return new Date(`${value}T00:00:00.000Z`);
  }

  async getTopClients(options: { userId: bigint; businessId: bigint; from?: Date; to?: Date }) {
    const userId = normalizeUserId(options.userId);
    const businessId = normalizeBusinessId(options.businessId);
    const from = options.from ?? this.defaultFrom();
    const to = options.to ?? new Date();

    await assertUserExists(this.prismaClient, userId);
    const business = await assertBusinessOwnedByUser(this.prismaClient, businessId, userId);

    const invoices = await this.prismaClient.invoices.findMany({
      where: {
        business_id: businessId,
        invoice_date: { gte: from, lte: to },
      },
      select: {
        id: true,
        client_id: true,
        project_id: true,
        invoice_date: true,
        total_ttc: true,
        invoice_payments: {
          select: { amount: true, paid_at: true },
          where: { paid_at: { gte: from, lte: to } },
        },
      },
      orderBy: { invoice_date: 'desc' },
    });

    const clientIds = Array.from(new Set(invoices.map((inv) => inv.client_id).filter((id): id is bigint => id != null)));

    const clients = clientIds.length
      ? await this.prismaClient.clients.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, name: true },
        })
      : [];
    const clientNames = new Map<bigint, string>();
    clients.forEach((c) => clientNames.set(c.id, c.name));

    type Agg = {
      totalInvoiced: number;
      totalPaid: number;
      invoiceCount: number;
      projectIds: Set<bigint>;
      lastActivity: Date | null;
      name: string;
    };
    const agg = new Map<bigint | null, Agg>();

    for (const inv of invoices) {
      const key = inv.client_id ?? null;
      if (!agg.has(key)) {
        const displayName = key && clientNames.get(key) ? clientNames.get(key)! : 'Unknown client';
        agg.set(key, {
          totalInvoiced: 0,
          totalPaid: 0,
          invoiceCount: 0,
          projectIds: new Set<bigint>(),
          lastActivity: null,
          name: displayName,
        });
      }
      const bucket = agg.get(key)!;
      bucket.totalInvoiced += decimalToNumber(inv.total_ttc);
      bucket.invoiceCount += 1;
      if (inv.project_id) bucket.projectIds.add(inv.project_id);
      if (!bucket.lastActivity || inv.invoice_date > bucket.lastActivity) {
        bucket.lastActivity = inv.invoice_date;
      }

      for (const pay of inv.invoice_payments) {
        bucket.totalPaid += decimalToNumber(pay.amount);
        if (!bucket.lastActivity || (pay.paid_at && pay.paid_at > bucket.lastActivity)) {
          bucket.lastActivity = pay.paid_at ?? bucket.lastActivity;
        }
      }
    }

    const topClients = Array.from(agg.entries())
      .map(([clientId, data]) => ({
        clientId: clientId ? clientId.toString() : 'unknown',
        name: data.name,
        totalInvoiced: data.totalInvoiced,
        totalPaid: data.totalPaid,
        projectCount: data.projectIds.size,
        averageInvoice: data.invoiceCount > 0 ? data.totalInvoiced / data.invoiceCount : 0,
        lastActivityAt: data.lastActivity ? data.lastActivity.toISOString() : null,
      }))
      .sort((a, b) => b.totalPaid - a.totalPaid || b.totalInvoiced - a.totalInvoiced)
      .slice(0, 5);

    return {
      businessId: businessId.toString(),
      currency: business.currency ?? 'EUR',
      period: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      topClients,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const businessInsightsClientsService = new BusinessInsightsClientsService(prisma);
