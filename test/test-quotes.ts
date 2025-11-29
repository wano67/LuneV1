import { userService } from '@/modules/user/user.service';
import { businessService } from '@/modules/business/business.service';
import { accountService } from '@/modules/account/account.service';
import { quotesService } from '@/modules/quote/quote.service';
import { invoicePaymentService } from '@/modules/invoice-payment/invoice-payment.service';
import { prisma } from '@/lib/prisma';

async function main() {
  console.log('🔹 Quotes / Invoices smoke test starting...');

  const ts = Date.now();
  const email = `quote.user+${ts}@example.com`;

  //
  // 1) CREATE USER
  //
  const { user } = await userService.createUserWithDefaultSettings({
    email,
    passwordHash: 'dummy',
    displayName: 'Quote User',
  });

  //
  // 2) CREATE BUSINESS + DEFAULT SETTINGS
  //
  const business = await businessService.createBusinessWithDefaultSettings({
    userId: user.id,
    name: `Studio ${ts}`,
    legalForm: 'SASU',
    currency: 'EUR',
  });

  const businessId = business.business.id;

  //
  // 3) CREATE CLIENT
  //
  const client = await prisma.clients.create({
    data: {
      business_id: businessId,
      name: `Client ${ts}`,
    },
  });

  //
  // 4) CREATE ACCOUNT FOR PAYMENTS
  //
  const account = await accountService.createBusinessAccount({
    userId: user.id,
    businessId,
    name: 'Compte pro devis',
    type: 'current',
    currency: 'EUR',
    includeInBudget: true,
    includeInNetWorth: true,
  });

  //
  // 5) CREATE QUOTE
  //
  const quote = await quotesService.createQuote({
    userId: user.id,
    businessId,
    clientId: client.id,
    currency: 'EUR',
    items: [
      { description: 'Design', quantity: 2, unitPrice: 500, vatRate: 20 },
      { description: 'Dev', quantity: 1, unitPrice: 800, vatRate: 20 },
    ],
    issueDate: new Date(),
    expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  console.log('✅ Quote created:', {
    id: quote.id,
    number: quote.quote_number,
    total: quote.total_ttc?.toString(),
  });

  //
  // 6) ACCEPT QUOTE
  //
  const accepted = await quotesService.updateQuoteStatus(quote.id, user.id, 'accepted');
  console.log('✅ Quote accepted:', { status: accepted.status });

  //
  // 7) CONVERT TO INVOICE (DEPOSIT 50%)
  //
  const invoice = await quotesService.convertAcceptedQuoteToInvoice({
    userId: user.id,
    businessId,
    quoteId: quote.id,
    type: 'deposit',
    depositPercentage: 50,
  });

  console.log('✅ Invoice created from quote:', {
    id: invoice.id,
    number: invoice.invoice_number,
    total: invoice.total_ttc?.toString(),
  });

  //
  // 8) REGISTER A PARTIAL PAYMENT (50% OF DEPOSIT)
  //
  const payment = await invoicePaymentService.registerInvoicePayment({
    userId: user.id,
    businessId,
    accountId: account.id,
    invoiceId: invoice.id,
    amount: Number(invoice.total_ttc) / 2,
    date: new Date(),
    label: 'Deposit payment',
  });

  console.log('✅ Payment registered:', {
    transactionId: payment.transaction.id,
    invoiceStatus: payment.invoice.status,
    amountPaid: payment.invoice.amount_paid_cached?.toString(),
  });

  //
  // 9) BUSINESS RULE ASSERTION
  //
  const invoiceStatus = (payment.invoice as any).status as string;
  if (invoiceStatus !== 'partially_paid') {
    throw new Error(`Invoice status should be "partially_paid" but got "${invoiceStatus}".`);
  }

  console.log('🎉 All good — Quotes / Invoices smoke test completed successfully.');
}

main().catch((err) => {
  console.error('❌ Quotes / Invoices smoke test failed:', err);
  process.exit(1);
});