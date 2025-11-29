'use client';

import { useMemo, useState } from "react";
import { PageHeader, Card, Button, Dialog } from "@/components/ui";
import { usePersonalAccounts, usePersonalTransactions, personalActions } from "@/lib/hooks/usePersonalData";
import { safeCurrency } from "@/lib/utils/currency";

export default function TransactionsPage() {
  const { data: accounts } = usePersonalAccounts();
  const { data, loading, error, reload } = usePersonalTransactions();

  const [filterAccount, setFilterAccount] = useState<string>("all");
  const [filterDirection, setFilterDirection] = useState<"all" | "in" | "out" | "transfer">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState("");
  const [direction, setDirection] = useState<"in" | "out" | "transfer">("in");
  const [amount, setAmount] = useState<number>(0);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter((tx) => {
      const matchAccount = filterAccount === "all" || tx.accountId === filterAccount;
      const matchDir = filterDirection === "all" || tx.direction === filterDirection;
      return matchAccount && matchDir;
    });
  }, [data, filterAccount, filterDirection]);

  const handleSubmit = async () => {
    if (!accountId || !date || !label || !amount) {
      setFormError("All fields are required");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      const accountCurrency = accounts?.find((a) => a.id === accountId)?.currency ?? "EUR";
      await personalActions.createTransaction({
        accountId,
        direction,
        amount: Math.abs(amount),
        currency: accountCurrency,
        occurredAt: date,
        label,
        category,
        notes,
      });
      setDialogOpen(false);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create transaction");
    } finally {
      setSubmitting(false);
    }
  };

  const emptyState = error && error.message.includes("(404)");

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <PageHeader
          title="Personal transactions"
          description="Track and manage your personal transactions"
        />
        <Button onClick={() => setDialogOpen(true)}>Add transaction</Button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          className="rounded-md border border-border bg-surfaceAlt px-3 py-2 text-sm text-text"
          value={filterAccount}
          onChange={(e) => setFilterAccount(e.target.value)}
        >
          <option value="all">All accounts</option>
          {accounts?.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-border bg-surfaceAlt px-3 py-2 text-sm text-text"
          value={filterDirection}
          onChange={(e) => setFilterDirection(e.target.value as any)}
        >
          <option value="all">All directions</option>
          <option value="in">Income</option>
          <option value="out">Expense</option>
          <option value="transfer">Transfer</option>
        </select>
      </div>

      <Card>
        {loading ? (
          <p className="text-textMuted">Loading...</p>
        ) : emptyState ? (
          <p className="text-textMuted text-sm">No transactions yet. Add your first transaction.</p>
        ) : error ? (
          <p className="text-danger text-sm">{error.message}</p>
        ) : !filtered || filtered.length === 0 ? (
          <p className="text-textMuted text-sm">No transactions.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-textMuted">
                <tr>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Account</th>
                  <th className="py-2 pr-4">Label</th>
                  <th className="py-2 pr-4">Direction</th>
                  <th className="py-2 pr-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="text-text">
                {filtered.map((tx) => {
                  const accountName = accounts?.find((a) => a.id === tx.accountId)?.name ?? "Account";
                  const dirLabel = tx.direction === "in" ? "Income" : tx.direction === "out" ? "Expense" : "Transfer";
                  return (
                    <tr key={tx.id} className="border-t border-border">
                      <td className="py-2 pr-4">{new Date(tx.occurredAt).toLocaleDateString()}</td>
                      <td className="py-2 pr-4">{accountName}</td>
                      <td className="py-2 pr-4">{tx.label}</td>
                      <td className="py-2 pr-4">{dirLabel}</td>
                      <td className="py-2 pr-4 text-right">
                        <span className={tx.direction === "in" ? "text-success" : "text-danger"}>
                          {tx.direction === "in" ? "+" : "-"}
                          {tx.amount.toFixed(2)} {safeCurrency(tx.currency)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog
        open={dialogOpen}
        onClose={() => {
          if (submitting) return;
          setDialogOpen(false);
        }}
        title="New transaction"
        description="Add a personal transaction. Direction sets the sign; amount should be positive."
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm text-textMuted">Account</label>
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
            >
              <option value="">Select account</option>
              {accounts?.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-textMuted">Date</label>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm text-textMuted">Direction</label>
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={direction}
                onChange={(e) => setDirection(e.target.value as any)}
              >
                <option value="in">Income</option>
                <option value="out">Expense</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>
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
              <label className="text-sm text-textMuted">Category (optional)</label>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-textMuted">Label</label>
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-textMuted">Notes (optional)</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
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
