import { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizeUserId } from '@/modules/shared/ids';
import { assertUserExists } from '@/modules/shared/assertions';

const decimalToNumber = (value: any): number => {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value.toNumber === 'function') return value.toNumber();
  return Number(value);
};

const computeSigned = (tx: any): number => {
  const amount = decimalToNumber(tx.amount);
  return tx.direction === 'in' ? amount : -amount;
};

export class PersonalSavingsPlanService {
  constructor(private readonly prismaClient: PrismaClient) {}

  private startOfMonth(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
  }

  private addMonths(date: Date, delta: number): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1, 0, 0, 0, 0));
  }

  private monthKey(date: Date): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  async getSavingsPlan(
    userIdInput: bigint,
    options: { targetAmount: number; targetDate: Date; currentSavingsOverride?: number }
  ) {
    const userId = normalizeUserId(userIdInput);
    await assertUserExists(this.prismaClient, userId);

    const accounts = await this.prismaClient.accounts.findMany({
      where: { user_id: userId, business_id: null, is_active: true },
      select: { id: true, currency: true },
    });

    const accountIds = accounts.map((a) => a.id);
    const baseCurrency = accounts[0]?.currency ?? 'EUR';

    const transactions = await this.prismaClient.transactions.findMany({
      where: {
        user_id: userId,
        business_id: null,
        account_id: { in: accountIds.length ? accountIds : [BigInt(0)] },
      },
      select: {
        id: true,
        amount: true,
        direction: true,
        date: true,
      },
      orderBy: { date: 'asc' },
    });

    let currentBalance = 0;
    for (const tx of transactions) {
      currentBalance += computeSigned(tx);
    }

    const today = new Date();
    const threeMonthsAgoStart = this.addMonths(this.startOfMonth(today), -3);
    const monthBuckets = new Map<string, { income: number; spending: number }>();

    for (const tx of transactions) {
      if (tx.date < threeMonthsAgoStart || tx.date >= this.startOfMonth(this.addMonths(today, 1))) {
        continue;
      }
      const key = this.monthKey(tx.date);
      const bucket = monthBuckets.get(key) ?? { income: 0, spending: 0 };
      const amt = decimalToNumber(tx.amount);
      if (tx.direction === 'in') bucket.income += amt;
      else bucket.spending += amt;
      monthBuckets.set(key, bucket);
    }

    const bucketsArr = Array.from(monthBuckets.values());
    const monthsCount = bucketsArr.length || 1;
    const totalIncome = bucketsArr.reduce((sum, b) => sum + b.income, 0);
    const totalSpending = bucketsArr.reduce((sum, b) => sum + b.spending, 0);
    const estimatedMonthlyIncome = totalIncome / monthsCount;
    const estimatedMonthlySpending = totalSpending / monthsCount;
    const estimatedSavingsCapacity = estimatedMonthlyIncome - estimatedMonthlySpending;

    const targetDate = options.targetDate;
    const targetAmount = options.targetAmount;
    const effectiveCurrentSavings = options.currentSavingsOverride ?? currentBalance;

    const todayDateOnly = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0));
    const monthsRemaining = Math.max(
      1,
      (targetDate.getUTCFullYear() - todayDateOnly.getUTCFullYear()) * 12 +
        (targetDate.getUTCMonth() - todayDateOnly.getUTCMonth())
    );
    const daysRemaining = Math.max(
      1,
      Math.ceil((targetDate.getTime() - todayDateOnly.getTime()) / (1000 * 60 * 60 * 24))
    );

    const remaining = Math.max(targetAmount - effectiveCurrentSavings, 0);
    const requiredMonthlySavings = monthsRemaining > 0 ? remaining / monthsRemaining : remaining;
    const requiredDailySavings = daysRemaining > 0 ? remaining / daysRemaining : remaining;
    const requiredSavingsRate = estimatedMonthlyIncome > 0 ? requiredMonthlySavings / estimatedMonthlyIncome : 0;

    let status: 'on_track' | 'stretch' | 'unrealistic' = 'on_track';
    if (estimatedSavingsCapacity <= 0 && remaining > 0) {
      status = 'unrealistic';
    } else {
      const cap = estimatedSavingsCapacity;
      if (requiredMonthlySavings <= cap * 0.8) status = 'on_track';
      else if (requiredMonthlySavings <= cap * 1.2) status = 'stretch';
      else status = 'unrealistic';
    }

    const notes: string[] = [];
    if (status === 'on_track') {
      notes.push('Your goal looks achievable with your current savings capacity.');
    } else if (status === 'stretch') {
      notes.push('Goal is ambitious; consider trimming spending or boosting income slightly.');
    } else {
      notes.push('Current cashflow seems insufficient; consider extending timeline or increasing income.');
    }
    if (estimatedSavingsCapacity <= 0) {
      notes.push('No positive savings capacity detected in recent months.');
    }

    return {
      baseCurrency,
      targetAmount,
      targetDate: targetDate.toISOString(),
      today: todayDateOnly.toISOString(),
      monthsRemaining,
      daysRemaining,
      estimatedMonthlyIncome,
      estimatedMonthlySpending,
      estimatedSavingsCapacity,
      currentBalance,
      effectiveCurrentSavings,
      requiredMonthlySavings,
      requiredDailySavings,
      requiredSavingsRate,
      status,
      notes,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const personalSavingsPlanService = new PersonalSavingsPlanService(prisma);
