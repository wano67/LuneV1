import { PrismaClient } from '@prisma/client';
import {
  normalizeAccountId,
  normalizeBusinessId,
  normalizeUserId,
  AccountId,
  BusinessId,
  UserId,
  normalizeCategoryId,
  normalizeProjectId,
} from './ids';
import {
  AccountNotFoundError,
  AccountOwnershipError,
  BusinessNotFoundError,
  BusinessOwnershipError,
  CategoryOwnershipError,
  ContactOwnershipError,
  IncomeSourceOwnershipError,
  SupplierOwnershipError,
  InvoiceOwnershipError,
  RecurringSeriesOwnershipError,
  UserNotFoundError,
  ProjectNotFoundError,
  ProjectOwnershipError,
} from './errors';

const toBigInt = (value: number | bigint): bigint => (typeof value === 'bigint' ? value : BigInt(value));

export async function assertUserExists(prismaClient: PrismaClient, userIdInput: UserId) {
  const userId = normalizeUserId(userIdInput);
  const user = await prismaClient.users.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) throw new UserNotFoundError();
  return user;
}

export async function assertBusinessOwnedByUser(
  prismaClient: PrismaClient,
  businessIdInput: BusinessId,
  userIdInput: UserId
) {
  const businessId = normalizeBusinessId(businessIdInput);
  const userId = normalizeUserId(userIdInput);

  const business = await prismaClient.businesses.findUnique({
    where: { id: businessId },
    select: { id: true, user_id: true, currency: true },
  });

  if (!business) throw new BusinessNotFoundError();
  if (business.user_id !== userId) throw new BusinessOwnershipError();

  return business;
}

export async function assertProjectOwnedByUser(
  prismaClient: PrismaClient,
  projectIdInput: number | bigint,
  userIdInput: UserId
) {
  const projectId = normalizeProjectId(projectIdInput as any);
  const userId = normalizeUserId(userIdInput);

  const project = await prismaClient.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      user_id: true,
      business_id: true,
      name: true,
      status: true,
      start_date: true,
      due_date: true,
      completed_at: true,
      progress_auto_mode: true,
      budget_amount: true,
      progress_manual_pct: true,
    },
  });

  if (!project) throw new ProjectNotFoundError();
  if (project.user_id !== userId) throw new ProjectOwnershipError();

  return project;
}

export async function assertAccountOwnedByUser(
  prismaClient: PrismaClient,
  accountIdInput: AccountId,
  userIdInput: UserId
) {
  const accountId = normalizeAccountId(accountIdInput);
  const userId = normalizeUserId(userIdInput);

  const account = await prismaClient.accounts.findUnique({
    where: { id: accountId },
    select: { id: true, user_id: true, business_id: true, currency: true },
  });

  if (!account) throw new AccountNotFoundError();
  if (account.user_id !== userId) throw new AccountOwnershipError();

  return account;
}

export async function assertCategoryOwnedByUser(
  prismaClient: PrismaClient,
  categoryIdInput: number | bigint,
  userIdInput: UserId
) {
  const categoryId = normalizeCategoryId(categoryIdInput as any);
  const userId = normalizeUserId(userIdInput);

  const category = await prismaClient.categories.findUnique({
    where: { id: categoryId },
    select: { id: true, user_id: true },
  });

  if (!category || category.user_id !== userId) throw new CategoryOwnershipError();
  return category;
}

export async function assertContactOwnedByUser(
  prismaClient: PrismaClient,
  contactIdInput: number | bigint,
  userIdInput: UserId
) {
  const contactId = toBigInt(contactIdInput);
  const userId = normalizeUserId(userIdInput);

  const contact = await prismaClient.contacts.findUnique({
    where: { id: contactId },
    select: { id: true, user_id: true },
  });

  if (!contact || contact.user_id !== userId) throw new ContactOwnershipError();
  return contact;
}

export async function assertIncomeSourceOwnedByUser(
  prismaClient: PrismaClient,
  incomeSourceIdInput: number | bigint,
  userIdInput: UserId
) {
  const incomeSourceId = toBigInt(incomeSourceIdInput);
  const userId = normalizeUserId(userIdInput);

  const incomeSource = await prismaClient.income_sources.findUnique({
    where: { id: incomeSourceId },
    select: { id: true, user_id: true },
  });

  if (!incomeSource || incomeSource.user_id !== userId) throw new IncomeSourceOwnershipError();
  return incomeSource;
}

export async function assertSupplierOwnedByUser(
  prismaClient: PrismaClient,
  supplierIdInput: number | bigint,
  userIdInput: UserId
) {
  const supplierId = toBigInt(supplierIdInput);
  const userId = normalizeUserId(userIdInput);

  const supplier = await prismaClient.suppliers.findUnique({
    where: { id: supplierId },
    select: { id: true, businesses: { select: { user_id: true } } },
  });

  if (!supplier || supplier.businesses?.user_id !== userId) throw new SupplierOwnershipError();
  return supplier;
}

export async function assertInvoiceOwnedByUser(
  prismaClient: PrismaClient,
  invoiceIdInput: number | bigint,
  userIdInput: UserId
) {
  const invoiceId = toBigInt(invoiceIdInput);
  const userId = normalizeUserId(userIdInput);

  const invoice = await prismaClient.invoices.findUnique({
    where: { id: invoiceId },
    select: { id: true, businesses: { select: { user_id: true } } },
  });

  if (!invoice || invoice.businesses?.user_id !== userId) throw new InvoiceOwnershipError();
  return invoice;
}

export async function assertRecurringSeriesOwnedByUser(
  prismaClient: PrismaClient,
  seriesIdInput: number | bigint,
  userIdInput: UserId
) {
  const seriesId = toBigInt(seriesIdInput);
  const userId = normalizeUserId(userIdInput);

  const series = await prismaClient.recurring_series.findUnique({
    where: { id: seriesId },
    select: { id: true, user_id: true },
  });

  if (!series || series.user_id !== userId) throw new RecurringSeriesOwnershipError();
  return series;
}
