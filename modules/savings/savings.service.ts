import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  AccountId,
  BusinessId,
  SavingsGoalId,
  UserId,
  normalizeAccountId,
  normalizeBusinessId,
  normalizeSavingsGoalId,
  normalizeUserId,
} from '@/modules/shared/ids';
import { AccountOwnershipError } from '@/modules/shared/errors';
import { assertAccountOwnedByUser, assertBusinessOwnedByUser, assertUserExists } from '@/modules/shared/assertions';

export type SavingsGoalStatus = 'active' | 'paused' | 'completed' | 'cancelled';
export type SavingsGoalPriority = 'low' | 'normal' | 'high';

export interface CreatePersonalSavingsGoalInput {
  userId: UserId;
  name: string;
  targetAmount: number;
  initialAmount?: number;
  startDate?: Date | string | null;
  targetDate?: Date | string | null;
  priority?: SavingsGoalPriority | null;
  linkedAccountId?: AccountId | null;
  color?: string | null;
  emoji?: string | null;
  notes?: string | null;
}

export interface CreateBusinessSavingsGoalInput extends CreatePersonalSavingsGoalInput {
  businessId: BusinessId;
}

export interface UpdateSavingsGoalInput {
  name?: string;
  targetAmount?: number;
  currentAmount?: number;
  startDate?: Date | string | null;
  targetDate?: Date | string | null;
  priority?: SavingsGoalPriority | null;
  linkedAccountId?: AccountId | null;
  status?: SavingsGoalStatus;
  color?: string | null;
  emoji?: string | null;
  notes?: string | null;
}

export interface SavingsGoalFilterOptions {
  businessId?: BusinessId | null;
  status?: SavingsGoalStatus;
  limit?: number;
  offset?: number;
}

const savingsGoalSelect = {
  id: true,
  user_id: true,
  name: true,
  target_amount: true,
  target_date: true,
  priority: true,
  linked_account_id: true,
  status: true,
  current_amount_cached: true,
  color: true,
  emoji: true,
  completed_at: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.savings_goalsSelect;

export type SavingsGoalSummary = Prisma.savings_goalsGetPayload<{ select: typeof savingsGoalSelect }>;

export interface SavingsGoalWithProgress extends SavingsGoalSummary {
  progressPct: number;
  remainingAmount: number;
  isCompleted: boolean;
}

export interface SavingsOverview {
  goals: SavingsGoalWithProgress[];
  totalTarget: number;
  totalCurrent: number;
  overallProgressPct: number;
}

export class SavingsGoalNotFoundError extends Error {
  constructor(message = 'Savings goal not found') {
    super(message);
    this.name = 'SavingsGoalNotFoundError';
  }
}

export class SavingsGoalOwnershipError extends Error {
  constructor(message = 'User does not own this savings goal') {
    super(message);
    this.name = 'SavingsGoalOwnershipError';
  }
}

export class InvalidSavingsGoalInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSavingsGoalInputError';
  }
}

function normalizeGoalName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, 255);
}

function normalizeNote(note?: string | null): string | null {
  if (note == null) return null;
  return note.trim().replace(/\s+/g, ' ');
}

function parseDateToDateOnly(input?: Date | string | null): Date | null {
  if (input == null) return null;
  const parsed = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(parsed.getTime())) {
    throw new InvalidSavingsGoalInputError('Invalid date');
  }
  return parsed;
}

function validateAmount(amount: number, label: string) {
  if (!Number.isFinite(amount) || amount <= 0 || amount >= 1e12) {
    throw new InvalidSavingsGoalInputError(`${label} must be > 0 and reasonable`);
  }
}

function validateCurrentNotExceedTarget(current: number, target: number) {
  if (current < 0) {
    throw new InvalidSavingsGoalInputError('Current amount must be >= 0');
  }
  if (current > target) {
    throw new InvalidSavingsGoalInputError('Current amount cannot exceed target amount');
  }
}

function validatePriority(priority?: SavingsGoalPriority | null) {
  if (priority == null) return;
  const allowed: SavingsGoalPriority[] = ['low', 'normal', 'high'];
  if (!allowed.includes(priority)) {
    throw new InvalidSavingsGoalInputError('Invalid savings goal priority');
  }
}

export class SavingsService {
  constructor(private readonly prismaClient: PrismaClient) {}

