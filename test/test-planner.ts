import { userService } from '@/modules/user/user.service';
import { projectTaskService } from '@/modules/project/project-task.service';
import { projectMilestoneService } from '@/modules/project/project-milestone.service';
import { projectsService } from '@/modules/project/project.service';
import { plannerService } from '@/modules/planner/planner.service';

async function main() {
  console.log('🔹 Planner smoke test starting...');

  const ts = Date.now();
  const email = `planner.user+${ts}@example.com`;

  const { user } = await userService.createUserWithDefaultSettings({
    email,
    passwordHash: 'dummy',
    displayName: 'Planner User',
  });

  const project = await projectsService.createProject({
    userId: user.id,
    name: `Project Planner ${ts}`,
    currency: 'EUR',
    services: [],
  });

  const task = await projectTaskService.addTask({
    userId: user.id,
    projectId: project.project.id,
    title: 'Task 1',
    dueDate: new Date(),
  });

  const milestone = await projectMilestoneService.addMilestone({
    userId: user.id,
    projectId: project.project.id,
    name: 'Milestone 1',
    dueDate: new Date(),
  });

  const timeline = await plannerService.getProjectTimeline({
    userId: user.id,
    projectId: project.project.id,
  });

  console.log('✅ Timeline:', {
    projectId: timeline.project.id,
    tasks: timeline.tasks.length,
    milestones: timeline.milestones.length,
  });

  const calendar = await plannerService.getUserWorkloadCalendar({
    userId: user.id,
    from: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    to: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  console.log('✅ Workload calendar days:', calendar.days.length);

  if (!timeline.tasks.some((t) => t.id === task.id)) throw new Error('Task missing in timeline');
  if (!timeline.milestones.some((m) => m.id === milestone.id)) throw new Error('Milestone missing in timeline');
  if (calendar.days.length === 0) throw new Error('Calendar should have entries');

  console.log('✅ Planner smoke test completed successfully.');
}

main().catch((err) => {
  console.error('❌ Planner smoke test failed:', err);
  process.exit(1);
});
