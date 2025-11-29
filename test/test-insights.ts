import { userService } from '@/modules/user/user.service';
import { businessService } from '@/modules/business/business.service';
import { insightsService } from '@/modules/insights/insights.service';
import { budgetService } from '@/modules/budget/budget.service';
import { accountService } from '@/modules/account/account.service';
import { transactionService } from '@/modules/transaction/transaction.service';
import { prisma } from '@/lib/prisma';

async function main() {
  console.log('🔹 Insights smoke test starting...');

  const ts = Date.now();
  const email = `insights.user+${ts}@example.com`;

  const { user } = await userService.createUserWithDefaultSettings({
    email,
    passwordHash: 'dummy',
    displayName: 'Insights User',
  });
  const userId = user.id;

  // Personal budget and overspend
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  await budgetService.createPersonalBudget({
    userId,
    name: `Budget ${ts}`,
    periodType: 'monthly',
    year,
    month,
    totalSpendingLimit: 100,
  });

  const personalAccount = await accountService.createPersonalAccount({
    userId,
    name: 'Perso',
    type: 'current',
    currency: 'EUR',
  });

  await transactionService.createPersonalTransaction({
    userId,
    accountId: personalAccount.id,
    date: now,
    amount: 150,
    direction: 'out',
    label: 'Courses',
    type: 'expense',
  });

  // Business setup for late invoice and revenue goal
  const business = await businessService.createBusinessWithDefaultSettings({
    userId,
    name: `Biz ${ts}`,
    legalForm: 'SASU',
    currency: 'EUR',
  });
  const businessId = business.business.id;

  const businessAccount = await accountService.createBusinessAccount({
    userId,
    businessId,
    name: 'Biz Account',
    type: 'current',
    currency: 'EUR',
    includeInBudget: true,
    includeInNetWorth: true,
  });

  await prisma.business_settings.update({
    where: { business_id: businessId },
    data: { monthly_revenue_goal: 2000 },
  });

  // Late invoice
  const client = await prisma.clients.create({
    data: {
      business_id: businessId,
      name: `Client ${ts}`,
    },
  });

  await prisma.invoices.create({
    data: {
      business_id: businessId,
      client_id: client.id,
      project_id: null,
      quote_id: null,
      invoice_number: `INV-${ts}`,
      invoice_date: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      due_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      status: 'issued',
      currency: 'EUR',
      payment_terms_days: 30,
      subtotal_ht: 1000,
      discount_total: 0,
      vat_total: 0,
      total_ht: 1000,
      total_ttc: 1000,
      amount_paid_cached: 0,
      notes: null,
    },
  });

  // Revenue below goal: no income transactions

  const personalInsights = await insightsService.computePersonalInsights(userId, { year, month });
  const businessInsights = await insightsService.computeBusinessInsights(userId, businessId, { year, month });

  console.log('✅ Personal insights:', personalInsights.map((i) => ({ id: i.id, severity: i.severity })));
  console.log('✅ Business insights:', businessInsights.map((i) => ({ id: i.id, severity: i.severity })));

  const expectPersonal = personalInsights.some((i) => i.id === 'personal-budget-overspent');
  const expectBusiness = businessInsights.some(
    (i) => i.id === 'business-late-invoices' || i.id === 'business-under-target-revenue'
  );

  if (!expectPersonal) throw new Error('Expected personal-budget-overspent insight');
  if (!expectBusiness) throw new Error('Expected business insights for late invoices or under target revenue');

  console.log('✅ Insights smoke test completed successfully.');
}

main().catch((err) => {
  console.error('❌ Insights smoke test failed:', err);
  process.exit(1);
});
