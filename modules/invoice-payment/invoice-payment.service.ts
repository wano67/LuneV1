import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { InvoiceNotFoundError } from '@/modules/invoice/invoice.service';
import { transactionService, TransactionSummary } from '@/modules/transaction/transaction.service';
import { normalizeBusinessId, normalizeUserId, normalizeAccountId } from '@/modules/shared/ids';
import {
  assertAccountOwnedByUser,
  assertBusinessOwnedByUser,
  assertInvoiceOwnedByUser,
  assertUserExists,
} from '@/modules/shared/assertions';
import { InvoiceOwnershipError, TransactionOwnershipError, TransactionNotFoundError } from '@/modules/shared/errors';

const invoicePaymentSelect = {
  id: true,
  invoice_id: true,
  transaction_id: true,
  amount: true,
  paid_at: true,
  method: true,
  notes: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.invoice_paymentsSelect;

export class InvoicePaymentNotFoundError extends Error {
  constructor(message = 'Invoice payment not found') {
    super(message);
    this.name = 'InvoicePaymentNotFoundError';
  }
}

export class InvoicePaymentService {
  constructor(private readonly prismaClient: PrismaClient) {}

  async registerInvoicePayment(options: {
    userId: bigint;
    businessId: bigint;
    accountId: bigint;
    invoiceId: bigint;
    amount: number;
  date: Date;
  label?: string;
  method?: string;
  notes?: string;
}): Promise<{ transaction: TransactionSummary; invoice: Prisma.invoicesGetPayload<{ select: any }> }> {
    const userId = normalizeUserId(options.userId);
    const businessId = normalizeBusinessId(options.businessId);
    const accountId = normalizeAccountId(options.accountId);

    await assertUserExists(this.prismaClient, userId);
    await assertBusinessOwnedByUser(this.prismaClient, businessId, userId);
    const account = await assertAccountOwnedByUser(this.prismaClient, accountId, userId);
    if (account.business_id !== businessId) {
      throw new Error('Account does not belong to this business');
    }

    const invoice = await this.prismaClient.invoices.findUnique({
      where: { id: options.invoiceId },
      select: {
        id: true,
        business_id: true,
        client_id: true,
        project_id: true,
        invoice_number: true,
        total_ttc: true,
        amount_paid_cached: true,
        currency: true,
      },
    });
    if (!invoice || invoice.business_id !== businessId) {
      throw new Error('Invoice not found for this business');
    }
    await assertInvoiceOwnedByUser(this.prismaClient, invoice.id, userId);

    const label = options.label ?? `Payment invoice ${invoice.invoice_number}`;

    const tx = await transactionService.createBusinessTransaction({
      userId,
      businessId,
      accountId,
      date: options.date,
      amount: options.amount,
      direction: 'in',
      label,
      type: 'income',
      invoiceId: invoice.id,
      notes: options.notes ?? null,
    });

    const updatedInvoice = await this.prismaClient.$transaction(async (trx) => {
      await trx.invoice_payments.create({
        data: {
          invoice_id: invoice.id,
          transaction_id: tx.id,
          amount: new Prisma.Decimal(options.amount),
          paid_at: options.date,
          method: options.method ?? null,
          notes: options.notes ?? null,
        },
      });

      const newPaid = new Prisma.Decimal(invoice.amount_paid_cached ?? 0).add(options.amount);
      const status = this.computeInvoiceStatus(
        new Prisma.Decimal(invoice.total_ttc ?? 0),
        newPaid,
      );

      return trx.invoices.update({
        where: { id: invoice.id },
        data: { amount_paid_cached: newPaid, status },
      });
    });

    return { transaction: tx as any, invoice: updatedInvoice as any };
  }

  async listPaymentsForInvoice(options: { userId: bigint; invoiceId: bigint }) {
    const userId = normalizeUserId(options.userId);
    const invoiceId = BigInt(options.invoiceId);

    await assertUserExists(this.prismaClient, userId);
    await assertInvoiceOwnedByUser(this.prismaClient, invoiceId, userId);

    return this.prismaClient.invoice_payments.findMany({
      where: { invoice_id: invoiceId },
      select: invoicePaymentSelect,
      orderBy: { created_at: 'asc' },
    });
  }

  async deleteInvoicePayment(options: {
    userId: bigint;
    invoiceId: bigint;
    paymentId: bigint;
  }): Promise<void> {
    const userId = normalizeUserId(options.userId);
    const invoiceId = BigInt(options.invoiceId);
    const paymentId = BigInt(options.paymentId);

    await assertUserExists(this.prismaClient, userId);

    const invoice = await this.prismaClient.invoices.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        total_ttc: true,
        businesses: { select: { user_id: true } },
      },
    });

    if (!invoice) {
      throw new InvoiceNotFoundError();
    }
    if (invoice.businesses?.user_id !== userId) {
      throw new InvoiceOwnershipError();
    }

    const payment = await this.prismaClient.invoice_payments.findUnique({
      where: { id: paymentId },
      select: { id: true, invoice_id: true, transaction_id: true },
    });

    if (!payment || payment.invoice_id !== invoiceId) {
      throw new InvoicePaymentNotFoundError();
    }

    let transactionOwnerCheck:
      | { id: bigint; user_id: bigint }
      | null = null;
    if (payment.transaction_id) {
      transactionOwnerCheck = await this.prismaClient.transactions.findUnique({
        where: { id: payment.transaction_id },
        select: { id: true, user_id: true },
      });

      if (!transactionOwnerCheck) {
        throw new TransactionNotFoundError();
      }
      if (transactionOwnerCheck.user_id !== userId) {
        throw new TransactionOwnershipError();
      }
    }

    await this.prismaClient.$transaction(async (tx) => {
      if (payment.transaction_id) {
        await tx.transactions.delete({ where: { id: payment.transaction_id } });
      }

      await tx.invoice_payments.delete({ where: { id: payment.id } });

      const aggregate = await tx.invoice_payments.aggregate({
        where: { invoice_id: invoiceId },
        _sum: { amount: true },
      });

      const paid = new Prisma.Decimal(aggregate._sum.amount ?? 0);
      const status = this.computeInvoiceStatus(new Prisma.Decimal(invoice.total_ttc ?? 0), paid);

      await tx.invoices.update({
        where: { id: invoiceId },
        data: { amount_paid_cached: paid, status },
      });
    });
  }

  private computeInvoiceStatus(total: Prisma.Decimal, paid: Prisma.Decimal) {
    if (paid.gte(total)) return 'paid';
    if (paid.gt(0)) return 'partially_paid';
    return 'issued';
  }
}

export const invoicePaymentService = new InvoicePaymentService(prisma);
