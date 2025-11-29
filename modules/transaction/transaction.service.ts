// FILE: src/modules/transaction/transaction.service.ts
import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  AccountId,
  BusinessId,
  TransactionId,
  UserId,
  normalizeAccountId,
  normalizeBusinessId,
  normalizeTransactionId,
  normalizeUserId,
  normalizeCategoryId,
  normalizeProjectId,
} from '@/modules/shared/ids';
import { AccountOwnershipError, ProjectOwnershipError } from '@/modules/shared/errors';
import {
  assertAccountOwnedByUser,
  assertBusinessOwnedByUser,
  assertUserExists,
  assertCategoryOwnedByUser,
  assertContactOwnedByUser,
  assertIncomeSourceOwnedByUser,
  assertSupplierOwnedByUser,
  assertInvoiceOwnedByUser,
  assertRecurringSeriesOwnedByUser,
} from '@/modules/shared/assertions';

export type TransactionDirection = 'in' | 'out';
export type TransactionKind = string;

export interface CreatePersonalTransactionInput {
  userId: UserId;
  accountId: AccountId;
  date: Date | string;
  amount: number;
  direction: TransactionDirection;
  label: string;
  type?: TransactionKind;
  rawLabel?: string | null;
  categoryId?: bigint | number | null;
  projectId?: bigint | number | null;
  contactId?: bigint | number | null;
  incomeSourceId?: bigint | number | null;
  invoiceId?: bigint | number | null;
  supplierId?: bigint | number | null;
  notes?: string | null;
  tags?: string | null;
  isRecurring?: boolean;
  recurringSeriesId?: bigint | number | null;
}

export interface CreateBusinessTransactionInput
  extends Omit<CreatePersonalTransactionInput, 'accountId'> {
  userId: UserId;
  businessId: BusinessId;
  accountId: AccountId;
}

export interface CreateTransferInput {
  userId: UserId;
  fromAccountId: AccountId;
  toAccountId: AccountId;
  date: Date | string;
  amount: number;
  label?: string;
  notes?: string | null;
  tags?: string | null;
}

export interface UpdateTransactionInput {
  date?: Date | string;
  amount?: number;
  direction?: TransactionDirection;
  type?: TransactionKind;
  label?: string;
  rawLabel?: string | null;
  categoryId?: bigint | number | null;
  projectId?: bigint | number | null;
  contactId?: bigint | number | null;
  incomeSourceId?: bigint | number | null;
  invoiceId?: bigint | number | null;
  supplierId?: bigint | number | null;
  notes?: string | null;
  tags?: string | null;
  isRecurring?: boolean;
  recurringSeriesId?: bigint | number | null;
}

export interface TransactionFilterOptions {
  fromDate?: Date | string;
  toDate?: Date | string;
  direction?: TransactionDirection;
  minAmount?: number;
  maxAmount?: number;
  categoryId?: bigint | number;
  accountIds?: (bigint | number)[];
  businessId?: BusinessId | null;
  projectId?: bigint | number | null;
  limit?: number;
  offset?: number;
}

export type TransactionSummary = Prisma.transactionsGetPayload<{
  select: {
    id: true;
    user_id: true;
    business_id: true;
    account_id: true;
    date: true;
    amount: true;
    direction: true;
    type: true;
    label: true;
    raw_label: true;
    category_id: true;
    project_id: true;
    contact_id: true;
    income_source_id: true;
    invoice_id: true;
    supplier_id: true;
    notes: true;
    tags: true;
    is_recurring: true;
    recurring_series_id: true;
    created_at: true;
    updated_at: true;
  };
}>;

export class TransactionNotFoundError extends Error {
  constructor(message = 'Transaction not found') {
    super(message);
    this.name = 'TransactionNotFoundError';
  }
}

export class TransactionOwnershipError extends Error {
  constructor(message = 'User does not own this transaction') {
    super(message);
    this.name = 'TransactionOwnershipError';
  }
}

