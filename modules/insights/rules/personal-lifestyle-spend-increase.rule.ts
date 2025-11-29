import { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { Insight } from '@/modules/insights/insights.service';
import { normalizeUserId } from '@/modules/shared/ids';
import { assertUserExists } from '@/modules/shared/assertions';

export async function personalLifestyleSpendIncreaseRule(options: {
  userId: bigint;
  year: number;
  month: number;
  prismaClient?: PrismaClient;
}): Promise<Insight | null> {
  const client = options.prismaClient ?? prisma;
  const userId = normalizeUserId(options.userId);
  await assertUserExists(client, userId);

  const monthStart = new Date(Date.UTC(options.year, options.month - 1, 1));
  const monthEnd = new Date(Date.UTC(options.year, options.month, 0, 23, 59, 59, 999));

  const lifestyleCategories = await client.categories.findMany({
    where: {
      user_id: userId,
      type: 'expense',
      name: {
        in: [],
      },
      OR: [
        { name: { contains: 'loisir', mode: 'insensitive' } },
        { name: { contains: 'resto', mode: 'insensitive' } },
        { name: { contains: 'restaurant', mode: 'insensitive' } },
        { name: { contains: 'sortie', mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true },
  });

  const categoryIds = lifestyleCategories.map((c) => c.id);
  if (categoryIds.length === 0) return null;

  const current = await client.transactions.aggregate({
    _sum: { amount: true },
    where: {
      user_id: userId,
      business_id: null,
      direction: 'out',
      category_id: { in: categoryIds },
      date: { gte: monthStart, lte: monthEnd },
    },
  });
  const currentAmount = Number(current._sum.amount ?? 0);

  const pastMonthsStart = new Date(Date.UTC(options.year, options.month - 4, 1));
  const pastMonthsEnd = new Date(Date.UTC(options.year, options.month - 1, 0, 23, 59, 59, 999));

  const past = await client.transactions.findMany({
    where: {
      user_id: userId,
      business_id: null,
      direction: 'out',
      category_id: { in: categoryIds },
      date: { gte: pastMonthsStart, lte: pastMonthsEnd },
    },
    select: { amount: true, date: true },
  });

  const bucket = new Map<string, number>();
  for (const tx of past) {
    const d = new Date(tx.date);
    const key = `${d.getUTCFullYear()}-${(d.getUTCMonth() + 1).toString().padStart(2, '0')}`;
    bucket.set(key, (bucket.get(key) ?? 0) + Number(tx.amount));
  }

  const history = Array.from(bucket.values());
  if (history.length < 2) return null;

  const avg = history.reduce((a, b) => a + b, 0) / history.length;
  if (avg === 0) return null;

  const increasePct = ((currentAmount - avg) / avg) * 100;
  if (increasePct <= 20) return null;

  const severity: Insight['severity'] = increasePct > 50 ? 'critical' : 'warning';

  return {
    id: 'personal-lifestyle-spend-increase',
    userId,
    businessId: null,
    category: 'spending',
    severity,
    title: 'Hausse des dépenses loisirs/restaurants',
    message: 'Vos dépenses loisirs/restaurants ont fortement augmenté ce mois-ci.',
    data: {
      year: options.year,
      month: options.month,
      categories: lifestyleCategories.map((c) => c.name),
      currentAmount,
      previousAvg: avg,
      increasePct,
    },
  };
}
