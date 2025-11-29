import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizeBusinessId, normalizeUserId } from '@/modules/shared/ids';
import { assertBusinessOwnedByUser, assertUserExists } from '@/modules/shared/assertions';
import { BudgetNotFoundError, BudgetOwnershipError } from '@/modules/shared/errors';

const businessBudgetSelect = {
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

export type BusinessBudgetSummary = Prisma.budgetsGetPayload<{
  select: typeof businessBudgetSelect;
}>;

export class BusinessBudgetsService {
  constructor(private readonly prismaClient: PrismaClient) {}

  async listForBusiness(userIdInput: bigint, businessIdInput: bigint) {
    const userId = normalizeUserId(userIdInput);
    const businessId = normalizeBusinessId(businessIdInput);

    await assertUserExists(this.prismaClient, userId);
    await assertBusinessOwnedByUser(this.prismaClient, businessId, userId);

    return this.prismaClient.budgets.findMany({
      where: { user_id: userId, business_id: businessId },
      select: businessBudgetSelect,
      orderBy: { start_date: 'asc' },
    });
  }

  async createForBusiness(input: {
    userId: bigint;
    businessId: bigint;
    name: string;
    currency: string;
    amount: number;
    periodStart: Date;
    periodEnd: Date;
  }) {
    const userId = normalizeUserId(input.userId);
    const businessId = normalizeBusinessId(input.businessId);

    await assertUserExists(this.prismaClient, userId);
    await assertBusinessOwnedByUser(this.prismaClient, businessId, userId);

    const created = await this.prismaClient.budgets.create({
      data: {
        user_id: userId,
        business_id: businessId,
        name: input.name,
        currency: input.currency,
        total_spending_limit: new Prisma.Decimal(input.amount),
        start_date: input.periodStart,
        end_date: input.periodEnd,
        period_type: 'custom',
        scenario: 'base',
        status: 'active',
      },
      select: businessBudgetSelect,
    });

    return created;
  }

  async getForBusiness(budgetIdInput: bigint, userIdInput: bigint, businessIdInput: bigint) {
    const userId = normalizeUserId(userIdInput);
    const businessId = normalizeBusinessId(businessIdInput);

    await assertUserExists(this.prismaClient, userId);
    await assertBusinessOwnedByUser(this.prismaClient, businessId, userId);

    const budgetId = BigInt(budgetIdInput);

    const budget = await this.prismaClient.budgets.findUnique({
      where: { id: budgetId },
      select: businessBudgetSelect,
    });

    if (!budget) {
      throw new BudgetNotFoundError();
    }
    if (budget.user_id !== userId || budget.business_id !== businessId) {
      throw new BudgetOwnershipError();
    }

    return budget;
  }

  async updateForBusiness(
    budgetIdInput: bigint,
    userIdInput: bigint,
    businessIdInput: bigint,
    updates: {
      name?: string;
      currency?: string;
      amount?: number;
      periodStart?: Date;
      periodEnd?: Date;
    },
  ) {
    const userId = normalizeUserId(userIdInput);
    const businessId = normalizeBusinessId(businessIdInput);

    await assertUserExists(this.prismaClient, userId);
    await assertBusinessOwnedByUser(this.prismaClient, businessId, userId);

    const budgetId = BigInt(budgetIdInput);

    const existing = await this.prismaClient.budgets.findUnique({
      where: { id: budgetId },
      select: businessBudgetSelect,
    });

    if (!existing) {
      throw new BudgetNotFoundError();
    }
    if (existing.user_id !== userId || existing.business_id !== businessId) {
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
      select: businessBudgetSelect,
    });

    return updated;
  }

  async deleteForBusiness(
    budgetIdInput: bigint,
    userIdInput: bigint,
    businessIdInput: bigint,
  ): Promise<void> {
    const userId = normalizeUserId(userIdInput);
    const businessId = normalizeBusinessId(businessIdInput);

    await assertUserExists(this.prismaClient, userId);
    await assertBusinessOwnedByUser(this.prismaClient, businessId, userId);

    const budgetId = BigInt(budgetIdInput);

    const existing = await this.prismaClient.budgets.findUnique({
      where: { id: budgetId },
      select: businessBudgetSelect,
    });

    if (!existing) {
      throw new BudgetNotFoundError();
    }
    if (existing.user_id !== userId || existing.business_id !== businessId) {
      throw new BudgetOwnershipError();
    }

    await this.prismaClient.budgets.delete({ where: { id: budgetId } });
  }
}

export const businessBudgetsService = new BusinessBudgetsService(prisma);