  async createPersonalSavingsGoal(input: CreatePersonalSavingsGoalInput): Promise<SavingsGoalSummary> {
    const userId = normalizeUserId(input.userId);
    const name = normalizeGoalName(input.name);

    validateAmount(input.targetAmount, 'Target amount');
    const current = input.initialAmount ?? 0;
    validateCurrentNotExceedTarget(current, input.targetAmount);
    validatePriority(input.priority ?? null);

    const targetDate = parseDateToDateOnly(input.targetDate ?? null);
    // startDate is only validated via parseDateToDateOnly; it’s not persisted
    if (input.startDate !== undefined) {
      parseDateToDateOnly(input.startDate ?? null);
    }

    await assertUserExists(this.prismaClient, userId);

    let linkedAccountId: bigint | null = null;
    if (input.linkedAccountId !== undefined && input.linkedAccountId !== null) {
      const account = await assertAccountOwnedByUser(
        this.prismaClient,
        normalizeAccountId(input.linkedAccountId),
        userId
      );
      if (account.business_id !== null) {
        throw new AccountOwnershipError('Linked account must be personal (no business)');
      }
      linkedAccountId = account.id;
    }

    const goal = await this.prismaClient.savings_goals.create({
      data: {
        user_id: userId,
        name,
        target_amount: input.targetAmount,
        current_amount_cached: current,
        target_date: targetDate,
        priority: input.priority ?? null,
        linked_account_id: linkedAccountId,
        status: 'active',
        color: input.color ?? null,
        emoji: input.emoji ?? null,
        completed_at: null,
        // notes/start_date not in schema; ignored
      },
      select: savingsGoalSelect,
    });

    return goal;
  }

  async createBusinessSavingsGoal(input: CreateBusinessSavingsGoalInput): Promise<SavingsGoalSummary> {
    const userId = normalizeUserId(input.userId);
    const businessId = normalizeBusinessId(input.businessId);
    const name = normalizeGoalName(input.name);

    validateAmount(input.targetAmount, 'Target amount');
    const current = input.initialAmount ?? 0;
    validateCurrentNotExceedTarget(current, input.targetAmount);
    validatePriority(input.priority ?? null);

    const targetDate = parseDateToDateOnly(input.targetDate ?? null);
    if (input.startDate !== undefined) {
      parseDateToDateOnly(input.startDate ?? null);
    }

    await assertUserExists(this.prismaClient, userId);
    await assertBusinessOwnedByUser(this.prismaClient, businessId, userId);

    let linkedAccountId: bigint | null = null;
    if (input.linkedAccountId !== undefined && input.linkedAccountId !== null) {
      const account = await assertAccountOwnedByUser(
        this.prismaClient,
        normalizeAccountId(input.linkedAccountId),
        userId
      );
      if (account.business_id !== businessId) {
        throw new AccountOwnershipError('Linked account must belong to the provided business');
      }
      linkedAccountId = account.id;
    }

    const goal = await this.prismaClient.savings_goals.create({
      data: {
        user_id: userId,
        name,
        target_amount: input.targetAmount,
        current_amount_cached: current,
        target_date: targetDate,
        priority: input.priority ?? null,
        linked_account_id: linkedAccountId,
        status: 'active',
        color: input.color ?? null,
        emoji: input.emoji ?? null,
        completed_at: null,
      },
      select: savingsGoalSelect,
    });

    return goal;
  }

  async getSavingsGoalForUser(goalIdInput: SavingsGoalId, userIdInput: UserId): Promise<SavingsGoalSummary> {
    const goalId = normalizeSavingsGoalId(goalIdInput);
    const userId = normalizeUserId(userIdInput);

    const goal = await this.prismaClient.savings_goals.findUnique({
      where: { id: goalId },
      select: savingsGoalSelect,
    });

    if (!goal) {
      throw new SavingsGoalNotFoundError();
    }
    if (goal.user_id !== userId) {
      throw new SavingsGoalOwnershipError();
    }

    return goal;
  }

  async listSavingsGoalsForUser(userIdInput: UserId, filters?: SavingsGoalFilterOptions): Promise<SavingsGoalSummary[]> {
    const userId = normalizeUserId(userIdInput);

    const where: Prisma.savings_goalsWhereInput = {
      user_id: userId,
    };

    if (filters?.businessId !== undefined) {
      if (filters.businessId === null) {
        // Personal scope: no linked account OR linked to a personal account
        where.OR = [{ linked_account_id: null }, { accounts: { business_id: null } }];
      } else {
        const bizId = normalizeBusinessId(filters.businessId);
        where.accounts = { business_id: bizId };
      }
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    const limit = filters?.limit && filters.limit > 0 ? Math.min(filters.limit, 1000) : 100;
    const offset = filters?.offset ?? 0;

    const goals = await this.prismaClient.savings_goals.findMany({
      where,
      select: savingsGoalSelect,
      orderBy: [{ target_date: 'asc' }, { created_at: 'asc' }],
      take: limit,
      skip: offset,
    });

    return goals;
  }

  async updateSavingsGoal(
    goalIdInput: SavingsGoalId,
    userIdInput: UserId,
    input: UpdateSavingsGoalInput
  ): Promise<SavingsGoalSummary> {
    const goalId = normalizeSavingsGoalId(goalIdInput);
    const userId = normalizeUserId(userIdInput);

    const existing = await this.prismaClient.savings_goals.findUnique({
      where: { id: goalId },
      select: savingsGoalSelect,
    });

    if (!existing) {
      throw new SavingsGoalNotFoundError();
    }
    if (existing.user_id !== userId) {
      throw new SavingsGoalOwnershipError();
    }

    const targetAmount = input.targetAmount ?? Number(existing.target_amount);
    const currentAmount =
      input.currentAmount !== undefined ? input.currentAmount : Number(existing.current_amount_cached);

    validateAmount(targetAmount, 'Target amount');
    validateCurrentNotExceedTarget(currentAmount, targetAmount);

    if (input.priority !== undefined) {
      validatePriority(input.priority ?? null);
    }

    const targetDate =
      input.targetDate !== undefined ? parseDateToDateOnly(input.targetDate ?? null) : undefined;

    if (input.startDate !== undefined) {
      // no start_date column; just validate
      parseDateToDateOnly(input.startDate ?? null);
    }

    const data: Prisma.savings_goalsUpdateInput = {};

    if (input.name !== undefined) data.name = normalizeGoalName(input.name);
    if (input.targetAmount !== undefined) data.target_amount = input.targetAmount;
    if (input.currentAmount !== undefined) data.current_amount_cached = input.currentAmount;
    if (targetDate !== undefined) data.target_date = targetDate;
    if (input.priority !== undefined) data.priority = input.priority ?? null;
    if (input.status !== undefined) data.status = input.status;
    if (input.color !== undefined) data.color = input.color ?? null;
    if (input.emoji !== undefined) data.emoji = input.emoji ?? null;

    if (input.notes !== undefined) {
      // notes not in schema; ignore gracefully
    }

    if (input.linkedAccountId !== undefined) {
      if (input.linkedAccountId === null) {
        // dé-lier le compte
        (data as any).linked_account_id = null;
      } else {
        const account = await assertAccountOwnedByUser(
          this.prismaClient,
          normalizeAccountId(input.linkedAccountId),
          userId
        );
        (data as any).linked_account_id = account.id;
      }
    }

    if (Object.keys(data).length === 0) {
      return existing;
    }

    try {
      const updated = await this.prismaClient.savings_goals.update({
        where: { id: goalId },
        data,
        select: savingsGoalSelect,
      });
      return updated;
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new SavingsGoalNotFoundError();
      }
      throw err;
    }
  }

