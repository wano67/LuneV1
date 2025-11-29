import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizeUserId } from '@/modules/shared/ids';
import { assertUserExists } from '@/modules/shared/assertions';
import { BudgetNotFoundError, BudgetOwnershipError } from '@/modules/shared/errors';

const personalBudgetSelect = {
  id: true,
  user_id: true,
  business_id: true,
  name: true,
  currency: true,
  total_spending_limit: true,
  start_date: true,
  end_date: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.budgetsSelect;

export type PersonalBudgetSummary = Prisma.budgetsGetPayload<{
  select: typeof personalBudgetSelect;
}>;

export class PersonalBudgetsService {
  constructor(private readonly prismaClient: PrismaClient) {}

  async listForUser(userIdInput: bigint) {
    const userId = normalizeUserId(userIdInput);
    await assertUserExists(this.prismaClient, userId);

    return this.prismaClient.budgets.findMany({
      where: { user_id: userId, business_id: null },
      select: personalBudgetSelect,
      orderBy: { start_date: 'asc' },
    });
  }

  async createForUser(input: {
    userId: bigint;
    name: string;
    currency: string;
    amount: number;
    periodStart: Date;
    periodEnd: Date;
  }) {
    const userId = normalizeUserId(input.userId);
    await assertUserExists(this.prismaClient, userId);

    const created = await this.prismaClient.budgets.create({
      data: {
        user_id: userId,
        business_id: null,
        name: input.name,
        currency: input.currency,
        total_spending_limit: new Prisma.Decimal(input.amount),
        start_date: input.periodStart,
        end_date: input.periodEnd,
        period_type: 'custom',
        scenario: 'base',
        status: 'active',
      },
      select: personalBudgetSelect,
    });

    return created;
  }

  async getForUser(budgetIdInput: bigint, userIdInput: bigint) {
    const userId = normalizeUserId(userIdInput);
    await assertUserExists(this.prismaClient, userId);
    const budgetId = BigInt(budgetIdInput);

    const budget = await this.prismaClient.budgets.findUnique({
      where: { id: budgetId },
      select: personalBudgetSelect,
    });

    if (!budget) {
      throw new BudgetNotFoundError();
    }
    if (budget.user_id !== userId || budget.business_id !== null) {
      throw new BudgetOwnershipError();
    }

    return budget;
  }

  async updateForUser(
    budgetIdInput: bigint,
    userIdInput: bigint,
    updates: {
      name?: string;
      currency?: string;
      amount?: number;
      periodStart?: Date;
      periodEnd?: Date;
    },
  ) {
    const userId = normalizeUserId(userIdInput);
    await assertUserExists(this.prismaClient, userId);
    const budgetId = BigInt(budgetIdInput);

    const existing = await this.prismaClient.budgets.findUnique({
      where: { id: budgetId },
      select: personalBudgetSelect,
    });

    if (!existing) {
      throw new BudgetNotFoundError();
    }
    if (existing.user_id !== userId || existing.business_id !== null) {
      throw new BudgetOwnershipError();
    }

    const data: Prisma.budgetsUpdateInput = {};
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.currency !== undefined) data.currency = updates.currency;
    if (updates.amount !== undefined) data.total_spending_limit = new Prisma.Decimal(updates.amount);
    if (updates.periodStart !== undefined) data.start_date = updates.periodStart;
    if (updates.periodEnd !== undefined) data.end_date = updates.periodEnd;

    const updated = await this.prismaClient.budgets.update({
      where: { id: budgetId },
      data,
      select: personalBudgetSelect,
    });

    return updated;
  }

  async deleteForUser(budgetIdInput: bigint, userIdInput: bigint): Promise<void> {
    const userId = normalizeUserId(userIdInput);
    await assertUserExists(this.prismaClient, userId);
    const budgetId = BigInt(budgetIdInput);

    const existing = await this.prismaClient.budgets.findUnique({
      where: { id: budgetId },
      select: personalBudgetSelect,
    });

    if (!existing) {
      throw new BudgetNotFoundError();
    }
    if (existing.user_id !== userId || existing.business_id !== null) {
      throw new BudgetOwnershipError();
    }

    await this.prismaClient.budgets.delete({ where: { id: budgetId } });
  }
}

export const personalBudgetsService = new PersonalBudgetsService(prisma);