export class InvalidTransactionInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTransactionInputError';
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
  raw_label: true,
  category_id: true,
  project_id: true,
  contact_id: true,
  income_source_id: true,
  invoice_id: true,
  supplier_id: true,
  notes: true,
  tags: true,
  is_recurring: true,
  recurring_series_id: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.transactionsSelect;

function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').slice(0, 255);
}

function normalizeRawLabel(rawLabel?: string | null): string | null {
  if (rawLabel == null) return null;
  return rawLabel.trim().replace(/\s+/g, ' ').slice(0, 255);
}

function validateAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0 || amount >= 1e12) {
    throw new InvalidTransactionInputError('Amount must be > 0 and reasonable');
  }
}

function validateDirection(direction: TransactionDirection) {
  if (direction !== 'in' && direction !== 'out') {
    throw new InvalidTransactionInputError('Direction must be "in" or "out"');
  }
}

function validateType(type?: TransactionKind) {
  if (type === undefined) return;
  const trimmed = type.trim();
  if (trimmed.length === 0 || trimmed.length > 30) {
    throw new InvalidTransactionInputError('Type must be 1-30 characters');
  }
}

function parseDateToDateOnly(date: Date | string): Date {
  const parsed = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(parsed.getTime())) {
    throw new InvalidTransactionInputError('Invalid date');
  }
  return parsed;
}

export class TransactionService {
  constructor(private readonly prismaClient: PrismaClient) {}

  /**
   * Validate project ownership + personal/business coherence for a transaction.
   * - user must own the project
   * - if tx is personal (txBusinessId = null) → project.business_id must be null
   * - if tx is business (txBusinessId != null) → project.business_id is null or equals txBusinessId
   * Returns the normalized project id.
   */
  private async validateProjectForTransaction(
    userId: bigint,
    projectId: bigint,
    txBusinessId: bigint | null
  ): Promise<bigint> {
    const project = await this.prismaClient.project.findUnique({
      where: { id: projectId },
      select: { id: true, user_id: true, business_id: true },
    });

    if (!project || project.user_id !== userId) {
      throw new ProjectOwnershipError();
    }

    if (txBusinessId === null) {
      // personal transaction: project must not belong to a business
      if (project.business_id !== null) {
        throw new ProjectOwnershipError(
          'Project belongs to a business, use createBusinessTransaction for this project'
        );
      }
    } else {
      // business transaction: project may be generic (null) or belong to this business, but not another one
      if (project.business_id !== null && project.business_id !== txBusinessId) {
        throw new ProjectOwnershipError('Project belongs to a different business');
      }
    }

    return project.id;
  }

