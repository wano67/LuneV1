import { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizeProjectId, normalizeUserId } from '@/modules/shared/ids';
import { assertProjectOwnedByUser } from '@/modules/shared/assertions';

const taskSelect = {
  id: true,
  name: true,
  status: true,
  start_date: true,
  due_date: true,
  completed_at: true,
  progress_pct: true,
  estimated_hours: true,
  actual_hours: true,
  dependencies: {
    select: { depends_on: true },
  },
} as const;

type TaskRow = {
  id: bigint;
  name: string;
  status: string;
  start_date: Date | null;
  due_date: Date | null;
  completed_at: Date | null;
  progress_pct: number;
  estimated_hours: any | null;
  actual_hours: any | null;
  dependencies: { depends_on: bigint }[];
};

const decimalToNumber = (value: any): number => {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value.toNumber === 'function') return value.toNumber();
  return Number(value);
};

const isLate = (task: TaskRow, today: Date): boolean => {
  return task.status !== 'done' && !!task.due_date && task.due_date.getTime() < today.getTime();
};

export class ProjectInsightsService {
  constructor(private readonly prismaClient: PrismaClient) {}

  async getOverview(userIdInput: bigint, projectIdInput: bigint) {
    const userId = normalizeUserId(userIdInput);
    const projectId = normalizeProjectId(projectIdInput);

    await assertProjectOwnedByUser(this.prismaClient, projectId, userId);

    const tasks = (await this.prismaClient.projectTask.findMany({
      where: { project_id: projectId },
      select: taskSelect,
      orderBy: { id: 'asc' },
    })) as TaskRow[];

    const today = new Date();

    const stats = {
      total: tasks.length,
      todo: 0,
      inProgress: 0,
      blocked: 0,
      done: 0,
    };

    let progressSum = 0;
    const taskStatusMap = new Map<bigint, string>();
    for (const task of tasks) {
      taskStatusMap.set(task.id, task.status);
      if (task.status === 'todo') stats.todo += 1;
      else if (task.status === 'in_progress') stats.inProgress += 1;
      else if (task.status === 'blocked') stats.blocked += 1;
      else if (task.status === 'done') stats.done += 1;
      progressSum += task.progress_pct ?? 0;
    }

    const allHaveEstimates =
      tasks.length > 0 && tasks.every((t) => t.estimated_hours != null && decimalToNumber(t.estimated_hours) > 0);

    let progressPct = 0;
    let weighted = false;
    if (allHaveEstimates) {
      const weightedSum = tasks.reduce(
        (sum, t) => sum + (decimalToNumber(t.estimated_hours) || 0) * (t.progress_pct ?? 0),
        0,
      );
      const totalEst = tasks.reduce((sum, t) => sum + decimalToNumber(t.estimated_hours), 0);
      progressPct = totalEst > 0 ? weightedSum / totalEst : 0;
      weighted = true;
    } else {
      progressPct = tasks.length > 0 ? progressSum / tasks.length : 0;
    }

    let lateTasks = 0;
    let upcomingDeadlines = 0;
    let nextDeadline: string | null = null;

    const missingDates: string[] = [];
    const lateTaskIds: string[] = [];
    const blockingTasks: string[] = [];
    const overrunTasks: string[] = [];

    for (const task of tasks) {
      if (!task.start_date && !task.due_date) {
        missingDates.push(task.id.toString());
      }
      if (isLate(task, today)) {
        lateTasks += 1;
        lateTaskIds.push(task.id.toString());
      } else if (task.status !== 'done' && task.due_date) {
        upcomingDeadlines += 1;
        const iso = task.due_date.toISOString();
        if (!nextDeadline || iso < nextDeadline) {
          nextDeadline = iso;
        }
      }

      // blocking dependencies: any dependency not done
      if (task.dependencies && task.dependencies.length > 0) {
        const hasBlocking = task.dependencies.some((dep) => {
          const depStatus = taskStatusMap.get(dep.depends_on);
          return depStatus && depStatus !== 'done';
        });
        if (hasBlocking) blockingTasks.push(task.id.toString());
      }

      const est = decimalToNumber(task.estimated_hours);
      const act = decimalToNumber(task.actual_hours);
      if (est > 0 && act > est) {
        overrunTasks.push(task.id.toString());
      }
    }

    const startDates = tasks.map((t) => t.start_date).filter((d): d is Date => !!d);
    const dueDates = tasks.map((t) => t.due_date).filter((d): d is Date => !!d);

    const ganttStart = startDates.length ? new Date(Math.min(...startDates.map((d) => d.getTime()))) : null;
    const ganttEnd = dueDates.length ? new Date(Math.max(...dueDates.map((d) => d.getTime()))) : null;

    return {
      taskStats: stats,
      progress: {
        progressPct,
        weighted,
      },
      risks: {
        lateTasks,
        upcomingDeadlines,
        nextDeadline,
      },
      ganttRange: {
        start: ganttStart ? ganttStart.toISOString() : null,
        end: ganttEnd ? ganttEnd.toISOString() : null,
      },
      riskSignals: {
        missingDates: { count: missingDates.length, taskIds: missingDates },
        lateTasks: { count: lateTaskIds.length, taskIds: lateTaskIds },
        blockingDependencies: { count: blockingTasks.length, taskIds: blockingTasks },
        timeOverruns: { count: overrunTasks.length, taskIds: overrunTasks },
      },
      generatedAt: new Date().toISOString(),
    };
  }
}

export const projectInsightsService = new ProjectInsightsService(prisma);
