import { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizeProjectId, normalizeUserId } from '@/modules/shared/ids';
import { assertProjectOwnedByUser, assertUserExists } from '@/modules/shared/assertions';

type Granularity = 'week' | 'month';

export class ProjectWorkloadService {
  constructor(private readonly prismaClient: PrismaClient) {}

  private decimalToNumber(value: any): number {
    if (value == null) return 0;
    if (typeof value === 'number') return value;
    if (typeof value.toNumber === 'function') return value.toNumber();
    return Number(value);
  }

  private startOfWeek(date: Date): Date {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = d.getUTCDay() || 7; // Sunday=0 -> 7
    d.setUTCDate(d.getUTCDate() - (day - 1));
    return d;
  }

  private startOfMonth(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  private addDays(date: Date, days: number): Date {
    const d = new Date(date.getTime());
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  }

  private addMonths(date: Date, months: number): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()));
  }

  async getWorkload(options: {
    userId: bigint;
    projectId: bigint;
    from?: Date;
    to?: Date;
    granularity?: Granularity;
  }) {
    const userId = normalizeUserId(options.userId);
    const projectId = normalizeProjectId(options.projectId);
    const granularity: Granularity = options.granularity ?? 'week';

    await assertUserExists(this.prismaClient, userId);
    await assertProjectOwnedByUser(this.prismaClient, projectId, userId);

    const tasks = await this.prismaClient.projectTask.findMany({
      where: { project_id: projectId },
      select: {
        id: true,
        name: true,
        status: true,
        start_date: true,
        due_date: true,
        completed_at: true,
        estimated_hours: true,
        actual_hours: true,
      },
      orderBy: [{ start_date: 'asc' }, { sort_index: 'asc' }, { id: 'asc' }],
    });

    let totalEstimated = 0;
    let totalActual = 0;

    for (const t of tasks) {
      totalEstimated += this.decimalToNumber(t.estimated_hours);
      totalActual += this.decimalToNumber(t.actual_hours);
    }

    const remaining = Math.max(totalEstimated - totalActual, 0);
    const completionRate = totalEstimated > 0 ? totalActual / totalEstimated : 0;

    const byStatusMap = new Map<string, { estimatedHours: number; actualHours: number }>();
    const statuses = ['todo', 'in_progress', 'blocked', 'done'] as const;
    for (const s of statuses) {
      byStatusMap.set(s, { estimatedHours: 0, actualHours: 0 });
    }

    for (const t of tasks) {
      const key = statuses.includes(t.status as any) ? (t.status as (typeof statuses)[number]) : 'todo';
      const bucket = byStatusMap.get(key)!;
      bucket.estimatedHours += this.decimalToNumber(t.estimated_hours);
      bucket.actualHours += this.decimalToNumber(t.actual_hours);
    }

    const byStatus = statuses.map((s) => {
      const b = byStatusMap.get(s)!;
      return {
        status: s,
        estimatedHours: b.estimatedHours,
        actualHours: b.actualHours,
      };
    });

    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    for (const t of tasks) {
      const candidates = [t.start_date, t.due_date].filter(Boolean) as Date[];
      for (const d of candidates) {
        if (!minDate || d < minDate) minDate = d;
        if (!maxDate || d > maxDate) maxDate = d;
      }
    }

    if (options.from) minDate = options.from;
    if (options.to) maxDate = options.to;

    let rangeStart: Date | null = minDate;
    let rangeEnd: Date | null = maxDate;

    if (!rangeStart || !rangeEnd) {
      return {
        projectId: projectId.toString(),
        totalEstimatedHours: totalEstimated,
        totalActualHours: totalActual,
        remainingHours: remaining,
        completionRate,
        granularity,
        rangeStart: null,
        rangeEnd: null,
        byStatus,
        byPeriod: [],
        topByActualHours: [],
        topByOverrun: [],
        generatedAt: new Date().toISOString(),
      };
    }

    if (granularity === 'week') {
      rangeStart = this.startOfWeek(rangeStart);
      rangeEnd = this.startOfWeek(rangeEnd);
    } else {
      rangeStart = this.startOfMonth(rangeStart);
      rangeEnd = this.startOfMonth(rangeEnd);
    }

    type Bucket = { periodKey: string; periodStart: Date; periodEnd: Date; estimatedHours: number; actualHours: number };
    const byPeriod: Bucket[] = [];

    let cursor = new Date(rangeStart.getTime());
    while (cursor <= rangeEnd) {
      let next: Date;
      let periodKey: string;

      if (granularity === 'week') {
        next = this.addDays(cursor, 7);
        const year = cursor.getUTCFullYear();
        const jan1 = new Date(Date.UTC(year, 0, 1));
        const days = Math.floor((cursor.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const week = Math.ceil((days + (jan1.getUTCDay() === 0 ? 6 : jan1.getUTCDay() - 1)) / 7);
        periodKey = `${year}-W${String(week).padStart(2, '0')}`;
      } else {
        const year = cursor.getUTCFullYear();
        const month = cursor.getUTCMonth() + 1;
        periodKey = `${year}-${String(month).padStart(2, '0')}`;
        next = this.addMonths(cursor, 1);
      }

      const periodStart = new Date(cursor.getTime());
      const periodEnd = this.addDays(next, -1);

      byPeriod.push({
        periodKey,
        periodStart,
        periodEnd,
        estimatedHours: 0,
        actualHours: 0,
      });

      cursor = next;
    }

    for (const t of tasks) {
      const when = t.due_date ?? t.start_date;
      if (!when) continue;

      for (const bucket of byPeriod) {
        if (when >= bucket.periodStart && when <= bucket.periodEnd) {
          bucket.estimatedHours += this.decimalToNumber(t.estimated_hours);
          bucket.actualHours += this.decimalToNumber(t.actual_hours);
          break;
        }
      }
    }

    const byPeriodDto = byPeriod.map((b) => ({
      periodKey: b.periodKey,
      periodStart: b.periodStart.toISOString(),
      periodEnd: b.periodEnd.toISOString(),
      estimatedHours: b.estimatedHours,
      actualHours: b.actualHours,
    }));

    const taskInsights = tasks.map((t) => {
      const estimated = this.decimalToNumber(t.estimated_hours);
      const actual = this.decimalToNumber(t.actual_hours);
      return {
        taskId: t.id.toString(),
        name: t.name,
        status: t.status,
        estimatedHours: t.estimated_hours != null ? estimated : null,
        actualHours: t.actual_hours != null ? actual : null,
        ratio: estimated > 0 ? actual / estimated : null,
      };
    });

    const topByActualHours = taskInsights
      .filter((t) => t.actualHours != null)
      .sort((a, b) => (b.actualHours ?? 0) - (a.actualHours ?? 0))
      .slice(0, 5);

    const topByOverrun = taskInsights
      .filter((t) => t.ratio != null)
      .sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))
      .slice(0, 5);

    return {
      projectId: projectId.toString(),
      totalEstimatedHours: totalEstimated,
      totalActualHours: totalActual,
      remainingHours: remaining,
      completionRate,
      granularity,
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd.toISOString(),
      byStatus,
      byPeriod: byPeriodDto,
      topByActualHours,
      topByOverrun,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const projectWorkloadService = new ProjectWorkloadService(prisma);
