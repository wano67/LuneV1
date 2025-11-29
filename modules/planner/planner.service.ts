import { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizeProjectId, normalizeUserId } from '@/modules/shared/ids';
import { assertUserExists } from '@/modules/shared/assertions';
import { ProjectOwnershipError, ProjectNotFoundError } from '@/modules/shared/errors';

export class PlannerService {
  constructor(private readonly prismaClient: PrismaClient) {}

  async getProjectTimeline(options: {
    userId: bigint;
    businessId?: bigint;
    projectId: bigint;
  }): Promise<{
    project: any;
    tasks: Array<{ id: bigint; title: string; status: string; startDate?: Date; dueDate?: Date; priority?: string }>;
    milestones: Array<{ id: bigint; name: string; status: string; dueDate: Date; weightPct?: number }>;
  }> {
    const userId = normalizeUserId(options.userId);
    const projectId = normalizeProjectId(options.projectId);
    await assertUserExists(this.prismaClient, userId);

    const project = await this.prismaClient.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        user_id: true,
        business_id: true,
        name: true,
        status: true,
        start_date: true,
        due_date: true,
        priority: true,
      },
    });

    if (!project) throw new ProjectNotFoundError();
    if (project.user_id !== userId) throw new ProjectOwnershipError();
    if (options.businessId !== undefined && project.business_id !== options.businessId) {
      throw new ProjectOwnershipError();
    }

    const [tasks, milestones] = await Promise.all([
      this.prismaClient.projectTask.findMany({
        where: { project_id: projectId },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          due_date: true,
          created_at: true,
        },
        orderBy: [{ due_date: 'asc' }, { id: 'asc' }],
      }),
      this.prismaClient.projectMilestone.findMany({
        where: { project_id: projectId },
        select: {
          id: true,
          name: true,
          status: true,
          due_date: true,
          weight_pct: true,
        },
        orderBy: [{ due_date: 'asc' }, { id: 'asc' }],
      }),
    ]);

    return {
      project,
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        startDate: undefined,
        dueDate: t.due_date ?? undefined,
        priority: t.priority ?? undefined,
      })),
      milestones: milestones.map((m) => ({
        id: m.id,
        name: m.name,
        status: m.status,
        dueDate: m.due_date ?? new Date(),
        weightPct: m.weight_pct ?? undefined,
      })),
    };
  }

  async getUserWorkloadCalendar(options: {
    userId: bigint;
    from: Date;
    to: Date;
  }): Promise<{
    days: Array<{
      date: string;
      tasks: Array<{ projectId: bigint; taskId: bigint; title: string; status: string; priority?: string }>;
      milestones: Array<{ projectId: bigint; milestoneId: bigint; name: string; status: string }>;
    }>;
  }> {
    const userId = normalizeUserId(options.userId);
    await assertUserExists(this.prismaClient, userId);

    const fromDate = new Date(options.from);
    const toDate = new Date(options.to);

    const [tasks, milestones] = await Promise.all([
      this.prismaClient.projectTask.findMany({
        where: {
          project: { user_id: userId },
          due_date: { gte: fromDate, lte: toDate },
        },
        select: {
          id: true,
          project_id: true,
          title: true,
          status: true,
          priority: true,
          due_date: true,
        },
      }),
      this.prismaClient.projectMilestone.findMany({
        where: {
          project: { user_id: userId },
          due_date: { gte: fromDate, lte: toDate },
        },
        select: {
          id: true,
          project_id: true,
          name: true,
          status: true,
          due_date: true,
        },
      }),
    ]);

    const dayMap = new Map<
      string,
      {
        tasks: Array<{ projectId: bigint; taskId: bigint; title: string; status: string; priority?: string }>;
        milestones: Array<{ projectId: bigint; milestoneId: bigint; name: string; status: string }>;
      }
    >();

    const addTask = (dateStr: string, task: { projectId: bigint; taskId: bigint; title: string; status: string; priority?: string }) => {
      const bucket = dayMap.get(dateStr) ?? { tasks: [], milestones: [] };
      bucket.tasks.push(task);
      dayMap.set(dateStr, bucket);
    };

    const addMilestone = (dateStr: string, milestone: { projectId: bigint; milestoneId: bigint; name: string; status: string }) => {
      const bucket = dayMap.get(dateStr) ?? { tasks: [], milestones: [] };
      bucket.milestones.push(milestone);
      dayMap.set(dateStr, bucket);
    };

    for (const t of tasks) {
      if (!t.due_date) continue;
      const dateStr = t.due_date.toISOString().slice(0, 10);
      addTask(dateStr, {
        projectId: t.project_id,
        taskId: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority ?? undefined,
      });
    }

    for (const m of milestones) {
      if (!m.due_date) continue;
      const dateStr = m.due_date.toISOString().slice(0, 10);
      addMilestone(dateStr, {
        projectId: m.project_id,
        milestoneId: m.id,
        name: m.name,
        status: m.status,
      });
    }

    const days = Array.from(dayMap.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, payload]) => ({ date, ...payload }));

    return { days };
  }
}

export const plannerService = new PlannerService(prisma);
