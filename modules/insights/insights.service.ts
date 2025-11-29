// src/modules/insights/insights.service.ts
import { prisma } from '@/lib/prisma';
import { budgetService } from '@/modules/budget/budget.service';
import { cashflowService } from '@/modules/cashflow/cashflow.service';
import { savingsService } from '@/modules/savings/savings.service';
import { assertUserExists, assertBusinessOwnedByUser } from '@/modules/shared/assertions';
import {
  normalizeUserId,
  normalizeBusinessId,
  type UserId,
  type BusinessId,
} from '@/modules/shared/ids';
import { personalBudgetOverspentRule } from './rules/personal-budget-overspent.rule';
import { personalLifestyleSpendIncreaseRule } from './rules/personal-lifestyle-spend-increase.rule';
import { personalSubscriptionReviewRule } from './rules/personal-subscription-review.rule';
import { businessLateInvoicesRule } from './rules/business-late-invoices.rule';
import { businessLowMarginProjectRule } from './rules/business-low-margin-project.rule';
import { businessUnderTargetRevenueRule } from './rules/business-under-target-revenue.rule';

export type InsightSeverity = 'info' | 'warning' | 'critical';
export type InsightCategory = 'budget' | 'savings' | 'cashflow' | 'spending';

export interface Insight {
  id: string;
  userId: bigint;
  businessId?: bigint | null;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

export class InsightsService {
  /**
   * Compute personal (non-business) insights for a user:
   * - budget overrun (current month)
   * - savings goals behind schedule
   * - cashflow risk (projection turning negative)
   */
  async computePersonalInsights(userIdInput: UserId, opts?: { year?: number; month?: number }): Promise<Insight[]> {
    const userId = normalizeUserId(userIdInput);
    await assertUserExists(prisma, userId);

    const today = new Date();
    const year = opts?.year ?? today.getUTCFullYear();
    const month = opts?.month ?? today.getUTCMonth() + 1;

    const results = await Promise.all([
      this.computeBudgetOverrun(userId, null),
      this.computeSavingsInsights(userId, null),
      this.computeCashflowInsight(userId, null),
      personalBudgetOverspentRule({ userId, year, month }),
      personalLifestyleSpendIncreaseRule({ userId, year, month }),
      personalSubscriptionReviewRule({ userId }),
    ]);

    return results.flatMap((r) => (Array.isArray(r) ? r : r ? [r] : [])).filter(Boolean) as Insight[];
  }

  /**
   * Compute business-specific insights for a given business.
   * Pour l’instant, la logique budget/savings/cashflow business peut être limitée ou
   * alignée sur les règles perso si besoin.
   */
  async computeBusinessInsights(
    userIdInput: UserId,
    businessIdInput: BusinessId,
    opts?: { year?: number; month?: number }
  ): Promise<Insight[]> {
    const userId = normalizeUserId(userIdInput);
    const businessId = normalizeBusinessId(businessIdInput);

    await assertUserExists(prisma, userId);
    await assertBusinessOwnedByUser(prisma, businessId, userId);

    const today = new Date();
    const year = opts?.year ?? today.getUTCFullYear();
    const month = opts?.month ?? today.getUTCMonth() + 1;

    const results = await Promise.all([
      this.computeBudgetOverrun(userId, businessId),
      this.computeSavingsInsights(userId, businessId),
      this.computeCashflowInsight(userId, businessId),
      businessLateInvoicesRule({ userId, businessId }),
      businessLowMarginProjectRule({ userId, businessId }),
      businessUnderTargetRevenueRule({ userId, businessId, year, month }),
    ]);

    return results.flatMap((r) => (Array.isArray(r) ? r : r ? [r] : [])).filter(Boolean) as Insight[];
  }

  /**
   * Budget overrun rule (current month).
   * Pour l’instant, implémenté uniquement pour le scope personnel (businessId = null).
   */
  private async computeBudgetOverrun(
    userId: bigint,
    businessId: bigint | null
  ): Promise<Insight | null> {
    // Phase 1: on ne gère que le budget perso
    if (businessId !== null) return null;

    const overview = await budgetService.computeCurrentPersonalBudgetOverview(userId, {});
    if (!overview) return null;

    if (overview.totalActual <= overview.totalPlanned * 1.1) {
      return null;
    }

    const severity: InsightSeverity =
      overview.totalActual > overview.totalPlanned * 1.25 ? 'critical' : 'warning';

    return {
      id: 'budget_overrun_current_month',
      userId,
      businessId,
      category: 'budget',
      severity,
      title: 'Budget overrun',
      message: 'Actual spending exceeded planned budget for the current month.',
      data: {
        totalPlanned: overview.totalPlanned,
        totalActual: overview.totalActual,
        variance: overview.totalVariance,
        budgetId: overview.budget.id,
      },
    };
  }

