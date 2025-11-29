import { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizeUserId } from '@/modules/shared/ids';
import { assertUserExists } from '@/modules/shared/assertions';

const parseDate = (value?: string): Date | undefined => {
  if (!value) return undefined;
  return new Date(`${value}T00:00:00.000Z`);
};

export class PersonalInsightsSpendingService {
  constructor(private readonly prismaClient: PrismaClient) {}

  private defaultRange() {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    return { start, end };
  }

  async spendingByCategory(options: { userId: bigint; from?: string; to?: string }) {
    const userId = normalizeUserId(options.userId);
    await assertUserExists(this.prismaClient, userId);

    const { start: defaultFrom, end: defaultTo } = this.defaultRange();
    const from = parseDate(options.from) ?? defaultFrom;
    const to = parseDate(options.to) ?? defaultTo;

    const transactions = await this.prismaClient.transactions.findMany({
      where: {
        user_id: userId,
        business_id: null,
        direction: 'out',
        date: { gte: from, lte: to },
      },
      select: {
        id: true,
        amount: true,
        raw_label: true,
        categories: {
          select: { name: true },
        },
      },
    });

    let totalSpending = 0;
    const buckets = new Map<string, { total: number; count: number }>();

    for (const tx of transactions) {
      const amount = Number(tx.amount ?? 0);
      totalSpending += amount;
      const key = tx.categories?.name ?? 'Uncategorized';
      const bucket = buckets.get(key) ?? { total: 0, count: 0 };
      bucket.total += amount;
      bucket.count += 1;
      buckets.set(key, bucket);
    }

    const categories = Array.from(buckets.entries()).map(([category, data]) => ({
      category,
      total: data.total,
      transactionCount: data.count,
      shareOfSpending: totalSpending > 0 ? data.total / totalSpending : 0,
    }));

    categories.sort((a, b) => b.total - a.total);
    const topCategory = categories.length > 0 ? categories[0].category : null;

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      currency: 'EUR',
      categories,
      topCategory,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const personalInsightsSpendingService = new PersonalInsightsSpendingService(prisma);
