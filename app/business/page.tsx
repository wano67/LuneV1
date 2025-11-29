'use client';

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHeader, Card, Button } from "@/components/ui";
import {
  useActiveBusiness,
  useBusinessPipeline,
  useBusinessTopClients,
  useBusinessTopServices,
  useBusinessProjects,
  useBusinessInvoices,
  useBusinessQuotes,
} from "@/lib/hooks/useBusinessData";
import { BusinessPipelineChart } from "@/components/charts/BusinessPipelineChart";
import { TopClientsRevenueChart } from "@/components/charts/TopClientsRevenueChart";
import { TopServicesRevenueChart } from "@/components/charts/TopServicesRevenueChart";

function formatMoney(value: number, currency = "EUR") {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function LoadingPlaceholder({ rows = 1 }: { rows?: number }) {
  return (
    <div className={`space-y-2`}>
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          className="h-12 rounded-xl bg-surfaceAlt animate-pulse border border-white/5"
        />
      ))}
    </div>
  );
}

type NextAction = {
  label: string;
  detail?: string;
  href: string;
};

export default function BusinessOverviewPage() {
  const activeBusiness = useActiveBusiness();
  const businessId = activeBusiness.data?.business.id;

  const pipeline = useBusinessPipeline(businessId);
  const topClients = useBusinessTopClients(businessId);
  const topServices = useBusinessTopServices(businessId);
  const projects = useBusinessProjects(businessId);
  const invoices = useBusinessInvoices(businessId);
  const quotes = useBusinessQuotes(businessId);

  const currency =
    topClients.data?.currency ||
    topServices.data?.currency ||
    "EUR";

  // KPI calculations
  const {
    pipelineValue,
    pipelineCount,
    acceptedCount,
    invoicedThisMonth,
    paidThisMonth,
    invoicesCountThisMonth,
    paymentsCount,
    activeProjectsCount,
    overdueProjectsCount,
  } = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const invs = invoices.data ?? [];
    const qs = quotes.data ?? [];
    const projs = projects.data ?? [];

    const pipelineFiltered = qs.filter(
      (row: any) =>
        row.quote.status !== "rejected" &&
        row.quote.status !== "cancelled"
    );
    const pipelineValue = pipelineFiltered.reduce(
      (sum: number, row: any) =>
        sum + (row.quote.totalTtc ?? row.quote.totalHt ?? 0),
      0
    );
    const pipelineCount = pipelineFiltered.length;
    const acceptedCount = pipelineFiltered.filter(
      (row: any) => row.quote.status === "accepted"
    ).length;

    const invoicedThisMonth = invs
      .filter((row: any) => {
        if (row.invoice.status === "cancelled") return false;
        const issued = row.invoice.issuedAt
          ? new Date(row.invoice.issuedAt)
          : null;
        return issued ? issued >= monthStart : false;
      })
      .reduce(
        (sum: number, row: any) =>
          sum + (row.invoice.totalAmount ?? row.invoice.totalTtc ?? 0),
        0
      );

    const invoicesCountThisMonth = invs.filter((row: any) => {
      if (row.invoice.status === "cancelled") return false;
      const issued = row.invoice.issuedAt
        ? new Date(row.invoice.issuedAt)
        : null;
      return issued ? issued >= monthStart : false;
    }).length;

    const paidThisMonth = invs
      .filter((row: any) => {
        const paidDate = row.invoice.paidAt
          ? new Date(row.invoice.paidAt)
          : row.invoice.updatedAt
          ? new Date(row.invoice.updatedAt)
          : null;
        return paidDate ? paidDate >= monthStart : false;
      })
      .reduce(
        (sum: number, row: any) =>
          sum + (row.invoice.amountPaid ?? 0),
        0
      );

    const paymentsCount = invs.filter((row: any) =>
      (row.invoice.amountPaid ?? 0) > 0
    ).length;

    const activeProjects = projs.filter(
      (p: any) =>
        p.status !== "completed" && p.status !== "cancelled"
    );
    const overdueProjects = activeProjects.filter((p: any) => {
      if (!p.dueDate) return false;
      const due = new Date(p.dueDate);
      return due < now;
    });

    return {
      pipelineValue,
      pipelineCount,
      acceptedCount,
      invoicedThisMonth,
      paidThisMonth,
      invoicesCountThisMonth,
      paymentsCount,
      activeProjectsCount: activeProjects.length,
      overdueProjectsCount: overdueProjects.length,
    };
  }, [invoices.data, quotes.data, projects.data]);

  const nextActions: NextAction[] = useMemo(() => {
    const actions: NextAction[] = [];
    const now = new Date();
    const qs = quotes.data ?? [];
    const invs = invoices.data ?? [];

    // Draft/sent quotes older than 7 days
    qs.forEach((row: any) => {
      const q = row.quote;
      const created = q.createdAt ? new Date(q.createdAt) : null;
      const ageDays =
        created != null
          ? Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
          : 0;
      if (
        (q.status === "draft" || q.status === "sent") &&
        ageDays > 7
      ) {
        actions.push({
          label: `Send quote ${q.quoteNumber || q.id}`,
          detail: `${ageDays} days old`,
          href: "/app/business/invoices",
        });
      }
      if (q.status === "accepted") {
        actions.push({
          label: `Invoice quote ${q.quoteNumber || q.id}`,
          detail: "Create final invoice",
          href: "/app/business/invoices",
        });
      }
    });

    // Overdue invoices
    invs.forEach((row: any) => {
      const inv = row.invoice;
      if (inv.status === "overdue" || (inv.dueAt && new Date(inv.dueAt) < now && inv.status !== "paid")) {
        actions.push({
          label: `Follow up invoice ${inv.number || inv.id}`,
          detail: inv.dueAt ? `Due ${formatDate(inv.dueAt)}` : "Overdue",
          href: "/app/business/invoices",
        });
      }
    });

    return actions.slice(0, 6);
  }, [quotes.data, invoices.data]);

  const renderStatusBadge = (status?: string) => {
    const base =
      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";
    switch (status) {
      case "completed":
        return `${base} bg-emerald-500/10 text-emerald-300`;
      case "in_progress":
      case "active":
        return `${base} bg-sky-500/10 text-sky-300`;
      case "on_hold":
      case "planned":
        return `${base} bg-white/5 text-textMuted`;
      case "cancelled":
        return `${base} bg-zinc-600/20 text-zinc-300`;
      case "at_risk":
        return `${base} bg-amber-500/10 text-amber-300`;
      default:
        return `${base} bg-white/5 text-textMuted`;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Business overview"
          description="Health, pipeline and projects at a glance."
        />
        <div className="flex gap-3">
          <Link href="/app/business/invoices">
            <Button>New quote</Button>
          </Link>
          <Link href="/app/business/projects">
            <Button variant="outline">New project</Button>
          </Link>
        </div>
      </div>

      {!businessId ? (
        <Card>
          <p className="text-textMuted text-sm">
            You don’t have any business configured yet. Create one to see your overview.
          </p>
        </Card>
      ) : (
        <>
          {/* HERO KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Card title="Pipeline" description="Draft + Sent + Accepted">
              {quotes.loading ? (
                <LoadingPlaceholder />
              ) : (
                <div className="space-y-2">
                  <p className="text-3xl font-semibold text-text">
                    {formatMoney(pipelineValue, currency)}
                  </p>
                  <p className="text-xs text-textMuted">
                    {pipelineCount} quotes • {acceptedCount} accepted
                  </p>
                  <Link
                    href="/app/business/invoices"
                    className="text-xs text-primary hover:underline"
                  >
                    View billing
                  </Link>
                </div>
              )}
            </Card>

            <Card title="Invoiced this month" description="Issued invoices">
              {invoices.loading ? (
                <LoadingPlaceholder />
              ) : (
                <div className="space-y-2">
                  <p className="text-3xl font-semibold text-text">
                    {formatMoney(invoicedThisMonth, currency)}
                  </p>
                  <p className="text-xs text-textMuted">
                    {invoicesCountThisMonth} invoices
                  </p>
                  <Link
                    href="/app/business/invoices"
                    className="text-xs text-primary hover:underline"
                  >
                    Go to billing
                  </Link>
                </div>
              )}
            </Card>

            <Card title="Paid this month" description="Recorded payments">
              {invoices.loading ? (
                <LoadingPlaceholder />
              ) : (
                <div className="space-y-2">
                  <p className="text-3xl font-semibold text-success">
                    {formatMoney(paidThisMonth, currency)}
                  </p>
                  <p className="text-xs text-textMuted">
                    {paymentsCount} payments
                  </p>
                  <Link
                    href="/app/business/invoices"
                    className="text-xs text-primary hover:underline"
                  >
                    View transactions
                  </Link>
                </div>
              )}
            </Card>

            <Card title="Active projects" description="In progress">
              {projects.loading ? (
                <LoadingPlaceholder />
              ) : (
                <div className="space-y-2">
                  <p className="text-3xl font-semibold text-text">
                    {activeProjectsCount}
                  </p>
                  <p className="text-xs text-textMuted">
                    {overdueProjectsCount > 0 ? (
                      <span className="text-danger font-medium">
                        {overdueProjectsCount} overdue
                      </span>
                    ) : (
                      "No overdue projects"
                    )}
                  </p>
                  <Link
                    href="/app/business/projects"
                    className="text-xs text-primary hover:underline"
                  >
                    View projects
                  </Link>
                </div>
              )}
            </Card>
          </div>

          {/* PIPELINE & REVENUE */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card title="Sales pipeline" description="Quoted vs accepted" className="h-[360px]">
              {pipeline.loading ? (
                <LoadingPlaceholder rows={3} />
              ) : pipeline.error ? (
                <p className="text-danger text-sm">{pipeline.error.message}</p>
              ) : pipeline.data ? (
                <div className="h-full flex flex-col gap-4">
                  <div className="flex-1">
                    <BusinessPipelineChart
                      quoteCount={pipeline.data.quoteCount}
                      acceptedCount={pipeline.data.acceptedCount}
                      conversionRate={pipeline.data.conversionRate}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-textMuted">
                    <div>Quotes draft/sent: {pipeline.data.quoteCount}</div>
                    <div>Quotes accepted: {pipeline.data.acceptedCount}</div>
                  </div>
                  <Link
                    href="/app/business/invoices"
                    className="text-xs text-primary hover:underline self-end"
                  >
                    Go to Billing
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-textMuted">
                  No pipeline data yet.
                </p>
              )}
            </Card>

            <Card title="Top clients / services" description="By invoiced amount" className="h-[360px]">
              <TopTabs
                topClients={topClients}
                topServices={topServices}
                currency={currency}
              />
              <div className="mt-3 text-right">
                <Link
                  href="/app/performance"
                  className="text-xs text-primary hover:underline"
                >
                  View more in Performance
                </Link>
              </div>
            </Card>
          </div>

          {/* PROJECTS & ACTIONS */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card title="Active projects" description="Current delivery">
              {projects.loading ? (
                <LoadingPlaceholder rows={4} />
              ) : projects.error ? (
                <p className="text-danger text-sm">{projects.error.message}</p>
              ) : !projects.data || projects.data.length === 0 ? (
                <p className="text-sm text-textMuted">No projects yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-textMuted">
                      <tr>
                        <th className="py-2 pr-4">Project</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Due</th>
                        <th className="py-2 pr-4">Invoicing</th>
                      </tr>
                    </thead>
                    <tbody className="text-text">
                      {projects.data
                        .filter((p: any) => p.status !== "completed" && p.status !== "cancelled")
                        .slice(0, 6)
                        .map((p: any) => (
                          <tr key={p.id} className="border-t border-border/60">
                            <td className="py-2 pr-4">
                              <div className="flex flex-col">
                                <span className="font-medium">{p.name}</span>
                                <span className="text-xs text-textMuted">
                                  {p.clientName || "—"}
                                </span>
                              </div>
                            </td>
                            <td className="py-2 pr-4">
                              <span className={renderStatusBadge(p.status)}>
                                {p.status?.replace("_", " ") || "—"}
                              </span>
                            </td>
                            <td className="py-2 pr-4 text-textMuted">
                              {formatDate(p.dueDate || p.endDate)}
                            </td>
                            <td className="py-2 pr-4 text-textMuted">
                              {p.invoiceStatus || "Not invoiced yet"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card title="Next actions" description="Stay on top of billing">
              {quotes.loading || invoices.loading ? (
                <LoadingPlaceholder rows={4} />
              ) : nextActions.length === 0 ? (
                <p className="text-sm text-textMuted">No pending actions right now.</p>
              ) : (
                <ul className="space-y-3">
                  {nextActions.map((action, idx) => (
                    <li
                      key={`${action.label}-${idx}`}
                      className="flex items-center justify-between rounded-lg border border-white/5 bg-surfaceAlt px-3 py-2"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm text-text">{action.label}</span>
                        {action.detail && (
                          <span className="text-xs text-textMuted">{action.detail}</span>
                        )}
                      </div>
                      <Link
                        href={action.href}
                        className="text-xs text-primary hover:underline whitespace-nowrap"
                      >
                        Open
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function TopTabs({
  topClients,
  topServices,
  currency,
}: {
  topClients: ReturnType<typeof useBusinessTopClients>;
  topServices: ReturnType<typeof useBusinessTopServices>;
  currency: string;
}) {
  const [tab, setTab] = useState<"clients" | "services">("clients");

  const clientsData = topClients.data?.topClients ?? [];
  const servicesData = topServices.data?.topServices ?? [];

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="inline-flex w-fit rounded-full bg-surfaceAlt p-1 text-xs">
        <button
          className={`px-3 py-1 rounded-full ${
            tab === "clients" ? "bg-surface text-text" : "text-textMuted"
          }`}
          onClick={() => setTab("clients")}
        >
          Top clients
        </button>
        <button
          className={`px-3 py-1 rounded-full ${
            tab === "services" ? "bg-surface text-text" : "text-textMuted"
          }`}
          onClick={() => setTab("services")}
        >
          Top services
        </button>
      </div>

      <div className="flex-1">
        {tab === "clients" ? (
          topClients.loading ? (
            <LoadingPlaceholder rows={3} />
          ) : topClients.error ? (
            <p className="text-danger text-sm">{topClients.error.message}</p>
          ) : clientsData.length > 0 ? (
            <TopClientsRevenueChart
              currency={currency}
              data={clientsData.slice(0, 7).map((c: any) => ({
                name: c.name,
                totalInvoiced: c.totalInvoiced,
              }))}
            />
          ) : (
            <p className="text-sm text-textMuted">No invoicing history yet.</p>
          )
        ) : topServices.loading ? (
          <LoadingPlaceholder rows={3} />
        ) : topServices.error ? (
          <p className="text-danger text-sm">{topServices.error.message}</p>
        ) : servicesData.length > 0 ? (
          <TopServicesRevenueChart
            currency={currency}
            data={servicesData.slice(0, 7).map((s: any) => ({
              name: s.name,
              totalInvoiced: s.totalInvoiced,
            }))}
          />
        ) : (
          <p className="text-sm text-textMuted">No invoiced services yet.</p>
        )}
      </div>
    </div>
  );
}