  async archiveSavingsGoal(goalIdInput: SavingsGoalId, userIdInput: UserId): Promise<SavingsGoalSummary> {
    return this.updateSavingsGoal(goalIdInput, userIdInput, { status: 'cancelled' });
  }

  async reactivateSavingsGoal(goalIdInput: SavingsGoalId, userIdInput: UserId): Promise<SavingsGoalSummary> {
    return this.updateSavingsGoal(goalIdInput, userIdInput, { status: 'active' });
  }

  async completeSavingsGoal(goalIdInput: SavingsGoalId, userIdInput: UserId): Promise<SavingsGoalSummary> {
    return this.updateSavingsGoal(goalIdInput, userIdInput, { status: 'completed' });
  }

  async pauseSavingsGoal(goalIdInput: SavingsGoalId, userIdInput: UserId): Promise<SavingsGoalSummary> {
    return this.updateSavingsGoal(goalIdInput, userIdInput, { status: 'paused' });
  }

  async deleteSavingsGoalForUser(goalIdInput: SavingsGoalId, userIdInput: UserId): Promise<void> {
    const goalId = normalizeSavingsGoalId(goalIdInput);
    const userId = normalizeUserId(userIdInput);

    const existing = await this.prismaClient.savings_goals.findUnique({
      where: { id: goalId },
      select: { id: true, user_id: true },
    });

    if (!existing) {
      throw new SavingsGoalNotFoundError();
    }
    if (existing.user_id !== userId) {
      throw new SavingsGoalOwnershipError();
    }

    try {
      await this.prismaClient.savings_goals.delete({
        where: { id: goalId },
      });
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new SavingsGoalNotFoundError();
      }
      throw err;
    }
  }

  async computeSavingsOverviewForUser(
    userIdInput: UserId,
    filters?: SavingsGoalFilterOptions
  ): Promise<SavingsOverview> {
    const goals = await this.listSavingsGoalsForUser(userIdInput, filters);

    const goalsWithProgress: SavingsGoalWithProgress[] = goals.map((g) => {
      const target = Number(g.target_amount);
      const current = Number(g.current_amount_cached);
      const progressPct = target > 0 ? (current / target) * 100 : 0;
      const remainingAmount = Math.max(target - current, 0);
      const isCompleted = g.status === 'completed' || current >= target;

      return {
        ...g,
        progressPct,
        remainingAmount,
        isCompleted,
      };
    });

    const totalTarget = goalsWithProgress.reduce((sum, g) => sum + Number(g.target_amount), 0);
    const totalCurrent = goalsWithProgress.reduce((sum, g) => sum + Number(g.current_amount_cached), 0);
    const overallProgressPct = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;

    return {
      goals: goalsWithProgress,
      totalTarget,
      totalCurrent,
      overallProgressPct,
    };
  }

  async computePersonalSavingsOverview(
    userIdInput: UserId
  ): Promise<{
    goals: SavingsGoalSummary[];
    totalTarget: number;
    totalCurrent: number;
    overallProgressPct: number;
  }> {
    const overview = await this.computeSavingsOverviewForUser(userIdInput, { businessId: null });
    return {
      goals: overview.goals,
      totalTarget: overview.totalTarget,
      totalCurrent: overview.totalCurrent,
      overallProgressPct: overview.overallProgressPct,
    };
  }
}

export const savingsService = new SavingsService(prisma);
