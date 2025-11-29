import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  AccountId,
  BusinessId,
  UserId,
  normalizeAccountId,
  normalizeBusinessId,
  normalizeUserId,
} from '@/modules/shared/ids';
import { AccountNotFoundError, AccountOwnershipError } from '@/modules/shared/errors';
import { assertBusinessOwnedByUser, assertUserExists } from '@/modules/shared/assertions';

export type AccountType = 'current' | 'savings' | 'investment' | 'cash' | 'other';
export type ConnectionType = 'manual' | 'aggregator' | 'api';

export interface CreatePersonalAccountInput {
  userId: UserId;
  name: string;
  type: AccountType;
  currency: string;
  provider?: string | null;
  includeInBudget?: boolean;
  includeInNetWorth?: boolean;
  connectionType?: ConnectionType | null;
}

export interface CreateBusinessAccountInput {
  userId: UserId;
  businessId: BusinessId;
  name: string;
  type: AccountType;
  currency?: string | null;
  provider?: string | null;
  includeInBudget?: boolean;
  includeInNetWorth?: boolean;
  connectionType?: ConnectionType | null;
}

export interface UpdateAccountInput {
  name?: string;
  type?: AccountType;
  currency?: string;
  provider?: string | null;
  isActive?: boolean;
  includeInBudget?: boolean;
  includeInNetWorth?: boolean;
  connectionType?: ConnectionType | null;
}

export type AccountSummary = Prisma.accountsGetPayload<{
  select: {
    id: true;
    user_id: true;
    business_id: true;
    name: true;
    type: true;
    currency: true;
    provider: true;
    is_active: true;
    include_in_budget: true;
    include_in_net_worth: true;
    connection_type: true;
    created_at: true;
    updated_at: true;
  };
}>;

export class InvalidAccountInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAccountInputError';
  }
}

