import { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizeUserId } from '@/modules/shared/ids';
import { assertUserExists } from '@/modules/shared/assertions';

type MonthlyBucket = {
  month: string;
  income: number;
  spending: number;
};

export class PersonalInsightsSeasonalityService {
  constructor(private readonly prismaClient: PrismaClient) {}

  private monthKey(date: Date): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  private addMonths(date: Date, delta: number): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1, 0, 0, 0, 0));
  }

  async getSeasonality(options: { userId: bigint; months?: number }) {
    const userId = normalizeUserId(options.userId);
    await assertUserExists(this.prismaClient, userId);

    const months = options.months && options.months > 0 ? options.months : 12;
    const now = new Date();
    const startMonth = this.addMonths(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), -months + 1);

    const transactions = await this.prismaClient.transactions.findMany({
      where: {
        user_id: userId,
        business_id: null,
        date: { gte: startMonth },
      },
      select: { date: true, amount: true, direction: true },
      orderBy: { date: 'asc' },
    });

    const buckets = new Map<string, MonthlyBucket>();

    // Initialize buckets to ensure continuous months
    for (let i = 0; i < months; i++) {
      const d = this.addMonths(startMonth, i);
      buckets.set(this.monthKey(d), { month: this.monthKey(d), income: 0, spending: 0 });
    }

    for (const tx of transactions) {
      const key = this.monthKey(tx.date);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      const amt = Number(tx.amount ?? 0);
      if (tx.direction === 'in') bucket.income += amt;
      else if (tx.direction === 'out') bucket.spending += amt;
    }

    const points = Array.from(buckets.values()).map((b) => ({
      ...b,
      net: b.income - b.spending,
    }));

    const nets = points.map((p) => p.net);
    const mean = nets.reduce((sum, v) => sum + v, 0) / (nets.length || 1);
    const variance =
      nets.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (nets.length > 1 ? nets.length - 1 : 1);
    const stddev = Math.sqrt(variance);

    const enriched = points.map((p) => {
      const z = stddev > 0 ? (p.net - mean) / stddev : 0;
      const isAnomaly = Math.abs(z) >= 2;
      return { ...p, zScore: z, isAnomaly };
    });

    return {
      periodMonths: months,
      currency: 'EUR',
      points: enriched,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const personalInsightsSeasonalityService = new PersonalInsightsSeasonalityService(prisma);
