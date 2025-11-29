import { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizeBusinessId, normalizeUserId } from '@/modules/shared/ids';
import { assertBusinessOwnedByUser, assertUserExists } from '@/modules/shared/assertions';

function daysBetween(start: Date, end: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return (end.getTime() - start.getTime()) / msPerDay;
}

export class BusinessProjectsPerformanceService {
  constructor(private readonly prismaClient: PrismaClient) {}

  async getPerformance(options: { userId: bigint; businessId: bigint }) {
    const userId = normalizeUserId(options.userId);
    const businessId = normalizeBusinessId(options.businessId);

    await assertUserExists(this.prismaClient, userId);
    await assertBusinessOwnedByUser(this.prismaClient, businessId, userId);

    const projects = await this.prismaClient.project.findMany({
      where: { business_id: businessId },
      select: {
        id: true,
        status: true,
        start_date: true,
        due_date: true,
        completed_at: true,
        created_at: true,
      },
    });

    const totalProjects = projects.length;
    const statusDistributionMap = new Map<string, number>();

    let completedProjects = 0;
    let onTimeProjects = 0;
    let durationSum = 0;
    let durationCount = 0;
    let delaySum = 0;
    let delayCount = 0;

    for (const p of projects) {
      statusDistributionMap.set(p.status, (statusDistributionMap.get(p.status) ?? 0) + 1);

      if (p.completed_at) {
        completedProjects += 1;
        const start = p.start_date ?? p.created_at;
        durationSum += daysBetween(start, p.completed_at);
        durationCount += 1;

        if (p.due_date) {
          if (p.completed_at <= p.due_date) {
            onTimeProjects += 1;
          } else {
            delaySum += daysBetween(p.due_date, p.completed_at);
            delayCount += 1;
          }
        }
      }
    }

    const onTimeRate = completedProjects > 0 ? onTimeProjects / completedProjects : 0;
    const averageDurationDays = durationCount > 0 ? durationSum / durationCount : 0;
    const averageDelayDays = delayCount > 0 ? delaySum / delayCount : 0;

    const statusDistribution = Array.from(statusDistributionMap.entries()).map(([status, count]) => ({
      status,
      count,
    }));

    return {
      businessId: businessId.toString(),
      totalProjects,
      completedProjects,
      onTimeProjects,
      onTimeRate,
      averageDurationDays,
      averageDelayDays,
      statusDistribution,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const businessProjectsPerformanceService = new BusinessProjectsPerformanceService(prisma);
