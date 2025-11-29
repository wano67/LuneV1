import { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizeBusinessId, normalizeUserId } from '@/modules/shared/ids';
import { assertBusinessOwnedByUser, assertUserExists } from '@/modules/shared/assertions';

function daysBetween(start: Date, end: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return (end.getTime() - start.getTime()) / msPerDay;
}

export class BusinessInsightsPipelineService {
  constructor(private readonly prismaClient: PrismaClient) {}

  async getPipeline(options: { userId: bigint; businessId: bigint }) {
    const userId = normalizeUserId(options.userId);
    const businessId = normalizeBusinessId(options.businessId);

    await assertUserExists(this.prismaClient, userId);
    await assertBusinessOwnedByUser(this.prismaClient, businessId, userId);

    const quotes = await this.prismaClient.quotes.findMany({
      where: { business_id: businessId },
      select: {
        id: true,
        status: true,
        issue_date: true,
        valid_until: true,
        total_ttc: true,
        updated_at: true,
      },
      orderBy: { issue_date: 'desc' },
    });

    let quoteCount = 0;
    let acceptedCount = 0;
    let totalQuoted = 0;
    let totalAccepted = 0;
    let timeToAcceptSum = 0;
    let timeToAcceptCount = 0;

    for (const q of quotes) {
      quoteCount += 1;
      totalQuoted += Number(q.total_ttc ?? 0);

      if (q.status === 'accepted') {
        acceptedCount += 1;
        totalAccepted += Number(q.total_ttc ?? 0);
        const acceptDate = q.updated_at ?? new Date();
        const issueDate = q.issue_date ?? acceptDate;
        timeToAcceptSum += daysBetween(issueDate, acceptDate);
        timeToAcceptCount += 1;
      }
    }

    const conversionRate = quoteCount > 0 ? acceptedCount / quoteCount : 0;
    const avgTimeToAcceptDays = timeToAcceptCount > 0 ? timeToAcceptSum / timeToAcceptCount : 0;

    return {
      businessId: businessId.toString(),
      quoteCount,
      acceptedCount,
      conversionRate,
      avgTimeToAcceptDays,
      totalQuoted,
      totalAccepted,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const businessInsightsPipelineService = new BusinessInsightsPipelineService(prisma);
