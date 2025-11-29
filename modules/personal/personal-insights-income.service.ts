import { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizeUserId } from '@/modules/shared/ids';
import { assertUserExists } from '@/modules/shared/assertions';

const parseDate = (value?: string): Date | undefined => {
  if (!value) return undefined;
  return new Date(`${value}T00:00:00.000Z`);
};

export class PersonalInsightsIncomeService {
  constructor(private readonly prismaClient: PrismaClient) {}

  private defaultRange() {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    return { start, end };
  }

  async incomeSources(options: { userId: bigint; from?: string; to?: string }) {
    const userId = normalizeUserId(options.userId);
    await assertUserExists(this.prismaClient, userId);

    const { start: defaultFrom, end: defaultTo } = this.defaultRange();
    const from = parseDate(options.from) ?? defaultFrom;
    const to = parseDate(options.to) ?? defaultTo;

    const transactions = await this.prismaClient.transactions.findMany({
      where: {
        user_id: userId,
        business_id: null,
        direction: 'in',
        date: { gte: from, lte: to },
      },
      select: {
        id: true,
        amount: true,
        raw_label: true,
        type: true,
        income_sources: {
          select: { name: true, type: true },
        },
      },
    });

    let totalIncome = 0;
    const buckets = new Map<string, { total: number; count: number; tag: string | null }>();

    for (const tx of transactions) {
      const amount = Number(tx.amount ?? 0);
      totalIncome += amount;
      const sourceName =
        tx.income_sources?.name ??
        (tx.type ? tx.type : tx.raw_label ?? 'Other income');
      const tag = tx.income_sources?.type ?? null;
      const key = sourceName || 'Other income';
      const bucket = buckets.get(key) ?? { total: 0, count: 0, tag };
      bucket.total += amount;
      bucket.count += 1;
      bucket.tag = bucket.tag ?? tag;
      buckets.set(key, bucket);
    }

    const sources = Array.from(buckets.entries()).map(([source, data]) => ({
      source,
      total: data.total,
      transactionCount: data.count,
      shareOfIncome: totalIncome > 0 ? data.total / totalIncome : 0,
      tag: data.tag,
    }));

    sources.sort((a, b) => b.total - a.total);
    const topSource = sources.length > 0 ? sources[0].source : null;

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      currency: 'EUR',
      sources,
      topSource,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const personalInsightsIncomeService = new PersonalInsightsIncomeService(prisma);
