import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  ProjectId,
  ProjectTaskId,
  UserId,
  normalizeProjectId,
  normalizeProjectTaskId,
  normalizeUserId,
} from '@/modules/shared/ids';
import { ProjectNotFoundError, ProjectOwnershipError } from '@/modules/shared/errors';

export type ProjectTaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';

export interface AddTaskInput {
  userId: UserId;
  projectId: ProjectId;
  title: string;
  description?: string | null;
  startDate?: Date | null;
  dueDate?: Date | null;
  progressPct?: number;
  sortIndex?: number;
  estimatedHours?: number | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: ProjectTaskStatus;
  dueDate?: Date | null;
  startDate?: Date | null;
  completedAt?: Date | null;
  progressPct?: number;
  sortIndex?: number;
  estimatedHours?: number | null;
  actualHours?: number | null;
}

const taskSelect = {
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
  select: typeof taskSelect;
}>;

async function assertProjectOwnedByUser(prismaClient: PrismaClient, projectId: bigint, userId: bigint) {
  const project = await prismaClient.project.findUnique({
    where: { id: projectId },
    select: { id: true, user_id: true },
  });

  if (!project) throw new ProjectNotFoundError();
  if (project.user_id !== userId) throw new ProjectOwnershipError();
}

export class ProjectTaskService {
  constructor(private readonly prismaClient: PrismaClient) {}

  async addTask(input: AddTaskInput): Promise<ProjectTaskSummary> {
    const userId = normalizeUserId(input.userId);
    const projectId = normalizeProjectId(input.projectId);

    await assertProjectOwnedByUser(this.prismaClient, projectId, userId);

    const currentCount = await this.prismaClient.projectTask.count({ where: { project_id: projectId } });
    const task = await this.prismaClient.projectTask.create({
      data: {
        project_id: projectId,
        name: input.title.trim(),
        description: input.description ?? null,
        status: 'todo',
        start_date: input.startDate ?? null,
        due_date: input.dueDate ?? null,
        progress_pct: input.progressPct ?? 0,
        sort_index: input.sortIndex ?? currentCount,
        estimated_hours: input.estimatedHours != null ? new Prisma.Decimal(input.estimatedHours) : null,
      },
      select: taskSelect,
    });

    return task;
  }

  async updateTask(taskIdInput: ProjectTaskId, userIdInput: UserId, input: UpdateTaskInput): Promise<ProjectTaskSummary> {
    const userId = normalizeUserId(userIdInput);
    const taskId = normalizeProjectTaskId(taskIdInput);

    const existing = await this.prismaClient.projectTask.findUnique({
      where: { id: taskId },
      select: { ...taskSelect, project: { select: { id: true, user_id: true } } },
    });

    if (!existing) throw new ProjectNotFoundError('Task not found');
    if (existing.project.user_id !== userId) throw new ProjectOwnershipError();

    const data: Prisma.ProjectTaskUncheckedUpdateInput = {};
    if (input.title !== undefined) data.name = input.title.trim();
    if (input.description !== undefined) data.description = input.description;
    if (input.status !== undefined) data.status = input.status;
    if (input.dueDate !== undefined) data.due_date = input.dueDate;
    if (input.startDate !== undefined) data.start_date = input.startDate;
    if (input.completedAt !== undefined) data.completed_at = input.completedAt;
    if (input.progressPct !== undefined) data.progress_pct = input.progressPct;
    if (input.sortIndex !== undefined) data.sort_index = input.sortIndex;
    if (input.estimatedHours !== undefined) {
      data.estimated_hours = input.estimatedHours == null ? null : new Prisma.Decimal(input.estimatedHours);
    }
    if (input.actualHours !== undefined) {
      data.actual_hours = input.actualHours == null ? null : new Prisma.Decimal(input.actualHours);
    }

    const updated = await this.prismaClient.projectTask.update({
      where: { id: taskId },
      data,
      select: taskSelect,
    });

    return updated;
  }

  async listTasksForProject(
    projectIdInput: ProjectId,
    userIdInput: UserId,
    filters: { status?: ProjectTaskStatus } = {}
  ): Promise<ProjectTaskSummary[]> {
    const userId = normalizeUserId(userIdInput);
    const projectId = normalizeProjectId(projectIdInput);
    await assertProjectOwnedByUser(this.prismaClient, projectId, userId);

    const where: Prisma.ProjectTaskWhereInput = { project_id: projectId };
    if (filters.status) {
      where.status = filters.status;
    }

    return this.prismaClient.projectTask.findMany({
      where,
      select: taskSelect,
      orderBy: [{ sort_index: 'asc' }, { id: 'asc' }],
    });
  }
}

export const projectTaskService = new ProjectTaskService(prisma);