  async createPersonalTransaction(input: CreatePersonalTransactionInput): Promise<TransactionSummary> {
    const userId = normalizeUserId(input.userId);
    const accountId = normalizeAccountId(input.accountId);
    const date = parseDateToDateOnly(input.date);
    const label = normalizeLabel(input.label);
    const rawLabel = normalizeRawLabel(input.rawLabel ?? null);

    validateAmount(input.amount);
    validateDirection(input.direction);
    validateType(input.type);
    await assertUserExists(this.prismaClient, userId);
    const account = await assertAccountOwnedByUser(this.prismaClient, accountId, userId);
    if (account.business_id !== null) {
      throw new AccountOwnershipError('Personal transaction must use a personal account (no business_id)');
    }

    // --- related entities / ownership ---
    let categoryId: bigint | null = null;
    if (input.categoryId !== undefined && input.categoryId !== null) {
      const category = await assertCategoryOwnedByUser(this.prismaClient, input.categoryId, userId);
      categoryId = category.id;
    }

    let projectId: bigint | null = null;
    if (input.projectId !== undefined && input.projectId !== null) {
      const normalizedProjectId = normalizeProjectId(input.projectId);
      projectId = await this.validateProjectForTransaction(userId, normalizedProjectId, null);
    }

    let contactId: bigint | null = null;
    if (input.contactId !== undefined && input.contactId !== null) {
      const contact = await assertContactOwnedByUser(this.prismaClient, input.contactId, userId);
      contactId = contact.id;
    }

    let incomeSourceId: bigint | null = null;
    if (input.incomeSourceId !== undefined && input.incomeSourceId !== null) {
      const incomeSource = await assertIncomeSourceOwnedByUser(
        this.prismaClient,
        input.incomeSourceId,
        userId
      );
      incomeSourceId = incomeSource.id;
    }

    let invoiceId: bigint | null = null;
    if (input.invoiceId !== undefined && input.invoiceId !== null) {
      const invoice = await assertInvoiceOwnedByUser(this.prismaClient, input.invoiceId, userId);
      invoiceId = invoice.id;
    }

    let supplierId: bigint | null = null;
    if (input.supplierId !== undefined && input.supplierId !== null) {
      const supplier = await assertSupplierOwnedByUser(this.prismaClient, input.supplierId, userId);
      supplierId = supplier.id;
    }

    let recurringSeriesId: bigint | null = null;
    if (input.recurringSeriesId !== undefined && input.recurringSeriesId !== null) {
      const series = await assertRecurringSeriesOwnedByUser(
        this.prismaClient,
        input.recurringSeriesId,
        userId
      );
      recurringSeriesId = series.id;
    }

    const tx = await this.prismaClient.transactions.create({
      data: {
        user_id: userId,
        business_id: null,
        account_id: accountId,
        date,
        amount: input.amount,
        direction: input.direction,
        type: input.type?.trim() || 'other',
        label,
        raw_label: rawLabel,
        category_id: categoryId,
        project_id: projectId,
        contact_id: contactId,
        income_source_id: incomeSourceId,
        invoice_id: invoiceId,
        supplier_id: supplierId,
        notes: input.notes ?? null,
        tags: input.tags ?? null,
        is_recurring: input.isRecurring ?? false,
        recurring_series_id: recurringSeriesId,
      },
      select: transactionSelect,
    });

    return tx;
  }

  async createBusinessTransaction(input: CreateBusinessTransactionInput): Promise<TransactionSummary> {
    const userId = normalizeUserId(input.userId);
    const businessId = normalizeBusinessId(input.businessId);
    const accountId = normalizeAccountId(input.accountId);
    const date = parseDateToDateOnly(input.date);
    const label = normalizeLabel(input.label);
    const rawLabel = normalizeRawLabel(input.rawLabel ?? null);

    validateAmount(input.amount);
    validateDirection(input.direction);
    validateType(input.type);
    await assertUserExists(this.prismaClient, userId);
    await assertBusinessOwnedByUser(this.prismaClient, businessId, userId);
    const account = await assertAccountOwnedByUser(this.prismaClient, accountId, userId);
    if (account.business_id !== businessId) {
      throw new AccountOwnershipError('Account does not belong to this business');
    }

    // --- related entities / ownership ---
    let categoryId: bigint | null = null;
    if (input.categoryId !== undefined && input.categoryId !== null) {
      const category = await assertCategoryOwnedByUser(this.prismaClient, input.categoryId, userId);
      categoryId = category.id;
    }

    let projectId: bigint | null = null;
    if (input.projectId !== undefined && input.projectId !== null) {
      const normalizedProjectId = normalizeProjectId(input.projectId);
      projectId = await this.validateProjectForTransaction(userId, normalizedProjectId, businessId);
    }

    let contactId: bigint | null = null;
    if (input.contactId !== undefined && input.contactId !== null) {
      const contact = await assertContactOwnedByUser(this.prismaClient, input.contactId, userId);
      contactId = contact.id;
    }

    let incomeSourceId: bigint | null = null;
    if (input.incomeSourceId !== undefined && input.incomeSourceId !== null) {
      const incomeSource = await assertIncomeSourceOwnedByUser(
        this.prismaClient,
        input.incomeSourceId,
        userId
      );
      incomeSourceId = incomeSource.id;
    }

    let invoiceId: bigint | null = null;
    if (input.invoiceId !== undefined && input.invoiceId !== null) {
      const invoice = await assertInvoiceOwnedByUser(this.prismaClient, input.invoiceId, userId);
      invoiceId = invoice.id;
    }

    let supplierId: bigint | null = null;
    if (input.supplierId !== undefined && input.supplierId !== null) {
      const supplier = await assertSupplierOwnedByUser(this.prismaClient, input.supplierId, userId);
      supplierId = supplier.id;
    }

    let recurringSeriesId: bigint | null = null;
    if (input.recurringSeriesId !== undefined && input.recurringSeriesId !== null) {
      const series = await assertRecurringSeriesOwnedByUser(
        this.prismaClient,
        input.recurringSeriesId,
        userId
      );
      recurringSeriesId = series.id;
    }

    const tx = await this.prismaClient.transactions.create({
      data: {
        user_id: userId,
        business_id: businessId,
        account_id: accountId,
        date,
        amount: input.amount,
        direction: input.direction,
        type: input.type?.trim() || 'other',
        label,
        raw_label: rawLabel,
        category_id: categoryId,
        project_id: projectId,
        contact_id: contactId,
        income_source_id: incomeSourceId,
        invoice_id: invoiceId,
        supplier_id: supplierId,
        notes: input.notes ?? null,
        tags: input.tags ?? null,
        is_recurring: input.isRecurring ?? false,
        recurring_series_id: recurringSeriesId,
      },
      select: transactionSelect,
    });

    return tx;
  }

