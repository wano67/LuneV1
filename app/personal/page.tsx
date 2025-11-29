'use client';

import { Card } from "@/components/ui";
import {
  usePersonalOverview,
  usePersonalRecentTransactions,
  usePersonalAccounts,
} from "@/lib/hooks/usePersonalData";
import { safeCurrency } from "@/lib/utils/currency";
import { NetWorthChart } from "@/components/charts/NetWorthChart";
import { IncomeVsSpendingChart } from "@/components/charts/IncomeVsSpendingChart";
import { SpendingBreakdownChart } from "@/components/charts/SpendingBreakdownChart";

function formatCurrency(value: number, currency?: string): string {
  const cur = safeCurrency(currency);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: cur,
    minimumFractionDigits: 0,
  }).format(value);
}

function getRelativeDateString(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
}

function LoadingPlaceholder() {
  return <div className="h-24 bg-surfaceAlt rounded-[16px] animate-pulse border border-white/5" />;
}

export default function PersonalPage() {
  const overview = usePersonalOverview();
  const accounts = usePersonalAccounts();
  const recentTransactions = usePersonalRecentTransactions(5);
  const currency = overview.data?.baseCurrency ?? "EUR";
  const accountCount = accounts.data?.length ?? overview.data?.totalAccounts ?? 0;

  const isLoading = overview.loading;

  const sortedMonths = (overview.data?.last3Months ?? []).slice().sort((a, b) => a.month.localeCompare(b.month));
  const currentSpending = overview.data?.monthSpending ?? 0;
  const prevSpending = sortedMonths.length > 1 ? sortedMonths[sortedMonths.length - 2]?.spending ?? 0 : 0;
  const spendingDelta = prevSpending === 0 ? 0 : ((currentSpending - prevSpending) / prevSpending) * 100;

  const netWorthSeries = (() => {
    const months = sortedMonths.slice().reverse(); // latest first
    let current = overview.data?.totalBalance ?? 0;
    const points = [{ label: overview.data?.month ?? "Now", value: current }];
    months.forEach((m) => {
      current -= m.net;
      points.push({ label: m.month, value: current });
    });
    return points.reverse();
  })();

  const incomeSpendingSeries =
    sortedMonths.length > 0
      ? sortedMonths.map((m) => ({
          label: m.month,
          income: m.income,
          spending: m.spending,
        }))
      : [
          { label: "This month", income: overview.data?.monthIncome ?? 0, spending: overview.data?.monthSpending ?? 0 },
        ];

  const spendingBreakdownData =
    overview.data?.budgets && overview.data.budgets.length > 0
      ? overview.data.budgets.map((b) => ({ label: b.name || "Budget", value: b.spent }))
      : sortedMonths.map((m) => ({ label: m.month, value: m.spending }));

  const metrics = [
    {
      label: "Total Net Worth",
      value: formatCurrency(overview.data?.totalBalance ?? 0, currency),
      hint: `${accountCount} accounts`,
      accent: "from-[#6ee7ff]/40 via-[#7c9bff]/25 to-transparent",
    },
    {
      label: "Cash Available",
      value: formatCurrency(overview.data?.totalBalance ?? 0, currency),
      hint: "Liquidity across accounts",
      accent: "from-[#34d399]/35 via-transparent to-transparent",
    },
    {
      label: "Monthly Net",
      value: formatCurrency(overview.data?.monthNet ?? 0, currency),
      hint: `${formatCurrency(overview.data?.monthIncome ?? 0, currency)} in / ${formatCurrency(
        overview.data?.monthSpending ?? 0,
        currency
      )} out`,
      accent: "from-[#a855f7]/30 via-transparent to-transparent",
    },
    {
      label: "Spending vs Prev. Month",
      value: `${spendingDelta >= 0 ? "+" : ""}${spendingDelta.toFixed(1)}%`,
      hint: "Change in monthly spend",
      accent: "from-[#f97316]/30 via-transparent to-transparent",
    },
  ];

  const recentList = recentTransactions.data ?? [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-textMuted">Personal finance</p>
          <h1 className="mt-2 text-3xl font-semibold text-text">Overview</h1>
        </div>
        <div className="text-xs text-textMuted">Updated {overview.data?.generatedAt ? getRelativeDateString(overview.data.generatedAt) : "recently"}</div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="relative overflow-hidden bg-surface">
            <div className={`absolute inset-0 bg-gradient-to-br ${metric.accent}`} />
            <div className="relative space-y-2">
              <p className="text-xs uppercase tracking-wide text-textMuted">{metric.label}</p>
              <p className="text-2xl font-semibold text-text">{isLoading ? "…" : metric.value}</p>
              <p className="text-sm text-textMuted">{metric.hint}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="Net Worth Over Time" className="h-[320px]">
          {isLoading ? (
            <LoadingPlaceholder />
          ) : (
            <NetWorthChart data={netWorthSeries} currency={currency} />
          )}
        </Card>
        <Card title="Income vs Spending" className="h-[320px]">
          {isLoading ? (
            <LoadingPlaceholder />
          ) : (
            <IncomeVsSpendingChart data={incomeSpendingSeries} currency={currency} />
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="Spending Breakdown" className="h-[320px]">
          {isLoading ? (
            <LoadingPlaceholder />
          ) : spendingBreakdownData.length > 0 ? (
            <SpendingBreakdownChart data={spendingBreakdownData} currency={currency} />
          ) : (
            <p className="text-textMuted text-sm">No spending data yet.</p>
          )}
        </Card>

        <Card title="Recent Activity" className="h-[320px]">
          {recentTransactions.loading ? (
            <LoadingPlaceholder />
          ) : recentTransactions.error && recentTransactions.error.message.includes("(404)") ? (
            <p className="text-textMuted text-sm">No recent transactions</p>
          ) : recentTransactions.error ? (
            <p className="text-danger text-sm">{recentTransactions.error.message}</p>
          ) : (
            <div className="space-y-3">
              {recentList.slice(0, 5).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-surfaceAlt px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-text">{tx.label}</p>
                    <p className="text-xs text-textMuted">{getRelativeDateString(tx.occurredAt)}</p>
                  </div>
                  <div
                    className={`text-sm font-semibold ${
                      tx.direction === "in" ? "text-success" : tx.direction === "out" ? "text-danger" : "text-textMuted"
                    }`}
                  >
                    {tx.direction === "in" ? "+" : tx.direction === "out" ? "-" : ""}
                    {formatCurrency(Math.abs(tx.amount), tx.currency ?? currency)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
