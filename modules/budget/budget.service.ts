import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  BudgetId,
  BudgetLineId,
  BusinessId,
  UserId,
  normalizeBudgetId,
  normalizeBudgetLineId,
  normalizeBusinessId,  // 👈 ajoute cette ligne
  normalizeUserId,
  normalizeCategoryId,
} from '@/modules/shared/ids';
import { assertBusinessOwnedByUser, assertUserExists } from '@/modules/shared/assertions';

export type BudgetPeriodType = 'monthly' | 'custom';
export type BudgetStatus = 'draft' | 'active' | 'archived';
export type BudgetScenario = 'base' | 'optimistic' | 'conservative' | 'custom';
export type BudgetLinePriority = 'essential' | 'comfort' | 'nice_to_have';

export interface CreatePersonalBudgetInput {
  userId: UserId;
  name?: string | null;
  periodType: BudgetPeriodType;
  year?: number | null;
  month?: number | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  scenario?: BudgetScenario;
  versionNo?: number;
  status?: BudgetStatus;
  totalSpendingLimit?: number | null;
  includeAccounts?: any | null;
}

export interface CreateBusinessBudgetInput extends CreatePersonalBudgetInput {
  businessId: BusinessId;
}

export interface UpdateBudgetInput {
  name?: string | null;
  periodType?: BudgetPeriodType;
  year?: number | null;
  month?: number | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  scenario?: BudgetScenario;
  versionNo?: number;
  status?: BudgetStatus;
  totalSpendingLimit?: number | null;
  includeAccounts?: any | null;
}

export interface CreateBudgetLineInput {
  budgetId: BudgetId;
  userId: UserId;
  categoryId: bigint | number;
  categoryGroupId?: bigint | number | null;
  spendingLimit?: number | null;
  priority?: BudgetLinePriority | null;
  alertThresholdPct?: number | null;
  note?: string | null;
}

export interface UpdateBudgetLineInput {
  categoryId?: bigint | number;
  categoryGroupId?: bigint | number | null;
  spendingLimit?: number | null;
  priority?: BudgetLinePriority | null;
  alertThresholdPct?: number | null;
  note?: string | null;
}

export interface BudgetFilterOptions {
  businessId?: BusinessId | null;
  fromDate?: Date | string;
  toDate?: Date | string;
  status?: BudgetStatus;
  limit?: number;
  offset?: number;
}

const budgetSelect = {
  id: true,
  user_id: true,
  name: true,
  period_type: true,
  year: true,
  month: true,
  start_date: true,
  end_date: true,
  scenario: true,
  version_no: true,
  status: true,
  total_spending_limit: true,
  include_accounts: true,
  auto_generated: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.budgetsSelect;

export type BudgetSummary = Prisma.budgetsGetPayload<{ select: typeof budgetSelect }>;

const budgetLineSelect = {
  id: true,
  budget_id: true,
  category_id: true,
  category_group_id: true,
  spending_limit: true,
  priority: true,
  alert_threshold_pct: true,
  note: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.budget_linesSelect;

export type BudgetLineSummary = Prisma.budget_linesGetPayload<{ select: typeof budgetLineSelect }>;

export interface BudgetWithLines {
  budget: BudgetSummary;
  lines: BudgetLineSummary[];
}

export interface BudgetExecutionLine {
  line: BudgetLineSummary;
  plannedAmount: number;
  actualAmount: number;
  variance: number;
}

export interface BudgetExecutionSummary {
  budget: BudgetSummary;
  lines: BudgetExecutionLine[];
  totalPlanned: number;
  totalActual: number;
  totalVariance: number;
}

export class BudgetNotFoundError extends Error {
  constructor(message = 'Budget not found') {
    super(message);
    this.name = 'BudgetNotFoundError';
  }
}

export class BudgetLineNotFoundError extends Error {
  constructor(message = 'Budget line not found') {
    super(message);
    this.name = 'BudgetLineNotFoundError';
  }
}

export class BudgetOwnershipError extends Error {
  constructor(message = 'User does not own this budget') {
    super(message);
    this.name = 'BudgetOwnershipError';
  }
}

export class InvalidBudgetInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidBudgetInputError';
  }
}

