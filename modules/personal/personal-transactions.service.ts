import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  AccountId,
  TransactionId,
  UserId,
  normalizeAccountId,
  normalizeTransactionId,
  normalizeUserId,
} from '@/modules/shared/ids';
import { assertAccountOwnedByUser, assertUserExists } from '@/modules/shared/assertions';
import { AccountOwnershipError, TransactionNotFoundError, TransactionOwnershipError } from '@/modules/shared/errors';

export type PersonalTransactionDirection = 'in' | 'out' | 'transfer';

export interface CreatePersonalTransactionInput {
  userId: UserId;
  accountId: AccountId;
  direction: PersonalTransactionDirection;
  amount: number;
  occurredAt: Date;
  label: string;
  category?: string | null;
  notes?: string | null;
}

export interface UpdatePersonalTransactionInput {
  direction?: PersonalTransactionDirection;
  amount?: number;
  occurredAt?: Date;
  label?: string;
  category?: string | null;
  notes?: string | null;
}

export class PersonalTransactionsService {
  constructor(private readonly prismaClient: PrismaClient) {}

  private normalizeDate(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  async create(input: CreatePersonalTransactionInput) {
    const userId = normalizeUserId(input.userId);
    const accountId = normalizeAccountId(input.accountId);
    await assertUserExists(this.prismaClient, userId);
    const account = await assertAccountOwnedByUser(this.prismaClient, accountId, userId);
    if (account.business_id !== null) {
      throw new AccountOwnershipError('Personal transaction must use a personal account');
    }

    const tx = await this.prismaClient.transactions.create({
      data: {
        user_id: userId,
        business_id: null,
        account_id: accountId,
        date: this.normalizeDate(input.occurredAt),
        amount: input.amount,
        direction: input.direction,
        type: 'other',
        label: input.label,
        raw_label: null,
        category_id: null,
        project_id: null,
        contact_id: null,
        income_source_id: null,
        invoice_id: null,
        supplier_id: null,
        notes: input.notes ?? null,
        tags: null,
        is_recurring: false,
        recurring_series_id: null,
      },
      select: transactionSelect,
    });

    return tx;
  }

  async list(userIdInput: UserId, filters?: { accountId?: AccountId; dateFrom?: Date; dateTo?: Date; direction?: PersonalTransactionDirection }) {
    const userId = normalizeUserId(userIdInput);
    await assertUserExists(this.prismaClient, userId);
    const where: Prisma.transactionsWhereInput = {
      user_id: userId,
      business_id: null,
    };
    if (filters?.accountId) {
      where.account_id = normalizeAccountId(filters.accountId);
    }
    if (filters?.dateFrom || filters?.dateTo) {
      where.date = {};
      if (filters?.dateFrom) (where.date as Prisma.DateTimeFilter).gte = this.normalizeDate(filters.dateFrom);
      if (filters?.dateTo) (where.date as Prisma.DateTimeFilter).lte = this.normalizeDate(filters.dateTo);
    }
    if (filters?.direction) {
      where.direction = filters.direction;
    }

    return this.prismaClient.transactions.findMany({
      where,
      select: transactionSelect,
      orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
    });
  }

  async getById(userIdInput: UserId, transactionIdInput: TransactionId) {
    const userId = normalizeUserId(userIdInput);
    const transactionId = normalizeTransactionId(transactionIdInput);
    const tx = await this.prismaClient.transactions.findUnique({
      where: { id: transactionId },
      select: transactionSelect,
    });
    if (!tx) throw new TransactionNotFoundError();
    if (tx.user_id !== userId || tx.business_id !== null) throw new TransactionOwnershipError();
    return tx;
  }

  async update(
    userIdInput: UserId,
    transactionIdInput: TransactionId,
    updates: UpdatePersonalTransactionInput
  ) {
    await this.getById(userIdInput, transactionIdInput);
    const data: Prisma.transactionsUncheckedUpdateInput = {};
    if (updates.direction !== undefined) data.direction = updates.direction;
    if (updates.amount !== undefined) data.amount = updates.amount;
      if (updates.occurredAt !== undefined) data.date = this.normalizeDate(updates.occurredAt);
    if (updates.label !== undefined) data.label = updates.label;
    if (updates.category !== undefined) data.notes = updates.category ?? null;
    if (updates.notes !== undefined) data.notes = updates.notes;

    const updated = await this.prismaClient.transactions.update({
      where: { id: normalizeTransactionId(transactionIdInput) },
      data,
      select: transactionSelect,
    });
    return updated;
  }

  async delete(userIdInput: UserId, transactionIdInput: TransactionId): Promise<void> {
    await this.getById(userIdInput, transactionIdInput);
    await this.prismaClient.transactions.delete({ where: { id: normalizeTransactionId(transactionIdInput) } });
  }
}

const transactionSelect = {
  id: true,
  user_id: true,
  business_id: true,
  account_id: true,
  date: true,
  amount: true,
  direction: true,
  type: true,
  label: true,
  notes: true,
  category_id: true,
  project_id: true,
  contact_id: true,
  income_source_id: true,
  invoice_id: true,
  supplier_id: true,
  tags: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.transactionsSelect;

export const personalTransactionsService = new PersonalTransactionsService(prisma);
