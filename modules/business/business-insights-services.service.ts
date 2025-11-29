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

export class BusinessInsightsServicesService {
  constructor(private readonly prismaClient: PrismaClient) {}

  private defaultFrom(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  }

  async getTopServices(options: { userId: bigint; businessId: bigint; from?: Date; to?: Date }) {
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
        project_id: true,
        invoice_date: true,
        total_ttc: true,
        amount_paid_cached: true,
        invoice_lines: {
          select: {
            service_id: true,
            description: true,
            quantity: true,
            unit_price: true,
            created_at: true,
          },
        },
      },
      orderBy: { invoice_date: 'desc' },
    });

    const serviceIds = new Set<bigint>();
    invoices.forEach((inv) => {
      inv.invoice_lines.forEach((l) => {
        if (l.service_id) serviceIds.add(l.service_id);
      });
    });

    const services = serviceIds.size
      ? await this.prismaClient.services.findMany({
          where: { id: { in: Array.from(serviceIds) } },
          select: { id: true, name: true },
        })
      : [];
    const serviceNames = new Map<bigint, string>();
    services.forEach((s) => serviceNames.set(s.id, s.name));

    type Agg = {
      totalInvoiced: number;
      totalPaid: number;
      invoiceCount: number;
      projectIds: Set<bigint>;
      lastActivity: Date | null;
      name: string;
      priceSum: number;
      lineCount: number;
    };
    const agg = new Map<string, Agg>();

    for (const inv of invoices) {
      const invoiceTotal = decimalToNumber(inv.total_ttc);
      const invoicePaid = decimalToNumber(inv.amount_paid_cached);

      for (const line of inv.invoice_lines) {
        const lineSubtotal = decimalToNumber(line.unit_price) * decimalToNumber(line.quantity);
        const serviceKey = line.service_id ? line.service_id.toString() : 'unknown';

        if (!agg.has(serviceKey)) {
          const name = line.service_id && serviceNames.get(line.service_id)
            ? serviceNames.get(line.service_id)!
            : line.description || 'Service';
          agg.set(serviceKey, {
            totalInvoiced: 0,
            totalPaid: 0,
            invoiceCount: 0,
            projectIds: new Set<bigint>(),
            lastActivity: null,
            name,
            priceSum: 0,
            lineCount: 0,
          });
        }

        const bucket = agg.get(serviceKey)!;
        bucket.totalInvoiced += lineSubtotal;
        bucket.priceSum += decimalToNumber(line.unit_price);
        bucket.lineCount += 1;
        bucket.invoiceCount += 1;
        if (inv.project_id) bucket.projectIds.add(inv.project_id);
        if (!bucket.lastActivity || inv.invoice_date > bucket.lastActivity) {
          bucket.lastActivity = inv.invoice_date;
        }

        if (invoiceTotal > 0 && invoicePaid > 0) {
          const share = lineSubtotal / invoiceTotal;
          bucket.totalPaid += invoicePaid * share;
        }
      }
    }

    const topServices = Array.from(agg.entries())
      .map(([serviceId, data]) => ({
        serviceId,
        name: data.name,
        totalInvoiced: data.totalInvoiced,
        totalPaid: data.totalPaid,
        projectCount: data.projectIds.size,
        averagePrice: data.lineCount > 0 ? data.priceSum / data.lineCount : 0,
        lastActivityAt: data.lastActivity ? data.lastActivity.toISOString() : null,
      }))
      .sort((a, b) => b.totalPaid - a.totalPaid || b.totalInvoiced - a.totalInvoiced)
      .slice(0, 5)
      .map((item) => ({
        ...item,
        serviceId: item.serviceId.toString(),
      }));

    return {
      businessId: businessId.toString(),
      currency: business.currency ?? 'EUR',
      period: { from: from.toISOString(), to: to.toISOString() },
      topServices,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const businessInsightsServicesService = new BusinessInsightsServicesService(prisma);