  async createTransfer(input: CreateTransferInput): Promise<{ from: TransactionSummary; to: TransactionSummary }> {
    const userId = normalizeUserId(input.userId);
    const fromAccountId = normalizeAccountId(input.fromAccountId);
    const toAccountId = normalizeAccountId(input.toAccountId);
    const date = parseDateToDateOnly(input.date);
    const label = normalizeLabel(input.label ?? 'Internal transfer');

    validateAmount(input.amount);
    await assertUserExists(this.prismaClient, userId);
    const fromAccount = await assertAccountOwnedByUser(this.prismaClient, fromAccountId, userId);
    const toAccount = await assertAccountOwnedByUser(this.prismaClient, toAccountId, userId);

    const [from, to] = await this.prismaClient.$transaction([
      this.prismaClient.transactions.create({
        data: {
          user_id: userId,
          business_id: fromAccount.business_id,
          account_id: fromAccountId,
          date,
          amount: input.amount,
          direction: 'out',
          type: 'transfer',
          label,
          raw_label: null,
          category_id: null,
          project_id: null,
          contact_id: null,
          income_source_id: null,
          invoice_id: null,
          supplier_id: null,
          notes: input.notes ?? null,
          tags: input.tags ?? null,
          is_recurring: false,
          recurring_series_id: null,
        },
        select: transactionSelect,
      }),
      this.prismaClient.transactions.create({
        data: {
          user_id: userId,
          business_id: toAccount.business_id,
          account_id: toAccountId,
          date,
          amount: input.amount,
          direction: 'in',
          type: 'transfer',
          label,
          raw_label: null,
          category_id: null,
          project_id: null,
          contact_id: null,
          income_source_id: null,
          invoice_id: null,
          supplier_id: null,
          notes: input.notes ?? null,
          tags: input.tags ?? null,
          is_recurring: false,
          recurring_series_id: null,
        },
        select: transactionSelect,
      }),
    ]);

    return { from, to };
  }

  async getTransactionForUser(
    transactionIdInput: TransactionId,
    userIdInput: UserId
  ): Promise<TransactionSummary> {
    const transactionId = normalizeTransactionId(transactionIdInput);
    const userId = normalizeUserId(userIdInput);

    const tx = await this.prismaClient.transactions.findUnique({
      where: { id: transactionId },
      select: transactionSelect,
    });

    if (!tx) {
      throw new TransactionNotFoundError();
    }

    if (tx.user_id !== userId) {
      throw new TransactionOwnershipError();
    }

    return tx;
  }

