"use client";

import { useMemo } from "react";
import { PageHeader, Card } from "@/components/ui";
import {
  useActiveBusiness,
  useBusinessPipeline,
  useBusinessTopClients,
  useBusinessTopServices,
} from "@/lib/hooks/useBusinessData";
import { BusinessPipelineChart } from "@/components/charts/BusinessPipelineChart";
import { TopClientsRevenueChart } from "@/components/charts/TopClientsRevenueChart";
import { TopServicesRevenueChart } from "@/components/charts/TopServicesRevenueChart";

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function LoadingPlaceholder() {
  return (
    <div className="h-24 bg-surfaceAlt rounded-[16px] animate-pulse border border-white/5" />
  );
}

export default function PerformancePage() {
  const activeBusiness = useActiveBusiness();
  const businessId = activeBusiness.data?.business.id;

  const pipeline = useBusinessPipeline(businessId);
  const topClients = useBusinessTopClients(businessId);
  const topServices = useBusinessTopServices(businessId);

  const currency =
    pipeline.data?.businessId
      ? "EUR"
      : topClients.data?.currency || topServices.data?.currency || "EUR";

  const metrics = useMemo(() => {
    const d = pipeline.data;
    if (!d) return null;

    return [
      {
        label: "Quotes",
        value: d.quoteCount.toString(),
        hint: `${formatMoney(d.totalQuoted, currency)} quoted`,
      },
      {
        label: "Accepted",
        value: d.acceptedCount.toString(),
        hint: `${formatMoney(d.totalAccepted, currency)} accepted`,
      },
      {
        label: "Conversion rate",
        value: `${d.conversionRate.toFixed(1)}%`,
        hint: "Quotes → accepted",
      },
      {
        label: "Avg time to accept",
        value: `${d.avgTimeToAcceptDays.toFixed(1)}d`,
        hint: "From quote to acceptance",
      },
    ];
  }, [pipeline.data, currency]);

  if (!businessId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Performance"
          description="Track revenue and pipeline across your business."
        />
        <Card>
          <p className="text-sm text-textMuted">
            You don’t have any business configured yet. Create one in the Business
            section to see pipeline and revenue analytics.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Performance"
        description="Pipeline, revenue, and client performance for your business."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {pipeline.loading || !metrics ? (
          <>
            <LoadingPlaceholder />
            <LoadingPlaceholder />
            <LoadingPlaceholder />
            <LoadingPlaceholder />
          </>
        ) : pipeline.error ? (
          <Card>
            <p className="text-sm text-danger">{pipeline.error.message}</p>
          </Card>
        ) : (
          metrics.map((m) => (
            <Card key={m.label} className="relative overflow-hidden bg-surface">
              <div className="absolute inset-0 bg-gradient-to-br from-[#6ee7ff]/24 via-transparent to-transparent" />
              <div className="relative space-y-1">
                <p className="text-xs uppercase tracking-wide text-textMuted">
                  {m.label}
                </p>
                <p className="text-2xl font-semibold text-text">{m.value}</p>
                <p className="text-xs text-textMuted">{m.hint}</p>
              </div>
            </Card>
          ))
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="Sales pipeline" className="h-[320px]">
          {pipeline.loading ? (
            <LoadingPlaceholder />
          ) : pipeline.error ? (
            <p className="text-sm text-danger">{pipeline.error.message}</p>
          ) : pipeline.data ? (
            <BusinessPipelineChart
              quoteCount={pipeline.data.quoteCount}
              acceptedCount={pipeline.data.acceptedCount}
              conversionRate={pipeline.data.conversionRate}
            />
          ) : (
            <p className="text-sm text-textMuted">
              No pipeline data yet – create quotes and invoices to see activity.
            </p>
          )}
        </Card>

        <Card title="Top clients (invoiced)" className="h-[320px]">
          {topClients.loading ? (
            <LoadingPlaceholder />
          ) : topClients.error ? (
            <p className="text-sm text-danger">{topClients.error.message}</p>
          ) : topClients.data && topClients.data.topClients.length > 0 ? (
            <TopClientsRevenueChart
              currency={topClients.data.currency}
              data={topClients.data.topClients.slice(0, 7).map((c) => ({
                name: c.name,
                totalInvoiced: c.totalInvoiced,
              }))}
            />
          ) : (
            <p className="text-sm text-textMuted">
              No invoicing history yet for your clients.
            </p>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="Top services (invoiced)" className="h-[320px]">
          {topServices.loading ? (
            <LoadingPlaceholder />
          ) : topServices.error ? (
            <p className="text-sm text-danger">{topServices.error.message}</p>
          ) : topServices.data && topServices.data.topServices.length > 0 ? (
            <TopServicesRevenueChart
              currency={topServices.data.currency}
              data={topServices.data.topServices.slice(0, 7).map((s) => ({
                name: s.name,
                totalInvoiced: s.totalInvoiced,
              }))}
            />
          ) : (
            <p className="text-sm text-textMuted">
              No invoiced services yet. Issue invoices to see which offers perform
              best.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