  /**
   * Savings rules:
   * - goal far behind schedule near target date
   * - goal behind pace with near target date
   * - theoretical vs actual progress lagging
   * - goal appears completed but not marked as such
   */
  private async computeSavingsInsights(
    userId: bigint,
    businessId: bigint | null
  ): Promise<Insight[]> {
    const insights: Insight[] = [];

    const filter =
      businessId === null
        ? { businessId: null }
        : { businessId };

    const goals = await savingsService.listSavingsGoalsForUser(userId, filter as any);

    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const nearFuture = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    for (const goal of goals) {
      const target = Number(goal.target_amount);
      const current = Number(goal.current_amount_cached);
      const progress = target > 0 ? current / target : 0;

      const createdAt = goal.created_at ? new Date(goal.created_at) : null;
      const targetDate = goal.target_date ? new Date(goal.target_date) : null;

      const totalDuration =
        createdAt && targetDate ? Math.max(1, targetDate.getTime() - createdAt.getTime()) : null;
      const elapsed = createdAt ? now.getTime() - createdAt.getTime() : null;

      const expectedProgress =
        totalDuration && elapsed
          ? Math.min(1, Math.max(0, elapsed / totalDuration))
          : 0;

      // 1) Goal very close & almost no progress
      if (goal.target_date && progress < 0.1 && goal.target_date <= soon) {
        insights.push({
          id: 'savings-behind-schedule',
          userId,
          businessId,
          category: 'savings',
          severity: 'warning',
          title: 'Savings goal at risk',
          message: `Goal "${goal.name}" is far behind schedule.`,
          data: {
            goalId: goal.id,
            targetDate: goal.target_date,
            progress,
          },
        });
      }

      // 2) Target in near future & progress < 50%
      if (targetDate && targetDate <= nearFuture && progress < 0.5) {
        insights.push({
          id: 'savings-behind-schedule-near',
          userId,
          businessId,
          category: 'savings',
          severity: 'warning',
          title: 'Savings goal behind schedule',
          message: `Goal "${goal.name}" is behind the expected pace.`,
          data: {
            goalId: goal.id,
            targetDate: goal.target_date,
            progress,
          },
        });
      }

      // 3) Theoretical vs actual progress (lagging > 20 pts)
      if (expectedProgress > 0 && progress + 0.2 < expectedProgress) {
        insights.push({
          id: 'savings-progress-lagging',
          userId,
          businessId,
          category: 'savings',
          severity: 'warning',
          title: 'Savings progress is lagging',
          message: `Goal "${goal.name}" is behind theoretical progress.`,
          data: {
            goalId: goal.id,
            progress,
            expectedProgress,
          },
        });
      }

      // 4) Completed but not marked as completed
      if (progress >= 1.0 && goal.status !== 'completed') {
        insights.push({
          id: 'savings-complete-pending',
          userId,
          businessId,
          category: 'savings',
          severity: 'info',
          title: 'Savings goal reached',
          message: `Goal "${goal.name}" appears completed. Consider marking it as completed.`,
          data: {
            goalId: goal.id,
            progress,
          },
        });
      }
    }

    return insights;
  }

  /**
   * Cashflow rule:
   * - find first projected date where balance < 0 over the next ~60 days.
   */
  private async computeCashflowInsight(
    userId: bigint,
    businessId: bigint | null
  ): Promise<Insight | null> {
    try {
      const projection =
        businessId === null
          ? await cashflowService.computePersonalCashflowProjection(userId, { horizonDays: 60 })
          : await cashflowService.computeBusinessCashflowProjection(userId, businessId, {
              horizonDays: 60,
            });

      const firstNegative = projection.points.find((p) => p.balance < 0);
      if (!firstNegative) return null;

      return {
        id: 'cashflow_negative_projection',
        userId,
        businessId,
        category: 'cashflow',
        severity: 'critical',
        title: 'Cashflow risk detected',
        message: 'Projected cashflow turns negative in the coming weeks.',
        data: {
          horizonDays: projection.horizonDays,
          firstNegativeDate: firstNegative.date,
          projectedBalance: firstNegative.balance,
        },
      };
    } catch {
      // En cas d’erreur (pas assez de données, etc.) on ne bloque pas les autres insights.
      return null;
    }
  }
}

export const insightsService = new InsightsService();
