import { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { UserId, BusinessId, normalizeUserId, normalizeBusinessId } from '@/modules/shared/ids';
import { assertBusinessOwnedByUser, assertUserExists } from '@/modules/shared/assertions';

export interface RecordPaymentInput {
  userId: UserId;
  businessId: BusinessId;
  invoiceId: bigint;
  amount: number;
  date?: Date | string;
  notes?: string | null;
}

export class PaymentsService {
  constructor(private readonly prismaClient: PrismaClient) {}

  async recordPayment(input: RecordPaymentInput): Promise<never> {
    const userId = normalizeUserId(input.userId);
    const businessId = normalizeBusinessId(input.businessId);
    await assertUserExists(this.prismaClient, userId);
    await assertBusinessOwnedByUser(this.prismaClient, businessId, userId);
    throw new Error('Not implemented yet');
  }

  async listPaymentsForInvoice(_invoiceId: bigint, userIdInput: UserId): Promise<never> {
    await assertUserExists(this.prismaClient, normalizeUserId(userIdInput));
    throw new Error('Not implemented yet');
  }
}

export const paymentsService = new PaymentsService(prisma);
