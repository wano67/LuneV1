// src/test/test-db.ts
// End-to-end smoke test for the domain (users, businesses, accounts, transactions, budgets, savings, cashflow, insights).
// Run manually with: `npm run test:db`. This does not replace unit tests.

import { userService } from '@/modules/user/user.service';
import { businessService } from '@/modules/business/business.service';
import { accountService } from '@/modules/account/account.service';
import { transactionService } from '@/modules/transaction/transaction.service';
import { transactionImportService } from '@/modules/transaction/transaction-import.service';
import { budgetService } from '@/modules/budget/budget.service';
import { savingsService } from '@/modules/savings/savings.service';
import { cashflowService } from '@/modules/cashflow/cashflow.service';
import { insightsService } from '@/modules/insights/insights.service';
import { clientService } from '@/modules/client/client.service';
import { servicesService } from '@/modules/service/service.service';
import { projectsService } from '@/modules/project/project.service';
import { projectTaskService } from '@/modules/project/project-task.service';
import { projectMilestoneService } from '@/modules/project/project-milestone.service';
import { prisma } from '@/lib/prisma';

async function main() {
  console.log(
    '🔹 Starting domain smoke test (User + Business + Account + Transaction + Budget + Savings + Cashflow + Insights)...'
  );

  const timestamp = Date.now();
  const email = `test.user+${timestamp}@example.com`;

  // --- 1) createUserWithDefaultSettings ---
  console.log('\n=== 1) createUserWithDefaultSettings ===');

  const createdUser = await userService.createUserWithDefaultSettings({
    email,
    passwordHash: 'dummy-hash',
    displayName: 'Test User',
  });

  const userId = createdUser.user.id;
  console.log('✅ User created:', {
    id: userId,
    email: createdUser.user.email,
    mainCurrency: createdUser.settings.main_currency,
    firstDayOfMonth: createdUser.settings.first_day_of_month,
  });

  // --- 2) getUserWithSettingsById ---
  console.log('\n=== 2) getUserWithSettingsById ===');

  const userWithSettings = await userService.getUserWithSettingsById(userId);
  console.log('✅ User fetched by ID, settings:', {
    email: userWithSettings.user.email,
    mainCurrency: userWithSettings.settings.main_currency,
    notificationLevel: userWithSettings.settings.notification_level,
  });

  // --- 3) createUserWithDefaultSettings (duplicate email) ---
  console.log('\n=== 3) createUserWithDefaultSettings (duplicate email) ===');

  try {
    await userService.createUserWithDefaultSettings({
      email,
      passwordHash: 'dummy-hash-2',
      displayName: 'Duplicate User',
    });
    console.error('❌ Expected EmailAlreadyInUseError but none was thrown');
  } catch (err: any) {
    if (err?.name === 'EmailAlreadyInUseError') {
      console.log('✅ EmailAlreadyInUseError correctly thrown for duplicate email');
    } else {
      console.error('❌ Unexpected error for duplicate email:', err);
      throw err;
    }
  }

  // --- 4) createBusinessWithDefaultSettings ---
  console.log('\n=== 4) createBusinessWithDefaultSettings ===');

  const createdBusiness = await businessService.createBusinessWithDefaultSettings({
    userId,
    name: `My Studio ${timestamp}`,
    legalForm: 'SASU',
    currency: 'EUR',
    defaultVatRate: 20,
    defaultPaymentTermsDays: 30,
  });

  const businessId = createdBusiness.business.id;
  console.log('✅ Business created:', {
    id: businessId,
    userId: createdBusiness.business.user_id,
    name: createdBusiness.business.name,
    currency: createdBusiness.business.currency,
    invoicePrefix: createdBusiness.settings.invoice_prefix,
    defaultPaymentTermsDays: createdBusiness.settings.default_payment_terms_days,
  });

  // --- 5) listBusinessesForUser ---
  console.log('\n=== 5) listBusinessesForUser ===');

  const businessesForUser = await businessService.listBusinessesForUser(userId);
  console.log(`✅ Found ${businessesForUser.length} business(es) for user ${userId}`);
  if (businessesForUser[0]) {
    console.log('  [0]', {
      id: businessesForUser[0].business.id,
      name: businessesForUser[0].business.name,
      isActive: businessesForUser[0].business.is_active,
      invoicePrefix: businessesForUser[0].settings.invoice_prefix,
    });
  }

  // --- 6) updateBusinessProfile ---
  console.log('\n=== 6) updateBusinessProfile ===');

  const updatedBusiness = await businessService.updateBusinessProfile(businessId, userId, {
    name: `${createdBusiness.business.name} (Updated)`,
    legalForm: 'SASU',
  });

  console.log('✅ Business updated:', {
    id: updatedBusiness.business.id,
    name: updatedBusiness.business.name,
    legalForm: updatedBusiness.business.legal_form,
  });

  // --- 7) updateBusinessSettings ---
  console.log('\n=== 7) updateBusinessSettings ===');

  const updatedBusinessSettings = await businessService.updateBusinessSettings(businessId, userId, {
    invoiceNextNumber: 10,
    quoteNextNumber: 5,
    defaultVatRate: 20,
    defaultPaymentTermsDays: 45,
  });

  console.log('✅ Business settings updated:', {
    invoiceNextNumber: updatedBusinessSettings.settings.invoice_next_number,
    quoteNextNumber: updatedBusinessSettings.settings.quote_next_number,
    defaultVatRate: updatedBusinessSettings.settings.default_vat_rate,
    defaultPaymentTermsDays: updatedBusinessSettings.settings.default_payment_terms_days,
  });

  // --- 8) archiveBusiness / reactivateBusiness ---
  console.log('\n=== 8) archiveBusiness / reactivateBusiness ===');

  const archivedBusiness = await businessService.archiveBusiness(businessId, userId);
  console.log('✅ Business archived, is_active:', archivedBusiness.business.is_active);

  const reactivatedBusiness = await businessService.reactivateBusiness(businessId, userId);
  console.log('✅ Business reactivated, is_active:', reactivatedBusiness.business.is_active);

  // --- 9) BusinessOwnershipError (fake user) ---
  console.log('\n=== 9) BusinessOwnershipError (fake user) ===');

  try {
    await businessService.updateBusinessProfile(businessId, userId + 1000n, { name: 'Hacked Name' });
    console.error('❌ Expected BusinessOwnershipError but none was thrown');
  } catch (err: any) {
    if (err?.name === 'BusinessOwnershipError') {
      console.log('✅ BusinessOwnershipError correctly thrown for foreign user');
    } else {
      console.error('❌ Unexpected error when testing business ownership:', err);
      throw err;
    }
  }

  // --- 10) createPersonalAccount ---
  console.log('\n=== 10) createPersonalAccount ===');

  const personalAccount = await accountService.createPersonalAccount({
    userId,
    name: 'Compte courant perso',
    type: 'current',
    currency: 'EUR',
    includeInBudget: true,
    includeInNetWorth: true,
  });

  const personalAccountId = personalAccount.id;
  console.log('✅ Personal account created:', {
    id: personalAccount.id,
    userId: personalAccount.user_id,
    businessId: personalAccount.business_id,
    name: personalAccount.name,
    type: personalAccount.type,
    currency: personalAccount.currency,
  });

  // --- 11) createBusinessAccount ---
  console.log('\n=== 11) createBusinessAccount ===');

  const businessAccount = await accountService.createBusinessAccount({
    userId,
    businessId,
    name: 'Compte pro courant',
    type: 'current',
    currency: 'EUR',
    includeInBudget: true,
    includeInNetWorth: true,
  });

  const businessAccountId = businessAccount.id;
  console.log('✅ Business account created:', {
    id: businessAccount.id,
    userId: businessAccount.user_id,
    businessId: businessAccount.business_id,
    name: businessAccount.name,
    type: businessAccount.type,
    currency: businessAccount.currency,
  });

  // --- 12) listPersonalAccountsForUser ---
  console.log('\n=== 12) listPersonalAccountsForUser ===');

  const personalAccounts = await accountService.listPersonalAccountsForUser(userId, {});
  console.log(`✅ Found ${personalAccounts.length} personal account(s) for user ${userId}`);
  if (personalAccounts[0]) {
    console.log('  [0]', {
      id: personalAccounts[0].id,
      name: personalAccounts[0].name,
      type: personalAccounts[0].type,
      currency: personalAccounts[0].currency,
      isActive: personalAccounts[0].is_active,
      includeInBudget: personalAccounts[0].include_in_budget,
      includeInNetWorth: personalAccounts[0].include_in_net_worth,
    });
  }

  // --- 13) listBusinessAccountsForUser ---
  console.log('\n=== 13) listBusinessAccountsForUser ===');

  const businessAccounts = await accountService.listBusinessAccountsForUser(userId, businessId, {});
  console.log(`✅ Found ${businessAccounts.length} business account(s) for business ${businessId}`);
  if (businessAccounts[0]) {
    console.log('  [0]', {
      id: businessAccounts[0].id,
      name: businessAccounts[0].name,
      type: businessAccounts[0].type,
      currency: businessAccounts[0].currency,
      isActive: businessAccounts[0].is_active,
      includeInBudget: businessAccounts[0].include_in_budget,
      includeInNetWorth: businessAccounts[0].include_in_net_worth,
    });
  }

  // --- 14) updateAccount (personal account) ---
  console.log('\n=== 14) updateAccount (personal account) ===');

  const updatedPersonalAccount = await accountService.updateAccount(personalAccountId, userId, {
    name: 'Compte courant perso (modifié)',
    includeInBudget: false,
    includeInNetWorth: true,
  });

  console.log('✅ Personal account updated:', {
    id: updatedPersonalAccount.id,
    name: updatedPersonalAccount.name,
    includeInBudget: updatedPersonalAccount.include_in_budget,
    includeInNetWorth: updatedPersonalAccount.include_in_net_worth,
  });

  // --- 15) archiveAccount / reactivateAccount (business account) ---
  console.log('\n=== 15) archiveAccount / reactivateAccount (business account) ===');

  const archivedAccount = await accountService.archiveAccount(businessAccountId, userId);
  console.log('✅ Business account archived, is_active:', archivedAccount.is_active);

  const reactivatedAccount = await accountService.reactivateAccount(businessAccountId, userId);
  console.log('✅ Business account reactivated, is_active:', reactivatedAccount.is_active);

  // --- 16) AccountOwnershipError (fake user) ---
  console.log('\n=== 16) AccountOwnershipError (fake user) ===');

  try {
    await accountService.getAccountForUser(personalAccountId, userId + 1000n);
    console.error('❌ Expected AccountOwnershipError but none was thrown');
  } catch (err: any) {
    if (err?.name === 'AccountOwnershipError') {
      console.log('✅ AccountOwnershipError correctly thrown for foreign user');
    } else {
      console.error('❌ Unexpected error when testing account ownership:', err);
      throw err;
    }
  }

  // --- 17) seed categories for budgeting/transactions ---
  console.log('\n=== 17) seed categories ===');

  const incomeCategory = await prisma.categories.create({
    data: {
      user_id: userId,
      name: `Income category ${timestamp}`,
      type: 'income',
    },
  });

  const expenseCategory = await prisma.categories.create({
    data: {
      user_id: userId,
      name: `Expense category ${timestamp}`,
      type: 'expense',
    },
  });

  console.log('✅ Categories created:', {
    incomeCategoryId: incomeCategory.id,
    expenseCategoryId: expenseCategory.id,
  });

  // --- 18) createPersonalTransaction ---
  console.log('\n=== 18) createPersonalTransaction ===');

  const personalTx = await transactionService.createPersonalTransaction({
    userId,
    accountId: personalAccountId,
    date: new Date(),
    amount: 100,
    direction: 'in',
    label: 'Salaire test',
    type: 'income',
    categoryId: incomeCategory.id,
  });

  console.log('✅ Personal transaction created:', {
    id: personalTx.id,
    userId: personalTx.user_id,
    accountId: personalTx.account_id,
    amount: personalTx.amount,
    direction: personalTx.direction,
    businessId: personalTx.business_id,
  });

  // --- 19) createBusinessTransaction ---
  console.log('\n=== 19) createBusinessTransaction ===');

  const businessTx = await transactionService.createBusinessTransaction({
    userId,
    businessId,
    accountId: businessAccountId,
    date: new Date(),
    amount: 250,
    direction: 'out',
    label: 'Fournisseur test',
    type: 'expense',
    categoryId: expenseCategory.id,
  });

  console.log('✅ Business transaction created:', {
    id: businessTx.id,
    userId: businessTx.user_id,
    accountId: businessTx.account_id,
    amount: businessTx.amount,
    direction: businessTx.direction,
    businessId: businessTx.business_id,
  });

  // --- 20) createTransfer ---
  console.log('\n=== 20) createTransfer ===');

  const transfer = await transactionService.createTransfer({
    userId,
    fromAccountId: personalAccountId,
    toAccountId: businessAccountId,
    date: new Date(),
    amount: 50,
    label: 'Transfert perso -> pro',
  });

  console.log('✅ Transfer created:', {
    fromId: transfer.from.id,
    fromDirection: transfer.from.direction,
    toId: transfer.to.id,
    toDirection: transfer.to.direction,
  });

  // --- 21) listTransactionsForAccount (personal) ---
  console.log('\n=== 21) listTransactionsForAccount (personal) ===');

  const personalTxs = await transactionService.listTransactionsForAccount(userId, personalAccountId, {});
  console.log(`✅ Found ${personalTxs.length} transaction(s) on personal account`);
  if (personalTxs[0]) {
    console.log('  Example:', {
      id: personalTxs[0].id,
      amount: personalTxs[0].amount,
      direction: personalTxs[0].direction,
      businessId: personalTxs[0].business_id,
    });
  }

  // --- 22) listTransactionsForUser – personal only ---
  console.log('\n=== 22) listTransactionsForUser (personal only) ===');

  const personalOnlyTxs = await transactionService.listTransactionsForUser(userId, { businessId: null });
  const personalOnlyValid = personalOnlyTxs.every((t) => t.business_id === null);
  console.log(`✅ Personal-only transactions: ${personalOnlyTxs.length}, all personal: ${personalOnlyValid}`);

  // --- 23) listTransactionsForUser – business-only ---
  console.log('\n=== 23) listTransactionsForUser (business only) ===');

  const businessOnlyTxs = await transactionService.listTransactionsForUser(userId, { businessId });
  const businessOnlyValid = businessOnlyTxs.every((t) => t.business_id === businessId);
  console.log(`✅ Business-only transactions: ${businessOnlyTxs.length}, all match business: ${businessOnlyValid}`);

  // --- 24) updateTransaction ---
  console.log('\n=== 24) updateTransaction ===');

  const updatedTx = await transactionService.updateTransaction(personalTx.id, userId, {
    label: 'Salaire corrigé',
    notes: 'Test note',
    tags: 'test,salaire',
  });

  console.log('✅ Transaction updated:', {
    id: updatedTx.id,
    label: updatedTx.label,
    notes: updatedTx.notes,
    tags: updatedTx.tags,
  });

  // --- 25) deleteTransactionForUser ---
  console.log('\n=== 25) deleteTransactionForUser ===');

  await transactionService.deleteTransactionForUser(businessTx.id, userId);
  console.log('✅ Business transaction deleted');

  try {
    await transactionService.getTransactionForUser(businessTx.id, userId);
    console.error('❌ Expected TransactionNotFoundError after delete');
  } catch (err: any) {
    if (err?.name === 'TransactionNotFoundError') {
      console.log('✅ TransactionNotFoundError correctly thrown after delete');
    } else {
      console.error('❌ Unexpected error when fetching deleted transaction:', err);
      throw err;
    }
  }

  // --- 26) TransactionOwnershipError (fake user) ---
  console.log('\n=== 26) TransactionOwnershipError (fake user) ===');

  try {
    await transactionService.getTransactionForUser(personalTx.id, userId + 1000n);
    console.error('❌ Expected TransactionOwnershipError but none was thrown');
  } catch (err: any) {
    if (err?.name === 'TransactionOwnershipError') {
      console.log('✅ TransactionOwnershipError correctly thrown for foreign user');
    } else {
      console.error('❌ Unexpected error when testing transaction ownership:', err);
      throw err;
    }
  }

  // --- 27) createPersonalBudget + lines ---
  console.log('\n=== 27) createPersonalBudget + lines ===');

  const now = new Date();
  const personalBudget = await budgetService.createPersonalBudget({
    userId,
    name: `Budget perso ${timestamp}`,
    periodType: 'monthly',
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    totalSpendingLimit: 3000,
  });

  console.log('✅ Personal budget created:', {
    id: personalBudget.budget.id,
    userId: personalBudget.budget.user_id,
    periodType: personalBudget.budget.period_type,
    month: personalBudget.budget.month,
    year: personalBudget.budget.year,
  });

  const incomeLine = await budgetService.addBudgetLine({
    userId,
    budgetId: personalBudget.budget.id,
    categoryId: incomeCategory.id,
    spendingLimit: 2000,
    priority: 'essential',
  });

  const expenseLine = await budgetService.addBudgetLine({
    userId,
    budgetId: personalBudget.budget.id,
    categoryId: expenseCategory.id,
    spendingLimit: 800,
    priority: 'essential',
  });

  console.log('✅ Budget lines created:', {
    incomeLineId: incomeLine.id,
    expenseLineId: expenseLine.id,
  });

  // --- 28) computeBudgetExecutionForUser ---
  console.log('\n=== 28) computeBudgetExecutionForUser ===');

  const execution = await budgetService.computeBudgetExecutionForUser(personalBudget.budget.id, userId);

  console.log('✅ Budget execution summary:', {
    budgetId: execution.budget.id,
    totalPlanned: execution.totalPlanned,
    totalActual: execution.totalActual,
    totalVariance: execution.totalVariance,
  });

  // --- 29) updateBudgetLine + deleteBudgetLineForUser ---
  console.log('\n=== 29) updateBudgetLine + deleteBudgetLineForUser ===');

  const updatedIncomeLine = await budgetService.updateBudgetLine(incomeLine.id, userId, {
    spendingLimit: 2100,
    note: 'Adjusted salary',
  });

  console.log('✅ Budget line updated:', {
    id: updatedIncomeLine.id,
    spendingLimit: updatedIncomeLine.spending_limit,
    note: updatedIncomeLine.note,
  });

  await budgetService.deleteBudgetLineForUser(expenseLine.id, userId);
  console.log('✅ Budget line deleted');

  // --- 30) BudgetOwnershipError (fake user) ---
  console.log('\n=== 30) BudgetOwnershipError (fake user) ===');

  try {
    await budgetService.getBudgetWithLinesForUser(personalBudget.budget.id, userId + 1000n);
    console.error('❌ Expected BudgetOwnershipError but none was thrown');
  } catch (err: any) {
    if (err?.name === 'BudgetOwnershipError') {
      console.log('✅ BudgetOwnershipError correctly thrown for foreign user');
    } else {
      console.error('❌ Unexpected error when testing budget ownership:', err);
      throw err;
    }
  }

  // --- 31) createPersonalSavingsGoal ---
  console.log('\n=== 31) createPersonalSavingsGoal ===');

  const personalGoal = await savingsService.createPersonalSavingsGoal({
    userId,
    name: `Epargne perso ${timestamp}`,
    targetAmount: 5000,
    initialAmount: 500,
    startDate: now,
    targetDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    linkedAccountId: personalAccountId,
    priority: 'high',
    notes: 'Epargne de précaution',
  });

  console.log('✅ Personal savings goal created:', {
    id: personalGoal.id,
    userId: personalGoal.user_id,
    targetAmount: personalGoal.target_amount,
    currentAmount: personalGoal.current_amount_cached,
    status: personalGoal.status,
  });

  // --- 32) createBusinessSavingsGoal ---
  console.log('\n=== 32) createBusinessSavingsGoal ===');

  const businessGoal = await savingsService.createBusinessSavingsGoal({
    userId,
    businessId,
    name: `Epargne pro ${timestamp}`,
    targetAmount: 8000,
    initialAmount: 1000,
    targetDate: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
    linkedAccountId: businessAccountId,
    priority: 'high',
  });

  console.log('✅ Business savings goal created:', {
    id: businessGoal.id,
    userId: businessGoal.user_id,
    targetAmount: businessGoal.target_amount,
    currentAmount: businessGoal.current_amount_cached,
    status: businessGoal.status,
  });

  // --- 33) listSavingsGoalsForUser (personal vs business) ---
  console.log('\n=== 33) listSavingsGoalsForUser (personal vs business) ===');

  const personalGoals = await savingsService.listSavingsGoalsForUser(userId, { businessId: null });
  const businessGoals = await savingsService.listSavingsGoalsForUser(userId, { businessId });

  console.log('✅ Savings goals listed:', {
    personalCount: personalGoals.length,
    businessCount: businessGoals.length,
  });

  // --- 34) updateSavingsGoal + computeSavingsOverviewForUser ---
  console.log('\n=== 34) updateSavingsGoal + computeSavingsOverviewForUser ===');

  const updatedPersonalGoal = await savingsService.updateSavingsGoal(personalGoal.id, userId, {
    currentAmount: 1500,
    notes: 'Augmented contribution',
  });

  console.log('✅ Savings goal updated:', {
    id: updatedPersonalGoal.id,
    targetAmount: updatedPersonalGoal.target_amount,
    currentAmount: updatedPersonalGoal.current_amount_cached,
    status: updatedPersonalGoal.status,
  });

  const savingsOverview = await savingsService.computeSavingsOverviewForUser(userId, {});
  console.log('✅ Savings overview:', {
    goals: savingsOverview.goals.length,
    totalTarget: savingsOverview.totalTarget,
    totalCurrent: savingsOverview.totalCurrent,
    overallProgressPct: savingsOverview.overallProgressPct,
  });

  // --- 35) SavingsGoalOwnershipError (fake user) ---
  console.log('\n=== 35) SavingsGoalOwnershipError (fake user) ===');

  try {
    await savingsService.getSavingsGoalForUser(personalGoal.id, userId + 1000n);
    console.error('❌ Expected SavingsGoalOwnershipError but none was thrown');
  } catch (err: any) {
    if (err?.name === 'SavingsGoalOwnershipError') {
      console.log('✅ SavingsGoalOwnershipError correctly thrown for foreign user');
    } else {
      console.error('❌ Unexpected error when testing savings goal ownership:', err);
      throw err;
    }
  }

  // --- 36) createPersonalTransaction (large expense) ---
  console.log('\n=== 36) createPersonalTransaction (large expense) ===');

  await transactionService.createPersonalTransaction({
    userId,
    accountId: personalAccountId,
    date: new Date(),
    amount: 4000,
    direction: 'out',
    label: 'Grosse dépense perso',
    type: 'expense',
    categoryId: expenseCategory.id,
  });
  console.log('✅ Large personal expense created');

  // --- 37) importPersonalTransactionsFromCsv ---
  console.log('\n=== 37) importPersonalTransactionsFromCsv ===');

  const csvContent = `date;label;amount
${now.toISOString().slice(0, 10)};Courses;-120.50
${now.toISOString().slice(0, 10)};Remboursement;200.00`;

  const importResult = await transactionImportService.importPersonalTransactionsFromCsv({
    userId,
    accountId: personalAccountId,
    csvContent,
    columnMapping: { date: 'date', label: 'label', amount: 'amount' },
    options: { dateFormat: 'YYYY-MM-DD', decimalSeparator: '.' },
  });

  console.log('✅ CSV import result:', importResult);

  // --- 38) listPersonalAccountsWithBalanceForUser ---
  console.log('\n=== 38) listPersonalAccountsWithBalanceForUser ===');

  const accountsWithBalance = await accountService.listPersonalAccountsWithBalanceForUser(userId);
  console.log(
    '✅ Personal accounts with balance:',
    accountsWithBalance.map((a) => ({ id: a.account.id, balance: a.balance }))
  );

  // --- 39) computeCurrentPersonalBudgetOverview ---
  console.log('\n=== 39) computeCurrentPersonalBudgetOverview ===');

  const budgetOverview = await budgetService.computeCurrentPersonalBudgetOverview(userId, {});
  if (budgetOverview) {
    console.log('✅ Budget overview:', {
      budgetId: budgetOverview.budget.id,
      totalPlanned: budgetOverview.totalPlanned,
      totalActual: budgetOverview.totalActual,
      totalVariance: budgetOverview.totalVariance,
    });
  } else {
    console.log('ℹ️ No personal budget found for current month');
  }

  // --- 40) computePersonalSavingsOverview ---
  console.log('\n=== 40) computePersonalSavingsOverview ===');

  const savingsOverviewPersonal = await savingsService.computePersonalSavingsOverview(userId);
  console.log('✅ Personal savings overview:', {
    goals: savingsOverviewPersonal.goals.length,
    totalTarget: savingsOverviewPersonal.totalTarget,
    totalCurrent: savingsOverviewPersonal.totalCurrent,
    overallProgressPct: savingsOverviewPersonal.overallProgressPct,
  });

  // --- 41) computePersonalCashflowProjection ---
  console.log('\n=== 41) computePersonalCashflowProjection ===');

  const personalCashflow = await cashflowService.computePersonalCashflowProjection(userId, {
    horizonDays: 90,
  });

  console.log('✅ Personal cashflow projection (90 days):', {
    points: personalCashflow.points.length,
    horizonDays: personalCashflow.horizonDays,
    currency: personalCashflow.currency,
  });

  // --- 42) computePersonalInsights ---
  console.log('\n=== 42) computePersonalInsights ===');

  const personalInsights = await insightsService.computePersonalInsights(userId);
  console.log('✅ Personal insights:', {
    count: personalInsights.length,
    example: personalInsights[0]
      ? {
          id: personalInsights[0].id,
          category: personalInsights[0].category,
          severity: personalInsights[0].severity,
        }
      : null,
  });

  // --- 43) create project client ---
  console.log('\n=== 43) create project client ===');

  const projectClient = await clientService.createClient({
    userId,
    businessId,
    name: `Client ${timestamp}`,
    type: 'company',
    email: 'client@example.com',
    companyName: 'Client Corp',
  });

  console.log('✅ Project client created:', {
    id: projectClient.id,
    userId: projectClient.user_id,
    businessId: projectClient.business_id,
    name: projectClient.name,
  });

  // --- 44) create service catalog entries ---
  console.log('\n=== 44) create service catalog entries ===');

  const brandingService = await servicesService.createService({
    userId,
    businessId,
    name: 'Branding package',
    unit: 'project',
    unitPrice: 2000,
    currency: 'EUR',
    description: 'Logo + brand kit',
  });

  const devDayService = await servicesService.createService({
    userId,
    businessId,
    name: 'Development day',
    unit: 'day',
    unitPrice: 500,
    currency: 'EUR',
  });

  console.log('✅ Services created:', {
    brandingServiceId: brandingService.id,
    devDayServiceId: devDayService.id,
  });

  // --- 45) create project with services ---
  console.log('\n=== 45) create project with services ===');

  const createdProject = await projectsService.createProject({
    userId,
    businessId,
    clientId: projectClient.id,
    name: `Project ${timestamp}`,
    description: 'Website redesign',
    priority: 'high',
    services: [
      { serviceId: brandingService.id, quantity: 1 },
      { serviceId: devDayService.id, quantity: 5 },
    ],
  });

  const expectedBudget =
    Number(brandingService.unit_price) + Number(devDayService.unit_price) * 5;

  console.log('✅ Project created:', {
    id: createdProject.project.id,
    clientId: createdProject.project.client_id,
    budgetAmount: createdProject.project.budget_amount?.toString(),
    expectedBudget,
  });

  // --- 46) project tasks & milestones progress ---
  console.log('\n=== 46) project tasks & milestones progress ===');

  await projectsService.updateProject(createdProject.project.id, userId, { progressAutoMode: 'tasks' });

  const taskA = await projectTaskService.addTask({
    userId,
    projectId: createdProject.project.id,
    title: 'Plan workshop',
    priority: 'high',
  });
  const taskB = await projectTaskService.addTask({
    userId,
    projectId: createdProject.project.id,
    title: 'Build homepage',
  });

  await projectTaskService.updateTask(taskA.id, userId, { status: 'done' });

  const taskProgress = await projectsService.computeProjectProgress(createdProject.project.id, userId);
  console.log('✅ Task-based progress:', { value: taskProgress.value });

  const milestone1 = await projectMilestoneService.addMilestone({
    userId,
    projectId: createdProject.project.id,
    name: 'Discovery',
    weightPct: 50,
  });
  const milestone2 = await projectMilestoneService.addMilestone({
    userId,
    projectId: createdProject.project.id,
    name: 'Delivery',
    weightPct: 50,
  });

  await projectMilestoneService.updateMilestone(milestone1.id, userId, { status: 'completed' });
  await projectsService.updateProject(createdProject.project.id, userId, { progressAutoMode: 'milestones' });

  const milestoneProgress = await projectsService.computeProjectProgress(createdProject.project.id, userId);
  console.log('✅ Milestone-based progress:', { value: milestoneProgress.value });

  // --- 47) project financials ---
  console.log('\n=== 47) project financials ===');

  await projectsService.updateProject(createdProject.project.id, userId, { progressAutoMode: 'financial' });

  await transactionService.createBusinessTransaction({
    userId,
    businessId,
    accountId: businessAccountId,
    date: new Date(),
    amount: 4000,
    direction: 'in',
    label: 'Project invoice payment',
    type: 'income',
    categoryId: incomeCategory.id,
    projectId: createdProject.project.id,
  });

  await transactionService.createBusinessTransaction({
    userId,
    businessId,
    accountId: businessAccountId,
    date: new Date(),
    amount: 800,
    direction: 'out',
    label: 'Subcontractor',
    type: 'expense',
    categoryId: expenseCategory.id,
    projectId: createdProject.project.id,
  });

  const projectFinancials = await projectsService.computeProjectFinancials(createdProject.project.id, userId);
  const financialProgress = await projectsService.computeProjectProgress(createdProject.project.id, userId);

  console.log('✅ Financials computed:', {
    revenue: projectFinancials.revenue.toString(),
    costs: projectFinancials.costs.toString(),
    margin: projectFinancials.margin.toString(),
    progressValue: financialProgress.value,
  });

  // --- 48) listProjectsForUser ---
  console.log('\n=== 48) listProjectsForUser ===');

  const listedProjects = await projectsService.listProjectsForUser(userId, { businessId });
  const foundProject = listedProjects.find((p) => p.project.id === createdProject.project.id);

  console.log('✅ Project listed with progress + financials:', {
    found: !!foundProject,
    progress: foundProject?.progress.value,
    revenue: foundProject?.financials.revenue.toString(),
  });

  // --- 49) getProjectWithDetails ---
  console.log('\n=== 49) getProjectWithDetails ===');

  const projectWithDetails = await projectsService.getProjectWithDetails(createdProject.project.id, userId);

  console.log('✅ Project details:', {
    services: projectWithDetails.services.length,
    milestones: projectWithDetails.milestones.length,
    tasks: projectWithDetails.tasks.length,
    clientName: projectWithDetails.client?.name,
  });

  console.log('\n✅ Domain smoke test completed successfully.');
}

main()
  .catch((err) => {
    console.error('\n❌ Domain smoke test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
