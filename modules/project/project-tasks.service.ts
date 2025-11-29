import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizeProjectId, normalizeUserId } from '@/modules/shared/ids';
import { assertProjectOwnedByUser, assertUserExists } from '@/modules/shared/assertions';
import { ProjectTaskNotFoundError, ProjectTaskOwnershipError } from '@/modules/shared/errors';

const projectTaskSelect = {
  id: true,
  project_id: true,
  name: true,
  description: true,
  status: true,
  start_date: true,
  due_date: true,
  completed_at: true,
  progress_pct: true,
  sort_index: true,
  estimated_hours: true,
  actual_hours: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.ProjectTaskSelect;

export type ProjectTaskSummary = Prisma.ProjectTaskGetPayload<{
  select: typeof projectTaskSelect;
}>;

export class ProjectTasksService {
  constructor(private readonly prismaClient: PrismaClient) {}

  async listForProject(userIdInput: bigint, projectIdInput: bigint) {
    const userId = normalizeUserId(userIdInput);
    const projectId = normalizeProjectId(projectIdInput);

    await assertUserExists(this.prismaClient, userId);
    await assertProjectOwnedByUser(this.prismaClient, projectId, userId);

    return this.prismaClient.projectTask.findMany({
      where: { project_id: projectId },
      select: projectTaskSelect,
      orderBy: [{ start_date: 'asc' }, { sort_index: 'asc' }, { id: 'asc' }],
    });
  }

  async createForProject(input: {
    userId: bigint;
    projectId: bigint;
    name: string;
    description?: string | null;
    status?: string;
    startDate?: Date | null;
    dueDate?: Date | null;
    progressPct?: number;
    sortIndex?: number;
    estimatedHours?: number | null;
  }) {
    const userId = normalizeUserId(input.userId);
    const projectId = normalizeProjectId(input.projectId);

    await assertUserExists(this.prismaClient, userId);
    await assertProjectOwnedByUser(this.prismaClient, projectId, userId);

    const created = await this.prismaClient.projectTask.create({
      data: {
        project_id: projectId,
        name: input.name,
        description: input.description ?? null,
        status: input.status ?? 'todo',
        start_date: input.startDate ?? null,
        due_date: input.dueDate ?? null,
        progress_pct: input.progressPct ?? 0,
        sort_index: input.sortIndex ?? 0,
        estimated_hours:
          input.estimatedHours != null ? new Prisma.Decimal(input.estimatedHours) : null,
      },
      select: projectTaskSelect,
    });

    return created;
  }

  async getForProject(taskIdInput: bigint, userIdInput: bigint) {
    const userId = normalizeUserId(userIdInput);
    await assertUserExists(this.prismaClient, userId);

    const taskId = BigInt(taskIdInput);

    const task = await this.prismaClient.projectTask.findUnique({
      where: { id: taskId },
      select: {
        ...projectTaskSelect,
        project: { select: { id: true, user_id: true } },
      },
    });

    if (!task) {
      throw new ProjectTaskNotFoundError();
    }
    if (task.project.user_id !== userId) {
      throw new ProjectTaskOwnershipError();
    }

    const { project, ...rest } = task as any;
    return rest as ProjectTaskSummary;
  }

  async updateTask(
    taskIdInput: bigint,
    userIdInput: bigint,
    updates: {
      name?: string;
      description?: string | null;
      status?: string;
      startDate?: Date | null;
      dueDate?: Date | null;
      completedAt?: Date | null;
      progressPct?: number;
      sortIndex?: number;
      estimatedHours?: number | null;
      actualHours?: number | null;
    },
  ) {
    const userId = normalizeUserId(userIdInput);
    await assertUserExists(this.prismaClient, userId);

    const taskId = BigInt(taskIdInput);

    const existing = await this.prismaClient.projectTask.findUnique({
      where: { id: taskId },
      select: {
        ...projectTaskSelect,
        project: { select: { id: true, user_id: true } },
      },
    });

    if (!existing) {
      throw new ProjectTaskNotFoundError();
    }
    if (existing.project.user_id !== userId) {
      throw new ProjectTaskOwnershipError();
    }

    const data: Prisma.ProjectTaskUpdateInput = {};
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.description !== undefined) data.description = updates.description;
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.startDate !== undefined) data.start_date = updates.startDate;
    if (updates.dueDate !== undefined) data.due_date = updates.dueDate;
    if (updates.completedAt !== undefined) data.completed_at = updates.completedAt;
    if (updates.progressPct !== undefined) data.progress_pct = updates.progressPct;
    if (updates.sortIndex !== undefined) data.sort_index = updates.sortIndex;
    if (updates.estimatedHours !== undefined) {
      data.estimated_hours =
        updates.estimatedHours == null ? null : new Prisma.Decimal(updates.estimatedHours);
    }
    if (updates.actualHours !== undefined) {
      data.actual_hours =
        updates.actualHours == null ? null : new Prisma.Decimal(updates.actualHours);
    }

    const updated = await this.prismaClient.projectTask.update({
      where: { id: taskId },
      data,
      select: projectTaskSelect,
    });

    return updated;
  }

  async deleteTask(taskIdInput: bigint, userIdInput: bigint): Promise<void> {
    const userId = normalizeUserId(userIdInput);
    await assertUserExists(this.prismaClient, userId);

    const taskId = BigInt(taskIdInput);

    const existing = await this.prismaClient.projectTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        project: { select: { id: true, user_id: true } },
      },
    });

    if (!existing) {
      throw new ProjectTaskNotFoundError();
    }
    if (existing.project.user_id !== userId) {
      throw new ProjectTaskOwnershipError();
    }

    await this.prismaClient.projectTask.delete({ where: { id: taskId } });
  }
}

export const projectTasksService = new ProjectTasksService(prisma);