const accountSelect = {
  id: true,
  user_id: true,
  business_id: true,
  name: true,
  type: true,
  currency: true,
  provider: true,
  is_active: true,
  include_in_budget: true,
  include_in_net_worth: true,
  connection_type: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.accountsSelect;

function normalizeAccountName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

function validateAccountType(type: AccountType) {
  const allowed: AccountType[] = ['current', 'savings', 'investment', 'cash', 'other'];
  if (!allowed.includes(type)) {
    throw new InvalidAccountInputError('Invalid account type');
  }
}

function validateConnectionType(connectionType?: ConnectionType | null) {
  if (connectionType == null) return;
  const allowed: ConnectionType[] = ['manual', 'aggregator', 'api'];
  if (!allowed.includes(connectionType)) {
    throw new InvalidAccountInputError('Invalid connection type');
  }
}

function validateCurrency(currency: string) {
  const trimmed = currency.trim();
  if (!trimmed || trimmed.length > 10) {
    throw new InvalidAccountInputError('Invalid currency');
  }
}

export class AccountService {
  constructor(private readonly prismaClient: PrismaClient) {}

  /**
   * Return account with signed balance (in minus out) for the given user.
   */
  async getAccountWithBalanceForUser(
    accountIdInput: AccountId,
    userIdInput: UserId
  ): Promise<{ account: AccountSummary; balance: number }> {
    const accountId = normalizeAccountId(accountIdInput);
    const userId = normalizeUserId(userIdInput);

    const account = await this.prismaClient.accounts.findUnique({
      where: { id: accountId },
      select: accountSelect,
    });

    if (!account) throw new AccountNotFoundError();
    if (account.user_id !== userId) throw new AccountOwnershipError();

    const txSums = await this.prismaClient.transactions.groupBy({
      by: ['account_id', 'direction'],
      where: { account_id: accountId },
      _sum: { amount: true },
    });

    const balance = txSums.reduce((sum, row) => {
      const amt = Number(row._sum.amount ?? 0);
      return sum + (row.direction === 'in' ? amt : -amt);
    }, 0);

    return { account, balance };
  }

  /**
   * List personal accounts (business_id null) with balances for the given user.
   */
  async listPersonalAccountsWithBalanceForUser(
    userIdInput: UserId,
    filters?: { includeInactive?: boolean }
  ): Promise<Array<{ account: AccountSummary; balance: number }>> {
    const userId = normalizeUserId(userIdInput);

    const accounts = await this.prismaClient.accounts.findMany({
      where: {
        user_id: userId,
        business_id: null,
        ...(filters?.includeInactive ? {} : { is_active: true }),
      },
      select: accountSelect,
      orderBy: { created_at: 'asc' },
    });

    if (accounts.length === 0) return [];

    const accountIds = accounts.map((a) => a.id);

    const txSums = await this.prismaClient.transactions.groupBy({
      by: ['account_id', 'direction'],
      where: { account_id: { in: accountIds } },
      _sum: { amount: true },
    });

    const balanceMap = new Map<bigint, number>();
    txSums.forEach((row) => {
      const amt = Number(row._sum.amount ?? 0);
      const delta = row.direction === 'in' ? amt : -amt;
      balanceMap.set(row.account_id, (balanceMap.get(row.account_id) ?? 0) + delta);
    });

    return accounts.map((account) => ({
      account,
      balance: balanceMap.get(account.id) ?? 0,
    }));
  }

  async createPersonalAccount(input: CreatePersonalAccountInput): Promise<AccountSummary> {
    const userId = normalizeUserId(input.userId);
    const name = normalizeAccountName(input.name);

    validateAccountType(input.type);
    validateConnectionType(input.connectionType ?? 'manual');
    validateCurrency(input.currency);
    await assertUserExists(this.prismaClient, userId);

    const account = await this.prismaClient.accounts.create({
      data: {
        user_id: userId,
        business_id: null,
        name,
        type: input.type,
        currency: input.currency.trim(),
        provider: input.provider ?? null,
        is_active: true,
        include_in_budget: input.includeInBudget ?? true,
        include_in_net_worth: input.includeInNetWorth ?? true,
        connection_type: input.connectionType ?? 'manual',
      },
      select: accountSelect,
    });

    return account;
  }

  async createBusinessAccount(input: CreateBusinessAccountInput): Promise<AccountSummary> {
    const userId = normalizeUserId(input.userId);
    const businessId = normalizeBusinessId(input.businessId);
    const name = normalizeAccountName(input.name);

    validateAccountType(input.type);
    validateConnectionType(input.connectionType ?? 'manual');
    await assertUserExists(this.prismaClient, userId);
    const business = await assertBusinessOwnedByUser(this.prismaClient, businessId, userId);

    const currency =
      input.currency?.trim() && input.currency.trim().length > 0
        ? input.currency.trim()
        : business.currency ?? 'EUR';
    validateCurrency(currency);

    const account = await this.prismaClient.accounts.create({
      data: {
        user_id: userId,
        business_id: businessId,
        name,
        type: input.type,
        currency,
        provider: input.provider ?? null,
        is_active: true,
        include_in_budget: input.includeInBudget ?? true,
        include_in_net_worth: input.includeInNetWorth ?? true,
        connection_type: input.connectionType ?? 'manual',
      },
      select: accountSelect,
    });

    return account;
  }

  async getAccountForUser(accountIdInput: AccountId, userIdInput: UserId): Promise<AccountSummary> {
    const accountId = normalizeAccountId(accountIdInput);
    const userId = normalizeUserId(userIdInput);

    const account = await this.prismaClient.accounts.findUnique({
      where: { id: accountId },
      select: accountSelect,
    });

    if (!account) {
      throw new AccountNotFoundError();
    }

    if (account.user_id !== userId) {
      throw new AccountOwnershipError();
    }

    return account;
  }

  async listPersonalAccountsForUser(
    userIdInput: UserId,
    options?: {
      includeInactive?: boolean;
      includeExcludedFromBudget?: boolean;
      includeExcludedFromNetWorth?: boolean;
    }
  ): Promise<AccountSummary[]> {
    const userId = normalizeUserId(userIdInput);

    const accounts = await this.prismaClient.accounts.findMany({
      where: {
        user_id: userId,
        business_id: null,
        ...(options?.includeInactive ? {} : { is_active: true }),
        ...(options?.includeExcludedFromBudget ? {} : { include_in_budget: true }),
        ...(options?.includeExcludedFromNetWorth ? {} : { include_in_net_worth: true }),
      },
      select: accountSelect,
      orderBy: { created_at: 'asc' },
    });

    return accounts;
  }

  async listBusinessAccountsForUser(
    userIdInput: UserId,
    businessIdInput: BusinessId,
    options?: {
      includeInactive?: boolean;
      includeExcludedFromBudget?: boolean;
      includeExcludedFromNetWorth?: boolean;
    }
  ): Promise<AccountSummary[]> {
    const userId = normalizeUserId(userIdInput);
    const businessId = normalizeBusinessId(businessIdInput);

    await assertBusinessOwnedByUser(this.prismaClient, businessId, userId);

    const accounts = await this.prismaClient.accounts.findMany({
      where: {
        user_id: userId,
        business_id: businessId,
        ...(options?.includeInactive ? {} : { is_active: true }),
        ...(options?.includeExcludedFromBudget ? {} : { include_in_budget: true }),
        ...(options?.includeExcludedFromNetWorth ? {} : { include_in_net_worth: true }),
      },
      select: accountSelect,
      orderBy: { created_at: 'asc' },
    });

    return accounts;
  }

  async updateAccount(
    accountIdInput: AccountId,
    userIdInput: UserId,
    input: UpdateAccountInput
  ): Promise<AccountSummary> {
    const accountId = normalizeAccountId(accountIdInput);
    const userId = normalizeUserId(userIdInput);

    const account = await this.prismaClient.accounts.findUnique({
      where: { id: accountId },
      select: accountSelect,
    });

    if (!account) {
      throw new AccountNotFoundError();
    }

    if (account.user_id !== userId) {
      throw new AccountOwnershipError();
    }

    const data: Prisma.accountsUpdateInput = {};

    if (input.name !== undefined) {
      data.name = normalizeAccountName(input.name);
    }
    if (input.type !== undefined) {
      validateAccountType(input.type);
      data.type = input.type;
    }
    if (input.currency !== undefined) {
      validateCurrency(input.currency);
      data.currency = input.currency.trim();
    }
    if (input.provider !== undefined) {
      data.provider = input.provider;
    }
    if (input.isActive !== undefined) {
      data.is_active = input.isActive;
    }
    if (input.includeInBudget !== undefined) {
      data.include_in_budget = input.includeInBudget;
    }
    if (input.includeInNetWorth !== undefined) {
      data.include_in_net_worth = input.includeInNetWorth;
    }
    if (input.connectionType !== undefined) {
      validateConnectionType(input.connectionType);
      data.connection_type = input.connectionType;
    }

    if (Object.keys(data).length === 0) {
      return this.getAccountForUser(accountId, userId);
    }

    try {
      const updated = await this.prismaClient.accounts.update({
        where: { id: accountId },
        data,
        select: accountSelect,
      });

      return updated;
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new AccountNotFoundError();
      }
      throw err;
    }
  }

  async archiveAccount(accountIdInput: AccountId, userIdInput: UserId): Promise<AccountSummary> {
    return this.updateAccount(accountIdInput, userIdInput, { isActive: false });
  }

  async reactivateAccount(accountIdInput: AccountId, userIdInput: UserId): Promise<AccountSummary> {
    return this.updateAccount(accountIdInput, userIdInput, { isActive: true });
  }

  async setBudgetInclusion(
    accountIdInput: AccountId,
    userIdInput: UserId,
    includeInBudget: boolean
  ): Promise<AccountSummary> {
    return this.updateAccount(accountIdInput, userIdInput, { includeInBudget });
  }

  async setNetWorthInclusion(
    accountIdInput: AccountId,
    userIdInput: UserId,
    includeInNetWorth: boolean
  ): Promise<AccountSummary> {
    return this.updateAccount(accountIdInput, userIdInput, { includeInNetWorth });
  }

}

export const accountService = new AccountService(prisma);
