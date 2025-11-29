// src/test/test-ownership.ts
// Ownership-focused smoke test for hardened domain relations on transactions.
// Run manually with: `npm run test:ownership` (configure the script in package.json).

import { userService } from '@/modules/user/user.service';
import { businessService } from '@/modules/business/business.service';
import { accountService } from '@/modules/account/account.service';
import { transactionService } from '@/modules/transaction/transaction.service';
import { prisma } from '@/lib/prisma';

async function main() {
  console.log(
    '🔹 Starting ownership domain smoke test (categories, contacts, income sources, suppliers, invoices, recurring series)...'
  );

  const timestamp = Date.now();

  //
  // --- 1) bootstrap main user + business + accounts + categories ---
  //
  console.log('\n=== 1) Bootstrap main user/business/accounts/categories ===');

  const mainUserEmail = `ownership.main+${timestamp}@example.com`;
  const mainUser = await userService.createUserWithDefaultSettings({
    email: mainUserEmail,
    passwordHash: 'dummy-main',
    displayName: 'Main User',
  });
  const mainUserId = mainUser.user.id;

  const mainBusiness = await businessService.createBusinessWithDefaultSettings({
    userId: mainUserId,
    name: `Main Studio ${timestamp}`,
    legalForm: 'SASU',
    currency: 'EUR',
    defaultVatRate: 20,
    defaultPaymentTermsDays: 30,
  });
  const mainBusinessId = mainBusiness.business.id;

  const mainPersonalAccount = await accountService.createPersonalAccount({
    userId: mainUserId,
    name: 'Main perso',
    type: 'current',
    currency: 'EUR',
    includeInBudget: true,
    includeInNetWorth: true,
  });

  const mainBusinessAccount = await accountService.createBusinessAccount({
    userId: mainUserId,
    businessId: mainBusinessId,
    name: 'Main business',
    type: 'current',
    currency: 'EUR',
    includeInBudget: true,
    includeInNetWorth: true,
  });

  const mainIncomeCategory = await prisma.categories.create({
    data: {
      user_id: mainUserId,
      name: `Main income cat ${timestamp}`,
      type: 'income',
    },
  });

  const mainExpenseCategory = await prisma.categories.create({
    data: {
      user_id: mainUserId,
      name: `Main expense cat ${timestamp}`,
      type: 'expense',
    },
  });

  console.log('✅ Main context ready:', {
    mainUserId,
    mainBusinessId,
    mainPersonalAccountId: mainPersonalAccount.id,
    mainBusinessAccountId: mainBusinessAccount.id,
    mainIncomeCategoryId: mainIncomeCategory.id,
    mainExpenseCategoryId: mainExpenseCategory.id,
  });

  //
  // --- 2) bootstrap foreign user + business + accounts ---
  //
  console.log('\n=== 2) Bootstrap foreign user/business/accounts ===');

  const foreignUserEmail = `ownership.foreign+${timestamp}@example.com`;
  const foreignUser = await userService.createUserWithDefaultSettings({
    email: foreignUserEmail,
    passwordHash: 'dummy-foreign',
    displayName: 'Foreign User',
  });
  const foreignUserId = foreignUser.user.id;

  const foreignPersonalAccount = await accountService.createPersonalAccount({
    userId: foreignUserId,
    name: 'Foreign perso',
    type: 'current',
    currency: 'EUR',
    includeInBudget: true,
    includeInNetWorth: true,
  });

  const foreignBusiness = await businessService.createBusinessWithDefaultSettings({
    userId: foreignUserId,
    name: `Foreign Studio ${timestamp}`,
    legalForm: 'SASU',
    currency: 'EUR',
    defaultVatRate: 20,
    defaultPaymentTermsDays: 30,
  });
  const foreignBusinessId = foreignBusiness.business.id;

  const foreignBusinessAccount = await accountService.createBusinessAccount({
    userId: foreignUserId,
    businessId: foreignBusinessId,
    name: 'Foreign business',
    type: 'current',
    currency: 'EUR',
    includeInBudget: true,
    includeInNetWorth: true,
  });

  console.log('✅ Foreign context ready:', {
    foreignUserId,
    foreignBusinessId,
    foreignPersonalAccountId: foreignPersonalAccount.id,
    foreignBusinessAccountId: foreignBusinessAccount.id,
  });

  //
  // --- 3) CategoryOwnershipError (foreign category on transaction) ---
  //
  console.log('\n=== 3) CategoryOwnershipError (foreign category) ===');

  // Category owned by main user:
  const foreignCategoryForTest = await prisma.categories.create({
    data: {
      user_id: mainUserId,
      name: `Owned-by-main cat ${timestamp}`,
      type: 'expense',
    },
  });

  try {
    await transactionService.createPersonalTransaction({
      userId: foreignUserId,
      accountId: foreignPersonalAccount.id,
      date: new Date(),
      amount: 10,
      direction: 'out',
      label: 'Tx with foreign category',
      type: 'expense',
      categoryId: foreignCategoryForTest.id, // belongs to mainUser
    });
    console.error('❌ Expected CategoryOwnershipError but none was thrown');
  } catch (err: any) {
    if (err?.name === 'CategoryOwnershipError') {
      console.log('✅ CategoryOwnershipError correctly thrown for foreign category');
    } else {
      console.error('❌ Unexpected error when testing CategoryOwnershipError:', err);
      throw err;
    }
  }

  //
  // --- 4) ContactOwnershipError ---
  //
  console.log('\n=== 4) ContactOwnershipError (foreign contact) ===');

  const mainContact = await prisma.contacts.create({
    data: {
      user_id: mainUserId,
      name: `Main Contact ${timestamp}`,
      type: 'person',
    },
  });

  try {
    await transactionService.createPersonalTransaction({
      userId: foreignUserId,
      accountId: foreignPersonalAccount.id,
      date: new Date(),
      amount: 15,
      direction: 'out',
      label: 'Tx with foreign contact',
      type: 'expense',
      contactId: mainContact.id, // belongs to mainUser
      // IMPORTANT: pas de catégorie étrangère ici, sinon CategoryOwnershipError passe en premier
      categoryId: null,
    });
    console.error('❌ Expected ContactOwnershipError but none was thrown');
  } catch (err: any) {
    if (err?.name === 'ContactOwnershipError') {
      console.log('✅ ContactOwnershipError correctly thrown for foreign contact');
    } else {
      console.error('❌ Unexpected error when testing ContactOwnershipError:', err);
      throw err;
    }
  }

  //
  // --- 5) IncomeSourceOwnershipError ---
  //
  console.log('\n=== 5) IncomeSourceOwnershipError (foreign income source) ===');

  const mainIncomeSource = await prisma.income_sources.create({
    data: {
      user_id: mainUserId,
      name: `Main Salary ${timestamp}`,
      type: 'salary',
      account_id: mainPersonalAccount.id,
      default_category_id: mainIncomeCategory.id,
      is_active: true,
    },
  });

  // Positive sanity check: main user can use its own income source
  const validIncomeTx = await transactionService.createPersonalTransaction({
    userId: mainUserId,
    accountId: mainPersonalAccount.id,
    date: new Date(),
    amount: 1000,
    direction: 'in',
    label: 'Valid salary',
    type: 'income',
    categoryId: mainIncomeCategory.id,
    incomeSourceId: mainIncomeSource.id,
  });

  console.log('✅ Personal transaction with own income source created:', {
    id: validIncomeTx.id,
    incomeSourceId: validIncomeTx.income_source_id,
  });

  // Now foreign user tries to reuse that income source
  try {
    await transactionService.createPersonalTransaction({
      userId: foreignUserId,
      accountId: foreignPersonalAccount.id,
      date: new Date(),
      amount: 2000,
      direction: 'in',
      label: 'Invalid foreign salary',
      type: 'income',
      // IMPORTANT: ne pas mettre de catégorie appartenant au main user,
      // sinon CategoryOwnershipError sortira avant IncomeSourceOwnershipError
      categoryId: null,
      incomeSourceId: mainIncomeSource.id,
    });
    console.error('❌ Expected IncomeSourceOwnershipError but none was thrown');
  } catch (err: any) {
    if (err?.name === 'IncomeSourceOwnershipError') {
      console.log('✅ IncomeSourceOwnershipError correctly thrown for foreign income source');
    } else {
      console.error('❌ Unexpected error when testing IncomeSourceOwnershipError:', err);
      throw err;
    }
  }

  //
  // --- 6) SupplierOwnershipError ---
  //
  console.log('\n=== 6) SupplierOwnershipError (foreign supplier) ===');

  // Supplier owned by foreign business (foreignUser)
  const foreignSupplier = await prisma.suppliers.create({
    data: {
      business_id: foreignBusinessId,
      name: `Foreign Supplier ${timestamp}`,
      status: 'active',
    },
  });

  // Sanity: main user has a valid supplier on its own business
  const mainSupplier = await prisma.suppliers.create({
    data: {
      business_id: mainBusinessId,
      name: `Main Supplier ${timestamp}`,
      status: 'active',
    },
  });

  const validSupplierTx = await transactionService.createBusinessTransaction({
    userId: mainUserId,
    businessId: mainBusinessId,
    accountId: mainBusinessAccount.id,
    date: new Date(),
    amount: 300,
    direction: 'out',
    label: 'Valid main supplier expense',
    type: 'expense',
    categoryId: mainExpenseCategory.id,
    supplierId: mainSupplier.id,
  });

  console.log('✅ Business transaction with own supplier created:', {
    id: validSupplierTx.id,
    supplierId: validSupplierTx.supplier_id,
  });

  // Now try to use supplier from foreign user's business
  try {
    await transactionService.createBusinessTransaction({
      userId: mainUserId,
      businessId: mainBusinessId,
      accountId: mainBusinessAccount.id,
      date: new Date(),
      amount: 400,
      direction: 'out',
      label: 'Invalid foreign supplier expense',
      type: 'expense',
      categoryId: mainExpenseCategory.id, // OK: catégorie du main user pour le main user
      supplierId: foreignSupplier.id, // belongs to foreignUser via foreignBusiness
    });
    console.error('❌ Expected SupplierOwnershipError but none was thrown');
  } catch (err: any) {
    if (err?.name === 'SupplierOwnershipError') {
      console.log('✅ SupplierOwnershipError correctly thrown for foreign supplier');
    } else {
      console.error('❌ Unexpected error when testing SupplierOwnershipError:', err);
      throw err;
    }
  }

  //
  // --- 7) InvoiceOwnershipError ---
  //
  console.log('\n=== 7) InvoiceOwnershipError (foreign invoice) ===');

  // Need a client for the foreign business to create a valid invoice
  const foreignClient = await prisma.clients.create({
    data: {
      business_id: foreignBusinessId,
      name: `Foreign Client ${timestamp}`,
      status: 'active',
    },
  });

  const foreignInvoice = await prisma.invoices.create({
    data: {
      business_id: foreignBusinessId,
      client_id: foreignClient.id,
      invoice_number: `F-INV-${timestamp}`,
      invoice_date: new Date(),
      due_date: new Date(),
      status: 'issued',
      currency: 'EUR',
      subtotal_ht: 1000,
      total_ht: 1000,
      total_ttc: 1200,
      vat_total: 200,
      amount_paid_cached: 0,
    },
  });

  // Create a main-business invoice as a positive control
  const mainClient = await prisma.clients.create({
    data: {
      business_id: mainBusinessId,
      name: `Main Client ${timestamp}`,
      status: 'active',
    },
  });

  const mainInvoice = await prisma.invoices.create({
    data: {
      business_id: mainBusinessId,
      client_id: mainClient.id,
      invoice_number: `M-INV-${timestamp}`,
      invoice_date: new Date(),
      due_date: new Date(),
      status: 'issued',
      currency: 'EUR',
      subtotal_ht: 2000,
      total_ht: 2000,
      total_ttc: 2400,
      vat_total: 400,
      amount_paid_cached: 0,
    },
  });

  const validInvoiceTx = await transactionService.createBusinessTransaction({
    userId: mainUserId,
    businessId: mainBusinessId,
    accountId: mainBusinessAccount.id,
    date: new Date(),
    amount: 2400,
    direction: 'in',
    label: 'Valid invoice payment',
    type: 'income',
    categoryId: mainIncomeCategory.id,
    invoiceId: mainInvoice.id,
  });

  console.log('✅ Business transaction with own invoice created:', {
    id: validInvoiceTx.id,
    invoiceId: validInvoiceTx.invoice_id,
  });

  // Now use a foreign invoice (foreign user + foreign business)
  try {
    await transactionService.createBusinessTransaction({
      userId: mainUserId,
      businessId: mainBusinessId,
      accountId: mainBusinessAccount.id,
      date: new Date(),
      amount: 1200,
      direction: 'in',
      label: 'Invalid foreign invoice payment',
      type: 'income',
      categoryId: mainIncomeCategory.id, // OK: cat du main user pour le main user
      invoiceId: foreignInvoice.id, // invoice d'un autre business
    });
    console.error('❌ Expected InvoiceOwnershipError but none was thrown');
  } catch (err: any) {
    if (err?.name === 'InvoiceOwnershipError') {
      console.log('✅ InvoiceOwnershipError correctly thrown for foreign invoice');
    } else {
      console.error('❌ Unexpected error when testing InvoiceOwnershipError:', err);
      throw err;
    }
  }

  //
  // --- 8) RecurringSeriesOwnershipError ---
  //
  console.log('\n=== 8) RecurringSeriesOwnershipError (foreign recurring series) ===');

  const mainSeries = await prisma.recurring_series.create({
    data: {
      user_id: mainUserId,
      label: `Main recurring ${timestamp}`,
      category_id: mainExpenseCategory.id,
      amount_estimated: 50,
      frequency: 'monthly',
      next_expected_date: new Date(),
      is_active: true,
    },
  });

  // main user can use its own series: positive control
  const validSeriesTx = await transactionService.createPersonalTransaction({
    userId: mainUserId,
    accountId: mainPersonalAccount.id,
    date: new Date(),
    amount: 50,
    direction: 'out',
    label: 'Valid recurring tx',
    type: 'expense',
    categoryId: mainExpenseCategory.id,
    isRecurring: true,
    recurringSeriesId: mainSeries.id,
  });

  console.log('✅ Personal transaction with own recurring series created:', {
    id: validSeriesTx.id,
    recurringSeriesId: validSeriesTx.recurring_series_id,
  });

  // foreign user tries to reuse main user's recurring series
  try {
    await transactionService.createPersonalTransaction({
      userId: foreignUserId,
      accountId: foreignPersonalAccount.id,
      date: new Date(),
      amount: 50,
      direction: 'out',
      label: 'Invalid foreign recurring tx',
      type: 'expense',
      // IMPORTANT: pour tester uniquement la recurring series,
      // on met categoryId à null pour ne pas déclencher CategoryOwnershipError avant.
      categoryId: null,
      isRecurring: true,
      recurringSeriesId: mainSeries.id,
    });
    console.error('❌ Expected RecurringSeriesOwnershipError but none was thrown');
  } catch (err: any) {
    if (err?.name === 'RecurringSeriesOwnershipError') {
      console.log('✅ RecurringSeriesOwnershipError correctly thrown for foreign recurring series');
    } else {
      console.error('❌ Unexpected error when testing RecurringSeriesOwnershipError:', err);
      throw err;
    }
  }

  //
  // --- 9) UpdateTransaction: attaching foreign resources should fail ---
  //
  console.log('\n=== 9) UpdateTransaction ownership checks ===');

  // Create a clean personal tx for foreign user
  const foreignBaseTx = await transactionService.createPersonalTransaction({
    userId: foreignUserId,
    accountId: foreignPersonalAccount.id,
    date: new Date(),
    amount: 30,
    direction: 'out',
    label: 'Foreign base tx',
    type: 'expense',
    categoryId: null,
  });

  console.log('✅ Foreign base tx created:', {
    id: foreignBaseTx.id,
  });

  // 9.a) foreign tries to attach mainUser category
  try {
    await transactionService.updateTransaction(foreignBaseTx.id, foreignUserId, {
      categoryId: mainExpenseCategory.id,
    });
    console.error('❌ Expected CategoryOwnershipError on update but none was thrown');
  } catch (err: any) {
    if (err?.name === 'CategoryOwnershipError') {
      console.log('✅ CategoryOwnershipError correctly thrown on updateTransaction for foreign category');
    } else {
      console.error('❌ Unexpected error when testing CategoryOwnershipError on updateTransaction:', err);
      throw err;
    }
  }

  // 9.b) foreign tries to attach mainUser recurring series
  try {
    await transactionService.updateTransaction(foreignBaseTx.id, foreignUserId, {
      isRecurring: true,
      recurringSeriesId: mainSeries.id,
    });
    console.error('❌ Expected RecurringSeriesOwnershipError on update but none was thrown');
  } catch (err: any) {
    if (err?.name === 'RecurringSeriesOwnershipError') {
      console.log(
        '✅ RecurringSeriesOwnershipError correctly thrown on updateTransaction for foreign recurring series'
      );
    } else {
      console.error('❌ Unexpected error when testing RecurringSeriesOwnershipError on updateTransaction:', err);
      throw err;
    }
  }

  console.log('\n✅ Ownership domain smoke test completed successfully.');
}

main()
  .catch((err) => {
    console.error('\n❌ Ownership domain smoke test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });