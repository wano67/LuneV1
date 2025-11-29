import { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { Insight } from '@/modules/insights/insights.service';
import { normalizeBusinessId, normalizeUserId } from '@/modules/shared/ids';
import { assertBusinessOwnedByUser, assertUserExists } from '@/modules/shared/assertions';

export async function businessUnderTargetRevenueRule(options: {
  userId: bigint;
  businessId: bigint;
  year: number;
  month: number;
  prismaClient?: PrismaClient;
}): Promise<Insight | null> {
  const client = options.prismaClient ?? prisma;
  const userId = normalizeUserId(options.userId);
  const businessId = normalizeBusinessId(options.businessId);

  await assertUserExists(client, userId);
  const business = await assertBusinessOwnedByUser(client, businessId, userId);
  const settings = await client.business_settings.findUnique({
    where: { business_id: businessId },
    select: { monthly_revenue_goal: true },
  });

  const goalDecimal = settings?.monthly_revenue_goal;
  if (!goalDecimal) return null;

  const goal = Number(goalDecimal);
  if (goal <= 0) return null;

  const monthStart = new Date(Date.UTC(options.year, options.month - 1, 1));
  const monthEnd = new Date(Date.UTC(options.year, options.month, 0, 23, 59, 59, 999));

  const revenueAgg = await client.transactions.aggregate({
    _sum: { amount: true },
    where: {
      user_id: userId,
      business_id: business.id,
      direction: 'in',
      date: { gte: monthStart, lte: monthEnd },
    },
  });

  const actual = Number(revenueAgg._sum.amount ?? 0);
  if (actual >= goal) return null;

  const gap = goal - actual;
  const gapPct = (gap / goal) * 100;
  const severity: Insight['severity'] = gapPct > 20 ? 'warning' : 'info';

  return {
    id: 'business-under-target-revenue',
    userId,
    businessId,
    category: 'cashflow',
    severity,
    title: 'Chiffre d’affaires sous l’objectif',
    message: 'Votre chiffre d’affaires est en-dessous de l’objectif ce mois-ci.',
    data: {
      businessId,
      year: options.year,
      month: options.month,
      goal,
      actual,
      gap,
    },
  };
}