export class PersonalBudgetNotFoundError extends Error {
  constructor(message = 'Personal budget not found for current period') {
    super(message);
    this.name = 'PersonalBudgetNotFoundError';
  }
}

function normalizeBudgetName(name?: string | null): string | null {
  if (name == null) return null;
  return name.trim().replace(/\s+/g, ' ').slice(0, 255);
}

function normalizeNote(note?: string | null): string | null {
  if (note == null) return null;
  return note.trim().replace(/\s+/g, ' ');
}

// Overload 1 : si on passe Date | string -> toujours Date
function parseDateToDateOnly(input: Date | string): Date;
// Overload 2 : si on permet null/undefined -> peut retourner null
function parseDateToDateOnly(input?: Date | string | null): Date | null;
function parseDateToDateOnly(input?: Date | string | null): Date | null {
  if (input == null) return null;
  const parsed = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(parsed.getTime())) {
    throw new InvalidBudgetInputError('Invalid date');
  }
  return parsed;
}

function validatePeriod(input: {
  periodType: BudgetPeriodType;
  year?: number | null;
  month?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
}) {
  if (input.periodType === 'monthly') {
    if (input.year == null || input.month == null) {
      throw new InvalidBudgetInputError('Monthly budgets require year and month');
    }
    if (input.month < 1 || input.month > 12) {
      throw new InvalidBudgetInputError('Month must be between 1 and 12');
    }
  } else if (input.periodType === 'custom') {
    if (!input.startDate || !input.endDate) {
      throw new InvalidBudgetInputError('Custom budgets require startDate and endDate');
    }
    if (input.startDate.getTime() > input.endDate.getTime()) {
      throw new InvalidBudgetInputError('startDate must be before or equal to endDate');
    }
  }
}

function validatePriority(priority?: BudgetLinePriority | null) {
  if (priority == null) return;
  const allowed: BudgetLinePriority[] = ['essential', 'comfort', 'nice_to_have'];
  if (!allowed.includes(priority)) {
    throw new InvalidBudgetInputError('Invalid budget line priority');
  }
}

function validateAlertThreshold(alert?: number | null) {
  if (alert == null) return;
  if (!Number.isFinite(alert) || alert < 0 || alert > 100) {
    throw new InvalidBudgetInputError('alertThresholdPct must be between 0 and 100');
  }
}

function validateSpendingLimit(limit?: number | null) {
  if (limit == null) return;
  if (!Number.isFinite(limit) || limit < 0) {
    throw new InvalidBudgetInputError('spendingLimit must be >= 0');
  }
}

export class BudgetService {
  constructor(private readonly prismaClient: PrismaClient) {}

  async createPersonalBudget(input: CreatePersonalBudgetInput): Promise<BudgetWithLines> {
    const userId = normalizeUserId(input.userId);
    const name = normalizeBudgetName(input.name);
    const startDate = parseDateToDateOnly(input.startDate ?? null);
    const endDate = parseDateToDateOnly(input.endDate ?? null);
    const periodType = input.periodType;
    const scenario = input.scenario ?? 'base';
    const versionNo = input.versionNo ?? 1;
    const status = input.status ?? 'active';

    validatePeriod({
      periodType,
      year: input.year ?? null,
      month: input.month ?? null,
      startDate,
      endDate,
    });

    await assertUserExists(this.prismaClient, userId);

    const userSettings = await this.prismaClient.user_settings.findUnique({
      where: { user_id: userId },
      select: { main_currency: true },
    });

    const budget = await this.prismaClient.budgets.create({
      data: {
        user_id: userId,
        name,
        period_type: periodType,
        year: input.year ?? null,
        month: input.month ?? null,
        start_date: startDate,
        end_date: endDate,
        scenario,
        version_no: versionNo,
        status,
        total_spending_limit: input.totalSpendingLimit ?? null,
        include_accounts:
          input.includeAccounts ??
          (userSettings?.main_currency
            ? { currency: userSettings.main_currency, scope: 'personal' }
            : { scope: 'personal' }),
        auto_generated: false,
      },
      select: budgetSelect,
    });

    return { budget, lines: [] };
  }

