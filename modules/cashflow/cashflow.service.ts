// src/modules/cashflow/cashflow.service.ts
import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  normalizeUserId,
  normalizeBusinessId,
  type UserId,
  type BusinessId,
} from '@/modules/shared/ids';
import { assertBusinessOwnedByUser, assertUserExists } from '@/modules/shared/assertions';

export type CashflowHorizonDays = 30 | 60 | 90 | 180 | 365;

export interface CashflowProjectionPoint {
  /** Date du point (ISO) */
  date: string;
  /** Solde projeté cumulé à cette date */
  balance: number;
  /** Moyenne journalière d’entrées */
  inflow?: number;
  /** Moyenne journalière de sorties */
  outflow?: number;
  /** Net = inflow - outflow */
  net?: number;
}

export interface CashflowProjection {
  points: CashflowProjectionPoint[];
  horizonDays: number;
  currency: string;
}

export class InvalidCashflowInputError extends Error {
  constructor(message = 'Invalid cashflow projection input') {
    super(message);
    this.name = 'InvalidCashflowInputError';
  }
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_HISTORY_DAYS = 90;
const DEFAULT_HORIZON: CashflowHorizonDays = 90;
const MIN_HORIZON = 30;
const MAX_HORIZON = 365;

export class CashflowService {
  constructor(private readonly prismaClient: PrismaClient) {}

  /**
   * Projection de cashflow personnelle sur N jours.
   * - Ne regarde que les comptes perso (business_id IS NULL, include_in_budget = true, actifs).
   * - Utilise l’historique récent pour calculer des moyennes journalières.
   */
  async computePersonalCashflowProjection(
    userIdInput: UserId,
    options?: { horizonDays?: CashflowHorizonDays; startDate?: Date }
  ): Promise<CashflowProjection> {
    const userId = normalizeUserId(userIdInput);
    await assertUserExists(this.prismaClient, userId);

    const horizon = options?.horizonDays ?? DEFAULT_HORIZON;

    if (horizon < MIN_HORIZON || horizon > MAX_HORIZON) {
      throw new InvalidCashflowInputError('horizonDays must be between 30 and 365');
    }

    const startDate = options?.startDate ?? new Date();
    const historySince = new Date(startDate.getTime() - DEFAULT_HISTORY_DAYS * MS_PER_DAY);

    const transactions = await this.prismaClient.transactions.findMany({
      where: {
        user_id: userId,
        business_id: null,
        date: { gte: historySince, lte: startDate },
        accounts: {
          business_id: null,
          is_active: true,
          include_in_budget: true,
        },
      },
      select: {
        amount: true,
        direction: true,
      },
    });

    const { avgInflow, avgOutflow } = this.computeAverages(transactions, historySince, startDate);

    const userSettings = await this.prismaClient.user_settings.findUnique({
      where: { user_id: userId },
      select: { main_currency: true },
    });

    return this.buildProjection({
      horizon,
      avgInflow,
      avgOutflow,
      currency: userSettings?.main_currency ?? 'EUR',
      startDate,
    });
  }

  /**
   * Projection de cashflow business sur N jours.
   * (Même principe que perso mais scoping par business.)
   */
  async computeBusinessCashflowProjection(
    userIdInput: UserId,
    businessIdInput: BusinessId,
    options?: { horizonDays?: CashflowHorizonDays; startDate?: Date }
  ): Promise<CashflowProjection> {
    const userId = normalizeUserId(userIdInput);
    const businessId = normalizeBusinessId(businessIdInput);

    await assertBusinessOwnedByUser(this.prismaClient, businessId, userId);

    const horizon = options?.horizonDays ?? DEFAULT_HORIZON;

    if (horizon < MIN_HORIZON || horizon > MAX_HORIZON) {
      throw new InvalidCashflowInputError('horizonDays must be between 30 and 365');
    }

    const startDate = options?.startDate ?? new Date();
    const historySince = new Date(startDate.getTime() - DEFAULT_HISTORY_DAYS * MS_PER_DAY);

    const transactions = await this.prismaClient.transactions.findMany({
      where: {
        user_id: userId,
        business_id: businessId,
        date: { gte: historySince, lte: startDate },
        accounts: {
          business_id: businessId,
          is_active: true,
          include_in_budget: true,
        },
      },
      select: {
        amount: true,
        direction: true,
      },
    });

    const { avgInflow, avgOutflow } = this.computeAverages(transactions, historySince, startDate);

    const business = await this.prismaClient.businesses.findUnique({
      where: { id: businessId },
      select: { currency: true },
    });

    return this.buildProjection({
      horizon,
      avgInflow,
      avgOutflow,
      currency: business?.currency ?? 'EUR',
      startDate,
    });
  }

  /**
   * Calcule les moyennes journalières d’entrées/sorties à partir de l’historique.
   */
// src/modules/cashflow/cashflow.service.ts

private computeAverages(
  transactions: { amount: any; direction: string }[],
  historySince: Date,
  untilDate: Date
): { avgInflow: number; avgOutflow: number } {
  const totalDays = Math.max(
    1,
    Math.ceil((untilDate.getTime() - historySince.getTime()) / MS_PER_DAY)
  );

  const { inflow, outflow } = transactions.reduce(
    (acc, t) => {
      const amt = Number(t.amount);
      if (!Number.isFinite(amt)) return acc;

      if (t.direction === 'in') {
        acc.inflow += amt;
      } else if (t.direction === 'out') {
        acc.outflow += amt;
      }

      return acc;
    },
    { inflow: 0, outflow: 0 }
  );

  return {
    avgInflow: inflow / totalDays,
    avgOutflow: outflow / totalDays,
  };
}

  /**
   * Construit la projection de cashflow à partir des moyennes.
   */
  private buildProjection(params: {
    horizon: number;
    avgInflow: number;
    avgOutflow: number;
    currency: string;
    startDate: Date;
  }): CashflowProjection {
    const { horizon, avgInflow, avgOutflow, currency, startDate } = params;
    const points: CashflowProjectionPoint[] = [];
    let cumulative = 0;

    for (let i = 1; i <= horizon; i++) {
      const date = new Date(startDate.getTime() + i * MS_PER_DAY);
      const net = avgInflow - avgOutflow;
      cumulative += net;

      points.push({
        date: date.toISOString(),
        balance: cumulative,
        inflow: avgInflow,
        outflow: avgOutflow,
        net,
      });
    }

    return {
      points,
      horizonDays: horizon,
      currency,
    };
  }
}

export const cashflowService = new CashflowService(prisma);