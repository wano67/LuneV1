'use client';

import { useState } from "react";
import { PageHeader, Card, Button, Dialog } from "@/components/ui";
import { usePersonalBudgets, personalActions } from "@/lib/hooks/usePersonalData";
import { safeCurrency } from "@/lib/utils/currency";

export default function BudgetsPage() {
  const { data, loading, error, reload } = usePersonalBudgets();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [currency, setCurrency] = useState("EUR");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!start || !end || !amount || !name.trim()) {
      setFormError("Name, dates, and amount are required.");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await personalActions.createBudget({
        name,
        currency,
        amount,
        periodStart: start,
        periodEnd: end,
      });
      setDialogOpen(false);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create budget");
    } finally {
      setSubmitting(false);
    }
  };

  const emptyState = error && error.message.includes("(404)");

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <PageHeader
          title="Personal budgets"
          description="Track your spending against monthly limits."
        />
        <Button onClick={() => setDialogOpen(true)}>Create budget</Button>
      </div>

      <Card>
        {loading ? (
          <p className="text-textMuted">Loading...</p>
        ) : emptyState ? (
          <p className="text-textMuted text-sm">No budgets yet. Create one to get started.</p>
        ) : error ? (
          <p className="text-danger text-sm">{error.message}</p>
        ) : !data || data.length === 0 ? (
          <p className="text-textMuted text-sm">No budgets yet.</p>
        ) : (
          <div className="space-y-3">
            {data.map((b) => (
              <div key={b.id} className="border border-border rounded-md p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text">{b.name ?? "Budget"}</p>
                    <p className="text-xs text-textMuted">
                      {new Date(b.periodStart).toLocaleDateString()} — {new Date(b.periodEnd).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-sm text-text">
                    {safeCurrency(b.currency ?? "EUR")} {b.amount.toFixed(2)}
                  </div>
                </div>
                <div className="mt-2 w-full bg-surfaceAlt rounded-full h-2">
                  <div className="h-2 rounded-full bg-success" style={{ width: "0%" }} />
                </div>
                <p className="text-xs text-textMuted mt-1">Spending tracking coming soon</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog
        open={dialogOpen}
        onClose={() => {
          if (submitting) return;
          setDialogOpen(false);
        }}
        title="New budget"
        description="Define a budget period and limit to track your spending."
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
              <label className="text-sm text-textMuted">Amount</label>
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-sm text-textMuted">Currency</label>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-textMuted">Start date</label>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-textMuted">End date</label>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          {formError && <p className="text-sm text-danger">{formError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => !submitting && setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
