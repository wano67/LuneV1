import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizeBusinessId, normalizeUserId } from '@/modules/shared/ids';
import { assertBusinessOwnedByUser, assertUserExists } from '@/modules/shared/assertions';

type MonthBucket = { year: number; month: number };

function formatMonth({ year, month }: MonthBucket): string {
  const mm = month.toString().padStart(2, '0');
  return `${year}-${mm}`;
}

function addMonths(start: MonthBucket, delta: number): MonthBucket {
  const date = new Date(Date.UTC(start.year, start.month - 1, 1));
  date.setUTCMonth(date.getUTCMonth() + delta);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function getCurrentMonth(): MonthBucket {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

export class ForecastService {
  constructor(private readonly prismaClient: PrismaClient) {}

  // --- Personal Forecast ---
  async computePersonalSavingsForecast(options: {
    userId: bigint;
    horizonMonths: number;
    contributionsPerMonth?: number;
  }): Promise<{
    months: Array<{
      month: string;
      projectedAmount: number;
      goalsProgress: Array<{
        goalId: bigint;
        targetAmount: number;
        projectedAmount: number;
        projectedCompletionDate?: Date;
      }>;
    }>;
  }> {
    const userId = normalizeUserId(options.userId);
    await assertUserExists(this.prismaClient, userId);

    const horizon = Math.max(1, Math.min(options.horizonMonths, 36));
    const startMonth = getCurrentMonth();

    const goals = await this.prismaClient.savings_goals.findMany({
      where: { user_id: userId, status: { in: ['active', 'paused'] } },
      select: { id: true, target_amount: true, current_amount_cached: true, target_date: true },
    });

    const recentSavings = await this.prismaClient.transactions.findMany({
      where: {
        user_id: userId,
        business_id: null,
        direction: 'out',
        category_id: { not: null },
        date: { gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) },
      },
      select: { amount: true, date: true },
    });

    const contributions = this.estimateContributionPerMonth(recentSavings, options.contributionsPerMonth);

    const months: Array<{
      month: string;
      projectedAmount: number;
      goalsProgress: Array<{
        goalId: bigint;
        targetAmount: number;
        projectedAmount: number;
        projectedCompletionDate?: Date;
      }>;
    }> = [];

    let runningTotal = goals.reduce(
      (sum, g) => sum + Number(g.current_amount_cached ?? 0),
      0
    );

    for (let i = 0; i < horizon; i++) {
      const bucket = addMonths(startMonth, i);
      runningTotal += contributions;

      const goalsProgress = goals.map((goal) => {
        const projectedAmount = Math.min(goal.target_amount as any as number, Number(goal.current_amount_cached) + contributions);
        let projectedCompletionDate: Date | undefined;
        if (projectedAmount >= Number(goal.target_amount) && goal.target_date) {
          projectedCompletionDate = new Date(goal.target_date);
        }
        return {
          goalId: goal.id,
          targetAmount: Number(goal.target_amount),
          projectedAmount,
          projectedCompletionDate,
        };
      });

      months.push({
        month: formatMonth(bucket),
        projectedAmount: runningTotal,
        goalsProgress,
      });
    }

    return { months };
  }

  private estimateContributionPerMonth(
    recentSavings: Array<{ amount: Prisma.Decimal; date: Date }>,
    override?: number
  ): number {
    if (override !== undefined) return override;
    if (recentSavings.length === 0) return 0;

    const months = new Map<string, number>();
    for (const tx of recentSavings) {
      const d = new Date(tx.date);
      const key = `${d.getUTCFullYear()}-${(d.getUTCMonth() + 1).toString().padStart(2, '0')}`;
      months.set(key, (months.get(key) ?? 0) + Number(tx.amount));
    }

    const totals = Array.from(months.values());
    const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
    return avg;
  }

  // --- Business Forecast ---
  async computeBusinessForecast(options: {
    userId: bigint;
    businessId: bigint;
    horizonMonths: number;
  }): Promise<{
    months: Array<{ month: string; forecastedRevenue: number; forecastedCosts: number; forecastedMargin: number }>;
    assumptions: {
      recurringExpensesPerMonth: number;
      averageProjectMarginPct: number;
      pipelineWeightedRevenue: number;
    };
  }> {
    const userId = normalizeUserId(options.userId);
    const businessId = normalizeBusinessId(options.businessId);
    await assertUserExists(this.prismaClient, userId);
    await assertBusinessOwnedByUser(this.prismaClient, businessId, userId);

    const horizon = Math.max(1, Math.min(options.horizonMonths, 36));
    const startMonth = getCurrentMonth();

    const projects = await this.prismaClient.project.findMany({
      where: { business_id: businessId },
      select: { id: true, status: true, start_date: true, due_date: true, budget_amount: true },
    });

    const recentOut = await this.prismaClient.transactions.findMany({
      where: { user_id: userId, business_id: businessId, direction: 'out' },
      select: { amount: true, date: true },
    });

    const recurringExpensesPerMonth = this.estimateMonthlyAverage(recentOut, 6);
    const pipelineWeightedRevenue = this.computePipelineWeightedRevenue(projects);
    const averageProjectMarginPct = 50; // simple heuristic placeholder

    const months: Array<{ month: string; forecastedRevenue: number; forecastedCosts: number; forecastedMargin: number }> = [];

    for (let i = 0; i < horizon; i++) {
      const bucket = addMonths(startMonth, i);
      const monthKey = formatMonth(bucket);

      const { revenue, costs } = this.forecastFromProjects(projects, bucket, recurringExpensesPerMonth);
      months.push({
        month: monthKey,
        forecastedRevenue: revenue,
        forecastedCosts: costs,
        forecastedMargin: revenue - costs,
      });
    }

    return {
      months,
      assumptions: {
        recurringExpensesPerMonth,
        averageProjectMarginPct,
        pipelineWeightedRevenue,
      },
    };
  }

  private estimateMonthlyAverage(transactions: Array<{ amount: Prisma.Decimal; date: Date }>, monthsBack: number): number {
    const cutoff = new Date();
    cutoff.setUTCMonth(cutoff.getUTCMonth() - monthsBack);
    const recent = transactions.filter((tx) => tx.date >= cutoff);
    if (recent.length === 0) return 0;

    const buckets = new Map<string, number>();
    for (const tx of recent) {
      const d = new Date(tx.date);
      const key = `${d.getUTCFullYear()}-${(d.getUTCMonth() + 1).toString().padStart(2, '0')}`;
      buckets.set(key, (buckets.get(key) ?? 0) + Number(tx.amount));
    }

    const totals = Array.from(buckets.values());
    return totals.reduce((a, b) => a + b, 0) / totals.length;
  }

  private computePipelineWeightedRevenue(projects: Array<{ status: string; budget_amount: Prisma.Decimal | null }>): number {
    const weights: Record<string, number> = {
      prospecting: 0.2,
      quote_sent: 0.4,
      planned: 0.6,
      in_progress: 0.8,
      completed: 1,
    };

    return projects.reduce((sum, p) => {
      const weight = weights[p.status] ?? 0.3;
      const budget = p.budget_amount ? Number(p.budget_amount) : 0;
      return sum + budget * weight;
    }, 0);
  }

  private forecastFromProjects(
    projects: Array<{ start_date: Date | null; due_date: Date | null; budget_amount: Prisma.Decimal | null }>,
    bucket: MonthBucket,
    recurringCosts: number
  ) {
    const revenue = projects.reduce((sum, p) => {
      if (!p.budget_amount) return sum;
      const start = p.start_date ? new Date(p.start_date) : null;
      const end = p.due_date ? new Date(p.due_date) : null;
      if (!start || !end) return sum;

      const bucketDate = new Date(Date.UTC(bucket.year, bucket.month - 1, 1));
      if (bucketDate >= start && bucketDate <= end) {
        const months = Math.max(
          1,
          (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth() + 1)
        );
        return sum + Number(p.budget_amount) / months;
      }
      return sum;
    }, 0);

    const costs = recurringCosts;
    return { revenue, costs };
  }
}

export const forecastService = new ForecastService(prisma);
