"use client";

import { useMemo, useState } from "react";
import { PageHeader, Card, Button, Dialog } from "@/components/ui";
import {
  useActiveBusiness,
  useBusinessProjects,
  useBusinessClients,
  businessActions,
} from "@/lib/hooks/useBusinessData";

const STATUS_OPTIONS = [
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "on_hold", label: "On hold" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export default function BusinessProjectsPage() {
  const activeBusiness = useActiveBusiness();
  const businessId = activeBusiness.data?.business.id;
  const { data, loading, error, reload } = useBusinessProjects(businessId);
  const { data: clients } = useBusinessClients(businessId);

  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState<string>("in_progress");
  const [priority, setPriority] = useState<string>("medium");
  const [budgetAmount, setBudgetAmount] = useState<number | undefined>(undefined);
  const [currency, setCurrency] = useState("EUR");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<"all" | string>("all");
  const [filterClient, setFilterClient] = useState<string>("all");

  const handleSubmit = async () => {
    if (!businessId) return;
    if (!name.trim()) {
      setFormError("Project name is required.");
      return;
    }

    setFormError(null);
    try {
      setSubmitting(true);
      await businessActions.createProject(businessId, {
        name,
        description: description || undefined,
        currency,
        status,
        startDate: startDate || undefined,
        dueDate: dueDate || undefined,
        priority: priority || undefined,
        budgetAmount: budgetAmount ?? undefined,
        clientId: clientId || undefined,
        services: [],
      });
      setDialogOpen(false);
      reload();
    } catch (e: any) {
      setFormError(e?.message ?? "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  };

  const emptyState = error && error.message.includes("(404)");

  const filteredProjects = useMemo(() => {
    if (!data) return [];
    return data.filter((p: any) => {
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      if (filterClient !== "all" && p.clientId !== filterClient) return false;
      return true;
    });
  }, [data, filterStatus, filterClient]);

  const getStatusBadgeClasses = (status: string) => {
    const base =
      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";
    switch (status) {
      case "completed":
        return `${base} bg-emerald-500/10 text-emerald-300`;
      case "in_progress":
        return `${base} bg-sky-500/10 text-sky-300`;
      case "planned":
        return `${base} bg-white/5 text-textMuted`;
      case "on_hold":
        return `${base} bg-amber-500/10 text-amber-300`;
      default:
        return `${base} bg-white/5 text-textMuted`;
    }
  };

  const getPriorityBadgeClasses = (priority: string) => {
    const base =
      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium";
    switch (priority) {
      case "high":
        return `${base} bg-rose-500/10 text-rose-300`;
      case "medium":
        return `${base} bg-indigo-500/10 text-indigo-300`;
      case "low":
        return `${base} bg-white/5 text-textMuted`;
      default:
        return `${base} bg-white/5 text-textMuted`;
    }
  };

  const findClientName = (id?: string) =>
    clients?.find((c: any) => c.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Projects"
          description="Track your client projects, timelines, and budgets."
        />
        <Button onClick={() => setDialogOpen(true)} disabled={!businessId}>
          New project
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          className="rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
        >
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <select
          className="rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
        >
          <option value="all">All clients</option>
          {clients?.map((c: any) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <Card>
        {loading ? (
          <p className="text-textMuted text-sm">Loading…</p>
        ) : emptyState ? (
          <p className="text-textMuted text-sm">
            No projects yet. Create your first project to get started.
          </p>
        ) : error ? (
          <p className="text-danger text-sm">{error.message}</p>
        ) : !filteredProjects || filteredProjects.length === 0 ? (
          <p className="text-textMuted text-sm">No projects match your filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-textMuted">
                <tr>
                  <th className="py-2 pr-4">Project</th>
                  <th className="py-2 pr-4">Client</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Priority</th>
                  <th className="py-2 pr-4">Budget</th>
                  <th className="py-2 pr-4">Dates</th>
                  <th className="py-2 pr-4 text-right">Progress</th>
                </tr>
              </thead>
              <tbody className="text-text">
                {filteredProjects.map((p: any) => (
                  <tr key={p.id} className="border-t border-border/60">
                    <td className="py-2 pr-4">
                      <div className="flex flex-col">
                        <span className="font-medium">{p.name}</span>
                        {p.description && (
                          <span className="text-xs text-textMuted line-clamp-1">
                            {p.description}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-textMuted">
                      {findClientName(p.clientId)}
                    </td>
                    <td className="py-2 pr-4">
                      <span className={getStatusBadgeClasses(p.status)}>
                        {p.status?.replace("_", " ") || "—"}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      <span className={getPriorityBadgeClasses(p.priority)}>
                        {p.priority ? p.priority[0].toUpperCase() + p.priority.slice(1) : "—"}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-textMuted">
                      {p.budgetAmount
                        ? `${p.budgetAmount.toLocaleString("fr-FR", {
                            minimumFractionDigits: 0,
                          })} ${p.currency || currency}`
                        : "—"}
                    </td>
                    <td className="py-2 pr-4 text-textMuted">
                      {p.startDate
                        ? new Date(p.startDate).toLocaleDateString()
                        : "—"}{" "}
                      →{" "}
                      {p.dueDate ? new Date(p.dueDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs text-textMuted">
                          {p.progressManualPct ?? 0}%
                        </span>
                        <div className="h-1.5 w-24 rounded-full bg-surfaceAlt overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{
                              width: `${Math.min(p.progressManualPct ?? 0, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog
        open={dialogOpen}
        onClose={() => !submitting && setDialogOpen(false)}
        title="New project"
        description="Create a project to track delivery, budget, and invoices."
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm text-textMuted">Name</label>
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-textMuted">Client</label>
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {clients?.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-textMuted">Status</label>
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-textMuted">Priority</label>
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-textMuted">Budget (optional)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={budgetAmount ?? ""}
                  onChange={(e) =>
                    setBudgetAmount(e.target.value ? Number(e.target.value) : undefined)
                  }
                />
                <input
                  className="mt-1 w-24 rounded-lg border border-white/10 bg-[#0f0f11] px-2 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-textMuted">Start date</label>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-textMuted">Due date</label>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-textMuted">Description (optional)</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {formError && <p className="text-sm text-danger">{formError}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => !submitting && setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !businessId}>
              {submitting ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
