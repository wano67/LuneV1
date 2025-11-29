import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { Insight } from '@/modules/insights/insights.service';
import { normalizeBusinessId, normalizeUserId } from '@/modules/shared/ids';
import { assertBusinessOwnedByUser, assertUserExists } from '@/modules/shared/assertions';

export async function businessLateInvoicesRule(options: {
  userId: bigint;
  businessId: bigint;
  prismaClient?: PrismaClient;
}): Promise<Insight | null> {
  const client = options.prismaClient ?? prisma;
  const userId = normalizeUserId(options.userId);
  const businessId = normalizeBusinessId(options.businessId);

  await assertUserExists(client, userId);
  await assertBusinessOwnedByUser(client, businessId, userId);

  const today = new Date();
  const lateInvoices = await client.invoices.findMany({
    where: {
      business_id: businessId,
      status: { in: ['issued', 'partially_paid'] },
      due_date: { lt: today },
    },
    select: {
      id: true,
      total_ttc: true,
      amount_paid_cached: true,
    },
  });

  if (lateInvoices.length === 0) return null;

  const totalLateAmount = lateInvoices.reduce((sum, inv) => {
    const remaining = new Prisma.Decimal(inv.total_ttc ?? 0).minus(inv.amount_paid_cached ?? 0);
    return sum.add(remaining);
  }, new Prisma.Decimal(0));

  const countLateInvoices = lateInvoices.length;
  const amountNumber = Number(totalLateAmount);
  const severity: Insight['severity'] = countLateInvoices > 3 || amountNumber > 2000 ? 'critical' : 'warning';

  return {
    id: 'business-late-invoices',
    userId,
    businessId,
    category: 'cashflow',
    severity,
    title: 'Factures en retard',
    message: 'Vous avez des factures en retard de paiement.',
    data: {
      businessId,
      countLateInvoices,
      totalLateAmount: amountNumber,
    },
  };
}