  async createBusinessBudget(input: CreateBusinessBudgetInput): Promise<BudgetWithLines> {
    const userId = normalizeUserId(input.userId);
    const businessId = normalizeBusinessId(input.businessId);
    const name = normalizeBudgetName(input.name);
    const startDate = parseDateToDateOnly(input.startDate ?? null);
    const endDate = parseDateToDateOnly(input.endDate ?? null);
    const periodType = input.periodType;
    const scenario = input.scenario ?? 'base';
    const versionNo = input.versionNo ?? 1;
    const status = input.status ?? 'active';

    validatePeriod({
      periodType,
      year: input.year ?? null,
      month: input.month ?? null,
      startDate,
      endDate,
    });

    await assertUserExists(this.prismaClient, userId);
    await assertBusinessOwnedByUser(this.prismaClient, businessId, userId);

    const budget = await this.prismaClient.budgets.create({
      data: {
        user_id: userId,
        name,
        period_type: periodType,
        year: input.year ?? null,
        month: input.month ?? null,
        start_date: startDate,
        end_date: endDate,
        scenario,
        version_no: versionNo,
        status,
        total_spending_limit: input.totalSpendingLimit ?? null,
        include_accounts: input.includeAccounts ?? { businessId: businessId.toString(), scope: 'business' },
        auto_generated: false,
      },
      select: budgetSelect,
    });

    return { budget, lines: [] };
  }

  async getBudgetWithLinesForUser(budgetIdInput: BudgetId, userIdInput: UserId): Promise<BudgetWithLines> {
    const budgetId = normalizeBudgetId(budgetIdInput);
    const userId = normalizeUserId(userIdInput);

    const budget = await this.prismaClient.budgets.findUnique({
      where: { id: budgetId },
      select: budgetSelect,
    });

    if (!budget) {
      throw new BudgetNotFoundError();
    }
    if (budget.user_id !== userId) {
      throw new BudgetOwnershipError();
    }

    const lines = await this.prismaClient.budget_lines.findMany({
      where: { budget_id: budgetId },
      select: budgetLineSelect,
      orderBy: { id: 'asc' },
    });

    return { budget, lines };
  }

