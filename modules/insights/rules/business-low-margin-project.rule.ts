import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { Insight } from '@/modules/insights/insights.service';
import { normalizeBusinessId, normalizeUserId } from '@/modules/shared/ids';
import { assertBusinessOwnedByUser, assertUserExists } from '@/modules/shared/assertions';

export async function businessLowMarginProjectRule(options: {
  userId: bigint;
  businessId: bigint;
  prismaClient?: PrismaClient;
}): Promise<Insight | null> {
  const client = options.prismaClient ?? prisma;
  const userId = normalizeUserId(options.userId);
  const businessId = normalizeBusinessId(options.businessId);

  await assertUserExists(client, userId);
  await assertBusinessOwnedByUser(client, businessId, userId);

  const projects = await client.project.findMany({
    where: { business_id: businessId },
    select: { id: true, name: true, budget_amount: true },
  });

  if (projects.length === 0) return null;

  const lowMargin: Array<{ projectId: bigint; name: string; marginPct: number }> = [];

  for (const project of projects) {
    const sums = await client.transactions.groupBy({
      by: ['direction'],
      where: { project_id: project.id, user_id: userId },
      _sum: { amount: true },
    });

    const revenue = sums
      .filter((s) => s.direction === 'in')
      .reduce((sum, s) => sum.add(s._sum.amount ?? 0), new Prisma.Decimal(0));
    const costs = sums
      .filter((s) => s.direction === 'out')
      .reduce((sum, s) => sum.add(s._sum.amount ?? 0), new Prisma.Decimal(0));

    if (revenue.eq(0)) continue;

    const marginPct = revenue.minus(costs).div(revenue).mul(100).toNumber();
    if (marginPct < 20) {
      lowMargin.push({ projectId: project.id, name: project.name, marginPct });
    }
  }

  if (lowMargin.length === 0) return null;

  return {
    id: 'business-low-margin-project',
    userId,
    businessId,
    category: 'cashflow',
    severity: 'warning',
    title: 'Projets à faible marge',
    message: 'Certains projets présentent une marge faible.',
    data: {
      businessId,
      projects: lowMargin,
    },
  };
}