  async listTransactionsForAccount(
    userIdInput: UserId,
    accountIdInput: AccountId,
    filters?: TransactionFilterOptions
  ): Promise<TransactionSummary[]> {
    const userId = normalizeUserId(userIdInput);
    const accountId = normalizeAccountId(accountIdInput);

    await assertAccountOwnedByUser(this.prismaClient, accountId, userId);

    const where: Prisma.transactionsWhereInput = {
      user_id: userId,
      account_id: accountId,
    };

    this.applyFiltersToWhere(where, filters);

    const limit = filters?.limit && filters.limit > 0 ? Math.min(filters.limit, 1000) : 100;
    const offset = filters?.offset ?? 0;

    const txs = await this.prismaClient.transactions.findMany({
      where,
      select: transactionSelect,
      orderBy: [{ date: 'asc' }, { created_at: 'asc' }],
      take: limit,
      skip: offset,
    });

    return txs;
  }

  async listTransactionsForUser(
    userIdInput: UserId,
    filters?: TransactionFilterOptions
  ): Promise<TransactionSummary[]> {
    const userId = normalizeUserId(userIdInput);

    const where: Prisma.transactionsWhereInput = {
      user_id: userId,
    };

    if (filters?.businessId !== undefined) {
      if (filters.businessId === null) {
        where.business_id = null;
      } else {
        where.business_id = normalizeBusinessId(filters.businessId);
      }
    }

    if (filters?.accountIds && filters.accountIds.length > 0) {
      where.account_id = { in: filters.accountIds.map((id) => normalizeAccountId(id)) };
    }

    this.applyFiltersToWhere(where, filters);

    const limit = filters?.limit && filters.limit > 0 ? Math.min(filters.limit, 1000) : 100;
    const offset = filters?.offset ?? 0;

    const txs = await this.prismaClient.transactions.findMany({
      where,
      select: transactionSelect,
      orderBy: [{ date: 'asc' }, { created_at: 'asc' }],
      take: limit,
      skip: offset,
    });

    return txs;
  }