  async listBudgetsForUser(userIdInput: UserId, filters?: BudgetFilterOptions): Promise<BudgetSummary[]> {
    const userId = normalizeUserId(userIdInput);

    const where: Prisma.budgetsWhereInput = {
      user_id: userId,
    };

    if (filters?.businessId !== undefined) {
      if (filters.businessId === null) {
        where.include_accounts = {
          path: ['scope'],
          equals: 'personal',
        } as any;
      } else {
        where.include_accounts = {
          path: ['businessId'],
          equals: filters.businessId.toString(),
        } as any;
      }
    }

    if (filters?.fromDate) {
      const from = parseDateToDateOnly(filters.fromDate); // => Date
      where.start_date = {
        ...(where.start_date as any),
        gte: from,
      } as any;
    }

    if (filters?.toDate) {
      const to = parseDateToDateOnly(filters.toDate); // => Date
      where.end_date = {
        ...(where.end_date as any),
        lte: to,
      } as any;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    const limit = filters?.limit && filters.limit > 0 ? Math.min(filters.limit, 1000) : 100;
    const offset = filters?.offset ?? 0;

    const budgets = await this.prismaClient.budgets.findMany({
      where,
      select: budgetSelect,
      orderBy: [{ start_date: 'asc' }, { created_at: 'asc' }],
      take: limit,
      skip: offset,
    });

    return budgets;
  }

  async updateBudget(
    budgetIdInput: BudgetId,
    userIdInput: UserId,
    input: UpdateBudgetInput
  ): Promise<BudgetWithLines> {
    const budgetId = normalizeBudgetId(budgetIdInput);
    const userId = normalizeUserId(userIdInput);

    const existing = await this.prismaClient.budgets.findUnique({
      where: { id: budgetId },
      select: budgetSelect,
    });

    if (!existing) {
      throw new BudgetNotFoundError();
    }
    if (existing.user_id !== userId) {
      throw new BudgetOwnershipError();
    }

    const startDate = input.startDate !== undefined ? parseDateToDateOnly(input.startDate ?? null) : undefined;
    const endDate = input.endDate !== undefined ? parseDateToDateOnly(input.endDate ?? null) : undefined;

    const periodType = (input.periodType ?? existing.period_type) as BudgetPeriodType;
    validatePeriod({
      periodType,
      year: input.year ?? existing.year,
      month: input.month ?? existing.month,
      startDate: startDate ?? existing.start_date,
      endDate: endDate ?? existing.end_date,
    });

    const data: Prisma.budgetsUpdateInput = {};
    if (input.name !== undefined) data.name = normalizeBudgetName(input.name);
    if (input.periodType !== undefined) data.period_type = input.periodType;
    if (input.year !== undefined) data.year = input.year;
    if (input.month !== undefined) data.month = input.month;
    if (startDate !== undefined) data.start_date = startDate;
    if (endDate !== undefined) data.end_date = endDate;
    if (input.scenario !== undefined) data.scenario = input.scenario;
    if (input.versionNo !== undefined) data.version_no = input.versionNo;
    if (input.status !== undefined) data.status = input.status;
    if (input.totalSpendingLimit !== undefined) data.total_spending_limit = input.totalSpendingLimit;
    if (input.includeAccounts !== undefined) data.include_accounts = input.includeAccounts;

    if (Object.keys(data).length === 0) {
      return this.getBudgetWithLinesForUser(budgetId, userId);
    }

    try {
      await this.prismaClient.budgets.update({
        where: { id: budgetId },
        data,
        select: { id: true },
      });
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new BudgetNotFoundError();
      }
      throw err;
    }

    return this.getBudgetWithLinesForUser(budgetId, userId);
  }

  async archiveBudget(budgetIdInput: BudgetId, userIdInput: UserId): Promise<BudgetWithLines> {
    return this.updateBudget(budgetIdInput, userIdInput, { status: 'archived' });
  }

  async reactivateBudget(budgetIdInput: BudgetId, userIdInput: UserId): Promise<BudgetWithLines> {
    return this.updateBudget(budgetIdInput, userIdInput, { status: 'active' });
  }

  async addBudgetLine(input: CreateBudgetLineInput): Promise<BudgetLineSummary> {
    const budgetId = normalizeBudgetId(input.budgetId);
    const userId = normalizeUserId(input.userId);
    const categoryId = normalizeCategoryId(input.categoryId as any);
    const categoryGroupId =
      input.categoryGroupId !== undefined && input.categoryGroupId !== null
        ? normalizeCategoryId(input.categoryGroupId as any)
        : null;

    validateSpendingLimit(input.spendingLimit ?? null);
    validatePriority(input.priority ?? null);
    validateAlertThreshold(input.alertThresholdPct ?? null);
    await this.assertBudgetOwnedByUser(budgetId, userId);

    const line = await this.prismaClient.budget_lines.create({
      data: {
        budget_id: budgetId,
        category_id: categoryId,
        category_group_id: categoryGroupId,
        spending_limit: input.spendingLimit ?? null,
        priority: input.priority ?? null,
        alert_threshold_pct: input.alertThresholdPct ?? undefined,
        note: normalizeNote(input.note ?? null),
      },
      select: budgetLineSelect,
    });

    return line;
  }

