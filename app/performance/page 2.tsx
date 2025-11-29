'use client';

import { PageHeader, Card } from "@/components/ui";
import { usePersonalOverview } from "@/lib/hooks/usePersonalData";
import { useBusinesses, useBusinessPerformance, useBusinessAccounts } from "@/lib/hooks/useBusinessData";
import { safeCurrency } from "@/lib/utils/currency";
import type { PersonalOverviewBudget } from "@/lib/api/types";

function formatCurrency(value: number, currency?: string): string {
  const cur = safeCurrency(currency);
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: cur,
    minimumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return (value * 100).toFixed(1) + '%';
}

function LoadingPlaceholder() {
  return <div className="h-20 bg-surfaceAlt rounded-md animate-pulse" />;
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <Card>
      <div className="text-danger text-sm">{message}</div>
    </Card>
  );
}

export default function PerformancePage() {
  const personal = usePersonalOverview();
  const businesses = useBusinesses();
  const businessId = businesses.data?.[0]?.business.id;
  const performance = useBusinessPerformance(businessId);
  const businessAccounts = useBusinessAccounts(businessId);
  const personalBudgets: PersonalOverviewBudget[] = personal.data?.budgets ?? [];
  const businessRevenue = performance.data?.topClients
    ? performance.data.topClients.topClients.reduce((sum, client) => sum + client.totalPaid, 0)
    : 0;
  const globalMonthlyNet = (personal.data?.monthNet ?? 0) + businessRevenue;
  const totalAccounts =
    (personal.data?.totalAccounts ?? 0) + (businessAccounts.data?.length ?? 0);

  return (
    <div>
      <PageHeader
        title="Performance Overview"
        description="Cross-universe insights and financial health"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Personal Month Summary */}
        {personal.error ? (
          <ErrorMessage message={personal.error.message} />
        ) : personal.loading ? (
          <LoadingPlaceholder />
        ) : (
          <Card title="Personal Monthly" description="This month">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-textMuted">Income</span>
                <span className="font-semibold text-success">
                  +{formatCurrency(personal.data?.monthIncome ?? 0, personal.data?.baseCurrency)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-textMuted">Spending</span>
                <span className="font-semibold text-text">
                  -{formatCurrency(personal.data?.monthSpending ?? 0, personal.data?.baseCurrency)}
                </span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between font-bold">
                <span className="text-sm">Net</span>
                <span className="text-success">
                  {formatCurrency(personal.data?.monthNet ?? 0, personal.data?.baseCurrency)}
                </span>
              </div>
            </div>
          </Card>
        )}

        {/* Business Performance */}
        {performance.loading ? (
          <LoadingPlaceholder />
        ) : performance.error ? (
          <ErrorMessage message={performance.error.message} />
        ) : (
          <Card title="Business Summary" description="Project performance">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-textMuted">Total Projects</span>
                <span className="font-semibold">{performance.data?.performance?.totalProjects ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-textMuted">Completed</span>
                <span className="font-semibold text-success">
                  {performance.data?.performance?.completedProjects ?? 0}
                </span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between font-bold">
                <span className="text-sm">On-Time Rate</span>
                <span className="text-success">
                  {formatPercent(performance.data?.performance?.onTimeRate ?? 0)}
                </span>
              </div>
            </div>
          </Card>
        )}

        {/* Wealth Overview */}
        {personal.loading || businesses.loading ? (
          <LoadingPlaceholder />
        ) : personal.error || businesses.error ? (
          <ErrorMessage message={personal.error?.message || businesses.error?.message || 'Error loading data'} />
        ) : (
          <Card title="Total Wealth" description="Personal + Business">
            <div>
              <p className="text-3xl font-bold text-primary mb-2">
                {formatCurrency(
                  personal.data?.totalBalance ?? 0,
                  personal.data?.baseCurrency
                )}
              </p>
              <div className="text-sm text-textMuted">Personal assets & accounts</div>
            </div>
          </Card>
        )}

        {/* Personal Accounts Overview */}
        {personal.loading ? (
          <LoadingPlaceholder />
        ) : personal.error ? (
          <ErrorMessage message={personal.error.message} />
        ) : (
          <Card title="Accounts" description={`${personal.data?.totalAccounts ?? 0} active`}>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-textMuted">Total Balance</span>
                <span className="font-semibold">
                  {formatCurrency(personal.data?.totalBalance ?? 0, personal.data?.baseCurrency)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-textMuted">Accounts</span>
                <span className="font-semibold">{personal.data?.totalAccounts ?? 0}</span>
              </div>
            </div>
          </Card>
        )}

        {/* Budget Status */}
        {personal.loading ? (
          <LoadingPlaceholder />
        ) : personal.error ? (
          <ErrorMessage message={personal.error.message} />
        ) : (
          <Card title="Budgets" description="Current month">
            <div className="space-y-2">
              {personalBudgets.length ? (
                personalBudgets.slice(0, 1).map((budget) => (
                  <div key={budget.id}>
                    <div className="flex justify-between mb-1 text-xs">
                      <span className="text-textMuted">{budget.name}</span>
                      <span className="text-textMuted">
                        {formatPercent(budget.consumptionRate)}
                      </span>
                    </div>
                    <div className="w-full bg-surfaceAlt rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          budget.consumptionRate > 0.9
                            ? 'bg-danger'
                            : budget.consumptionRate > 0.7
                            ? 'bg-warning'
                            : 'bg-success'
                        }`}
                        style={{ width: `${Math.min(budget.consumptionRate * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-textMuted">No budgets created</p>
              )}
            </div>
          </Card>
        )}

        {/* Top Business Client */}
        {performance.loading ? (
          <LoadingPlaceholder />
        ) : performance.error ? (
          <ErrorMessage message={performance.error.message} />
        ) : performance.data?.topClients && (performance.data.topClients.topClients.length ?? 0) > 0 ? (
          <Card title="Top Client" description="Highest revenue">
            <div>
              <p className="text-sm text-text mb-2 truncate">{performance.data.topClients.topClients[0]?.name}</p>
              <p className="text-2xl font-bold text-success">
                {formatCurrency(
                  performance.data.topClients.topClients[0]?.totalInvoiced ?? 0,
                  performance.data.topClients.currency
                )}
              </p>
              <div className="text-xs text-textMuted mt-2">
                {performance.data.topClients.topClients[0]?.projectCount ?? 0} projects
              </div>
            </div>
          </Card>
        ) : (
          <Card title="Top Client" description="Highest revenue">
            <p className="text-sm text-textMuted">No clients yet</p>
          </Card>
        )}

        {/* Combined Summary */}
        {personal.loading || businesses.loading || performance.loading || businessAccounts.loading ? (
          <LoadingPlaceholder />
        ) : businessAccounts.error ? (
          <ErrorMessage message={businessAccounts.error.message} />
        ) : (
          <Card title="Financial Health" description="Overall status">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-textMuted">Monthly Net</span>
                <span className="font-semibold text-success">
                  {formatCurrency((personal.data?.monthNet ?? 0), personal.data?.baseCurrency)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-textMuted">Total Accounts</span>
                <span className="font-semibold">{totalAccounts}</span>
              </div>
              <div className="border-t border-border pt-2 flex items-center justify-between">
                <span className="text-sm font-medium">Global Monthly Net</span>
                <span className={`text-sm font-bold ${globalMonthlyNet >= 0 ? 'text-success' : 'text-danger'}`}>
                  {formatCurrency(globalMonthlyNet, personal.data?.baseCurrency)}
                </span>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