  async updateTransaction(
    transactionIdInput: TransactionId,
    userIdInput: UserId,
    input: UpdateTransactionInput
  ): Promise<TransactionSummary> {
    const transactionId = normalizeTransactionId(transactionIdInput);
    const userId = normalizeUserId(userIdInput);

    const existing = await this.prismaClient.transactions.findUnique({
      where: { id: transactionId },
      select: transactionSelect,
    });

    if (!existing) {
      throw new TransactionNotFoundError();
    }

    if (existing.user_id !== userId) {
      throw new TransactionOwnershipError();
    }

    const data: Prisma.transactionsUncheckedUpdateInput = {};

    if (input.date !== undefined) {
      data.date = parseDateToDateOnly(input.date);
    }
    if (input.amount !== undefined) {
      validateAmount(input.amount);
      data.amount = input.amount;
    }
    if (input.direction !== undefined) {
      validateDirection(input.direction);
      data.direction = input.direction;
    }
    if (input.type !== undefined) {
      validateType(input.type);
      data.type = input.type.trim();
    }
    if (input.label !== undefined) {
      data.label = normalizeLabel(input.label);
    }
    if (input.rawLabel !== undefined) {
      data.raw_label = normalizeRawLabel(input.rawLabel);
    }

    // Relations with ownership checks & proper null / undefined semantics
    if (input.categoryId !== undefined) {
      if (input.categoryId === null) {
        data.category_id = null;
      } else {
        const category = await assertCategoryOwnedByUser(this.prismaClient, input.categoryId, userId);
        data.category_id = category.id;
      }
    }

    if (input.projectId !== undefined) {
      if (input.projectId === null) {
        data.project_id = null;
      } else {
        const normalizedProjectId = normalizeProjectId(input.projectId);
        const projectId = await this.validateProjectForTransaction(
          userId,
          normalizedProjectId,
          existing.business_id
        );
        data.project_id = projectId;
      }
    }

    if (input.contactId !== undefined) {
      if (input.contactId === null) {
        data.contact_id = null;
      } else {
        const contact = await assertContactOwnedByUser(this.prismaClient, input.contactId, userId);
        data.contact_id = contact.id;
      }
    }

    if (input.incomeSourceId !== undefined) {
      if (input.incomeSourceId === null) {
        data.income_source_id = null;
      } else {
        const incomeSource = await assertIncomeSourceOwnedByUser(
          this.prismaClient,
          input.incomeSourceId,
          userId
        );
        data.income_source_id = incomeSource.id;
      }
    }

    if (input.invoiceId !== undefined) {
      if (input.invoiceId === null) {
        data.invoice_id = null;
      } else {
        const invoice = await assertInvoiceOwnedByUser(this.prismaClient, input.invoiceId, userId);
        data.invoice_id = invoice.id;
      }
    }

    if (input.supplierId !== undefined) {
      if (input.supplierId === null) {
        data.supplier_id = null;
      } else {
        const supplier = await assertSupplierOwnedByUser(this.prismaClient, input.supplierId, userId);
        data.supplier_id = supplier.id;
      }
    }

    if (input.notes !== undefined) {
      data.notes = input.notes ?? null;
    }
    if (input.tags !== undefined) {
      data.tags = input.tags ?? null;
    }
    if (input.isRecurring !== undefined) {
      data.is_recurring = input.isRecurring;
    }

    if (input.recurringSeriesId !== undefined) {
      if (input.recurringSeriesId === null) {
        data.recurring_series_id = null;
      } else {
        const series = await assertRecurringSeriesOwnedByUser(
          this.prismaClient,
          input.recurringSeriesId,
          userId
        );
        data.recurring_series_id = series.id;
      }
    }

    if (Object.keys(data).length === 0) {
      return this.getTransactionForUser(transactionId, userId);
    }

    try {
      const updated = await this.prismaClient.transactions.update({
        where: { id: transactionId },
        data,
        select: transactionSelect,
      });

      return updated;
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new TransactionNotFoundError();
      }
      throw err;
    }
  }

  async deleteTransactionForUser(
    transactionIdInput: TransactionId,
    userIdInput: UserId
  ): Promise<void> {
    const transactionId = normalizeTransactionId(transactionIdInput);
    const userId = normalizeUserId(userIdInput);

    const existing = await this.prismaClient.transactions.findUnique({
      where: { id: transactionId },
      select: { id: true, user_id: true },
    });

    if (!existing) {
      throw new TransactionNotFoundError();
    }

    if (existing.user_id !== userId) {
      throw new TransactionOwnershipError();
    }

    try {
      await this.prismaClient.transactions.delete({
        where: { id: transactionId },
      });
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new TransactionNotFoundError();
      }
      throw err;
    }
  }

  private applyFiltersToWhere(
    where: Prisma.transactionsWhereInput,
    filters?: TransactionFilterOptions
  ) {
    if (!filters) return;
    if (filters.fromDate) {
      where.date = { ...(where.date as any), gte: parseDateToDateOnly(filters.fromDate) };
    }
    if (filters.toDate) {
      where.date = { ...(where.date as any), lte: parseDateToDateOnly(filters.toDate) };
    }
    if (filters.direction) {
      validateDirection(filters.direction);
      where.direction = filters.direction;
    }
    if (filters.minAmount !== undefined) {
      where.amount = { ...(where.amount as any), gte: filters.minAmount };
    }
    if (filters.maxAmount !== undefined) {
      where.amount = { ...(where.amount as any), lte: filters.maxAmount };
    }
    if (filters.categoryId !== undefined) {
      where.category_id = normalizeCategoryId(filters.categoryId as any);
    }
    if (filters.projectId !== undefined) {
      where.project_id =
        filters.projectId === null ? null : normalizeProjectId(filters.projectId);
    }
  }
}

export const transactionService = new TransactionService(prisma);