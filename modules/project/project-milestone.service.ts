import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  ProjectId,
  ProjectMilestoneId,
  UserId,
  normalizeProjectId,
  normalizeProjectMilestoneId,
  normalizeUserId,
} from '@/modules/shared/ids';
import { ProjectNotFoundError, ProjectOwnershipError } from '@/modules/shared/errors';

export interface AddMilestoneInput {
  userId: UserId;
  projectId: ProjectId;
  name: string;
  description?: string;
  dueDate?: Date;
  weightPct?: number | null;
}

export interface UpdateMilestoneInput {
  name?: string;
  description?: string | null;
  dueDate?: Date | null;
  status?: 'not_started' | 'in_progress' | 'completed' | 'cancelled';
  orderIndex?: number;
  weightPct?: number | null;
}

const milestoneSelect = {
  id: true,
  project_id: true,
  name: true,
  description: true,
  due_date: true,
  status: true,
  order_index: true,
  weight_pct: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.ProjectMilestoneSelect;

export type ProjectMilestoneSummary = Prisma.ProjectMilestoneGetPayload<{
  select: typeof milestoneSelect;
}>;

async function assertProjectOwnedByUser(prismaClient: PrismaClient, projectId: bigint, userId: bigint) {
  const project = await prismaClient.project.findUnique({
    where: { id: projectId },
    select: { id: true, user_id: true },
  });

  if (!project) throw new ProjectNotFoundError();
  if (project.user_id !== userId) throw new ProjectOwnershipError();
}

export class ProjectMilestoneService {
  constructor(private readonly prismaClient: PrismaClient) {}

  async addMilestone(input: AddMilestoneInput): Promise<ProjectMilestoneSummary> {
    const userId = normalizeUserId(input.userId);
    const projectId = normalizeProjectId(input.projectId);

    await assertProjectOwnedByUser(this.prismaClient, projectId, userId);

    const currentCount = await this.prismaClient.projectMilestone.count({ where: { project_id: projectId } });

    const milestone = await this.prismaClient.projectMilestone.create({
      data: {
        project_id: projectId,
        name: input.name.trim(),
        description: input.description ?? null,
        due_date: input.dueDate ?? null,
        status: 'not_started',
        order_index: currentCount,
        weight_pct: input.weightPct ?? null,
      },
      select: milestoneSelect,
    });

    return milestone;
  }

  async updateMilestone(
    milestoneIdInput: ProjectMilestoneId,
    userIdInput: UserId,
    input: UpdateMilestoneInput
  ): Promise<ProjectMilestoneSummary> {
    const userId = normalizeUserId(userIdInput);
    const milestoneId = normalizeProjectMilestoneId(milestoneIdInput);

    const existing = await this.prismaClient.projectMilestone.findUnique({
      where: { id: milestoneId },
      select: { ...milestoneSelect, project: { select: { id: true, user_id: true } } },
    });

    if (!existing) throw new ProjectNotFoundError('Milestone not found');
    if (existing.project.user_id !== userId) throw new ProjectOwnershipError();

    const data: Prisma.ProjectMilestoneUncheckedUpdateInput = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.description !== undefined) data.description = input.description;
    if (input.dueDate !== undefined) data.due_date = input.dueDate;
    if (input.status !== undefined) data.status = input.status;
    if (input.orderIndex !== undefined) data.order_index = input.orderIndex;
    if (input.weightPct !== undefined) data.weight_pct = input.weightPct;

    const updated = await this.prismaClient.projectMilestone.update({
      where: { id: milestoneId },
      data,
      select: milestoneSelect,
    });

    return updated;
  }

  async listMilestonesForProject(projectIdInput: ProjectId, userIdInput: UserId): Promise<ProjectMilestoneSummary[]> {
    const userId = normalizeUserId(userIdInput);
    const projectId = normalizeProjectId(projectIdInput);

    await assertProjectOwnedByUser(this.prismaClient, projectId, userId);

    return this.prismaClient.projectMilestone.findMany({
      where: { project_id: projectId },
      select: milestoneSelect,
      orderBy: [{ order_index: 'asc' }, { id: 'asc' }],
    });
  }
}

export const projectMilestoneService = new ProjectMilestoneService(prisma);