  async updateBudgetLine(
    lineIdInput: BudgetLineId,
    userIdInput: UserId,
    input: UpdateBudgetLineInput
  ): Promise<BudgetLineSummary> {
    const lineId = normalizeBudgetLineId(lineIdInput);
    const userId = normalizeUserId(userIdInput);

    const existing = await this.assertBudgetLineOwnedByUser(lineId, userId);

    const data: Prisma.budget_linesUpdateInput = {};
    if (input.spendingLimit !== undefined) {
      validateSpendingLimit(input.spendingLimit);
      data.spending_limit = input.spendingLimit;
    }
    if (input.priority !== undefined) {
      validatePriority(input.priority ?? null);
      data.priority = input.priority;
    }
    if (input.alertThresholdPct !== undefined) {
      validateAlertThreshold(input.alertThresholdPct ?? null);
      data.alert_threshold_pct = input.alertThresholdPct;
    }
    if (input.note !== undefined) {
      data.note = normalizeNote(input.note);
    }

    if (Object.keys(data).length === 0) {
      return existing;
    }

    try {
      const updated = await this.prismaClient.budget_lines.update({
        where: { id: lineId },
        data,
        select: budgetLineSelect,
      });
      return updated;
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new BudgetLineNotFoundError();
      }
      throw err;
    }
  }

  async deleteBudgetLineForUser(lineIdInput: BudgetLineId, userIdInput: UserId): Promise<void> {
    const lineId = normalizeBudgetLineId(lineIdInput);
    const userId = normalizeUserId(userIdInput);

    await this.assertBudgetLineOwnedByUser(lineId, userId);

    try {
      await this.prismaClient.budget_lines.delete({
        where: { id: lineId },
      });
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new BudgetLineNotFoundError();
      }
      throw err;
    }
  }

  async computeBudgetExecutionForUser(
    budgetIdInput: BudgetId,
    userIdInput: UserId
  ): Promise<BudgetExecutionSummary> {
    const budgetId = normalizeBudgetId(budgetIdInput);
    const userId = normalizeUserId(userIdInput);

    const { budget, lines } = await this.getBudgetWithLinesForUser(budgetId, userId);

    const dateRange = this.getBudgetDateRange(budget);
    const businessScope = this.extractBusinessScope(budget);

    const transactions = await this.prismaClient.transactions.findMany({
      where: {
        user_id: userId,
        ...(dateRange
          ? {
              date: {
                gte: dateRange.start,
                lte: dateRange.end,
              },
            }
          : {}),
        ...(businessScope === 'personal'
          ? { business_id: null }
          : typeof businessScope === 'bigint'
          ? { business_id: businessScope }
          : {}),
      },
      select: {
        id: true,
        amount: true,
        direction: true,
        category_id: true,
      },
    });

    const linesWithExecution: BudgetExecutionLine[] = lines.map((line) => {
      const plannedAmount = Number(line.spending_limit ?? 0);
      const actualAmount = transactions
        .filter((t) => t.category_id === line.category_id)
        .reduce((sum, t) => {
          const signed = t.direction === 'out' ? -Number(t.amount) : Number(t.amount);
          return sum + signed;
        }, 0);
      const variance = actualAmount - plannedAmount;
      return {
        line,
        plannedAmount,
        actualAmount,
        variance,
      };
    });

    const totalPlanned = linesWithExecution.reduce((sum, l) => sum + l.plannedAmount, 0);
    const totalActual = linesWithExecution.reduce((sum, l) => sum + l.actualAmount, 0);

    return {
      budget,
      lines: linesWithExecution,
      totalPlanned,
      totalActual,
      totalVariance: totalActual - totalPlanned,
    };
  }

  async computeCurrentPersonalBudgetOverview(
    userIdInput: UserId,
    options?: { referenceDate?: Date }
  ): Promise<{
    budget: BudgetSummary;
    totalPlanned: number;
    totalActual: number;
    totalVariance: number;
    byCategory?: Array<{
      categoryId: bigint;
      categoryName?: string;
      planned: number;
      actual: number;
      variance: number;
    }>;
  } | null> {
    const userId = normalizeUserId(userIdInput);
    const ref = options?.referenceDate ?? new Date();
    const year = ref.getUTCFullYear();
    const month = ref.getUTCMonth() + 1;

    const budget = await this.prismaClient.budgets.findFirst({
      where: {
        user_id: userId,
        period_type: 'monthly',
        year,
        month,
        status: 'active',
        include_accounts: { path: ['scope'], equals: 'personal' } as any,
      },
      select: budgetSelect,
    });

    if (!budget) {
      return null;
    }

    const lines = await this.prismaClient.budget_lines.findMany({
      where: { budget_id: budget.id },
      select: budgetLineSelect,
    });

    const categoryIds = lines.map((l) => l.category_id);
    const categories =
      categoryIds.length > 0
        ? await this.prismaClient.categories.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, name: true },
          })
        : [];
    const categoryNameMap = new Map<bigint, string>();
    categories.forEach((c) => categoryNameMap.set(c.id, c.name));

    const dateRange = this.getBudgetDateRange(budget) ?? {
      start: new Date(Date.UTC(year, month - 1, 1)),
      end: new Date(Date.UTC(year, month, 0)),
    };

    const txAgg = await this.prismaClient.transactions.groupBy({
      by: ['category_id', 'direction'],
      where: {
        user_id: userId,
        business_id: null,
        date: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      },
      _sum: { amount: true },
    });

    const actualByCategory = new Map<bigint, number>();
    txAgg.forEach((row) => {
      if (!row.category_id) return;
      const amt = Number(row._sum.amount ?? 0);
      const signed = row.direction === 'out' ? Math.abs(amt) : 0; // focus on spending
      actualByCategory.set(row.category_id, (actualByCategory.get(row.category_id) ?? 0) + signed);
    });

    const byCategory = lines.map((line) => {
      const planned = Number(line.spending_limit ?? 0);
      const actual = actualByCategory.get(line.category_id) ?? 0;
      return {
        categoryId: line.category_id,
        categoryName: categoryNameMap.get(line.category_id),
        planned,
        actual,
        variance: actual - planned,
      };
    });

    const totalPlanned = byCategory.reduce((sum, c) => sum + c.planned, 0);
    const totalActual = byCategory.reduce((sum, c) => sum + c.actual, 0);

    return {
      budget,
      totalPlanned,
      totalActual,
      totalVariance: totalActual - totalPlanned,
      byCategory,
    };
  }

  private getBudgetDateRange(budget: BudgetSummary): { start: Date; end: Date } | null {
    if (budget.period_type === 'monthly' && budget.year && budget.month) {
      const start = new Date(Date.UTC(budget.year, budget.month - 1, 1));
      const end = new Date(Date.UTC(budget.year, budget.month, 0));
      return { start, end };
    }
    if (budget.period_type === 'custom' && budget.start_date && budget.end_date) {
      return { start: new Date(budget.start_date), end: new Date(budget.end_date) };
    }
    return null;
  }

  private extractBusinessScope(budget: BudgetSummary): bigint | 'personal' | null {
    if (!budget.include_accounts) return null;
    try {
      const parsed =
        typeof budget.include_accounts === 'string'
          ? JSON.parse(budget.include_accounts)
          : (budget.include_accounts as any);
      if (parsed?.scope === 'personal') return 'personal';
      if (parsed?.businessId) return normalizeBusinessId(BigInt(parsed.businessId));
    } catch {
      return null;
    }
    return null;
  }

  private async assertBudgetOwnedByUser(budgetId: bigint, userId: bigint): Promise<BudgetSummary> {
    const budget = await this.prismaClient.budgets.findUnique({
      where: { id: budgetId },
      select: budgetSelect,
    });
    if (!budget) {
      throw new BudgetNotFoundError();
    }
    if (budget.user_id !== userId) {
      throw new BudgetOwnershipError();
    }
    return budget;
  }

  private async assertBudgetLineOwnedByUser(
    lineId: bigint,
    userId: bigint
  ): Promise<BudgetLineSummary & { budget_id: bigint }> {
    const line = await this.prismaClient.budget_lines.findUnique({
      where: { id: lineId },
      select: { ...budgetLineSelect, budget_id: true },
    });
    if (!line) {
      throw new BudgetLineNotFoundError();
    }
    const budget = await this.prismaClient.budgets.findUnique({
      where: { id: line.budget_id },
      select: { id: true, user_id: true },
    });
    if (!budget) {
      throw new BudgetNotFoundError();
    }
    if (budget.user_id !== userId) {
      throw new BudgetOwnershipError();
    }
    return line;
  }
}

export const budgetService = new BudgetService(prisma);
