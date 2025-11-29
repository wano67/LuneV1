'use client';

import { useState, useMemo } from "react";
import { toast } from "react-hot-toast";
import { PageHeader, Card, Button, Dialog } from "@/components/ui";
import { usePersonalAccounts } from "@/lib/hooks/usePersonalData";
import { personalActions } from "@/lib/hooks/usePersonalData";
import { safeCurrency } from "@/lib/utils/currency";

const ACCOUNT_TYPES = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

export default function AccountsPage() {
  const { data, loading, error, reload } = usePersonalAccounts();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState<'new' | 'edit'>("new");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("checking");
  const [currency, setCurrency] = useState("EUR");
  const [includeBudget, setIncludeBudget] = useState(true);
  const [includeNetWorth, setIncludeNetWorth] = useState(true);
  const [initialBalance, setInitialBalance] = useState<number | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setType("checking");
    setCurrency("EUR");
    setIncludeBudget(true);
    setIncludeNetWorth(true);
    setInitialBalance(undefined);
    setFormError(null);
    setEditingId(null);
    setEditMode("new");
  };

  const openNewDialog = () => {
    resetForm();
    setEditMode("new");
    setDialogOpen(true);
  };

  const openEditDialog = (acc: any) => {
    setName(acc.name);
    setType(acc.type ?? "checking");
    setCurrency(acc.currency ?? "EUR");
    setIncludeBudget(!!acc.includeInBudget);
    setIncludeNetWorth(!!acc.includeInNetWorth);
    setInitialBalance(acc.initialBalance ?? undefined);
    setEditingId(acc.id);
    setEditMode("edit");
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setFormError("Name is required");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      if (editMode === "new") {
        await personalActions.createAccount({
          name,
          type,
          currency,
          includeInBudget: includeBudget,
          includeInNetWorth: includeNetWorth,
          initialBalance: initialBalance ?? undefined,
        });
        toast.success("Account created");
      } else if (editMode === "edit" && editingId) {
        await personalActions.updateAccount(editingId, {
          name,
          type,
          currency,
          includeInBudget: includeBudget,
          includeInNetWorth: includeNetWorth,
        });
        toast.success("Account updated");
      }
  setDialogOpen(false);
  // Ensure UI refreshes after dialog closes
  setTimeout(() => reload(), 100);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save account");
      toast.error(formError ?? "Error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this account?")) return;
    setSubmitting(true);
    try {
      await personalActions.deleteAccount(id);
  toast.success("Account deleted");
  // Ensure UI refreshes after delete
  setTimeout(() => reload(), 100);
    } catch (err) {
      toast.error("Failed to delete account");
    } finally {
      setSubmitting(false);
    }
  };

  const emptyState = error && error.message.includes("(404)");

  const sortedAccounts = useMemo(() => data ?? [], [data]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <PageHeader
          title="Personal accounts"
          description="Manage your personal accounts"
        />
  <Button onClick={openNewDialog}>Add account</Button>
      </div>

      <Card>
        {loading ? (
          <p className="text-textMuted">Loading...</p>
        ) : emptyState ? (
          <p className="text-textMuted text-sm">No accounts yet. Add one to get started.</p>
        ) : error ? (
          <p className="text-danger text-sm">{error.message}</p>
        ) : !sortedAccounts || sortedAccounts.length === 0 ? (
          <p className="text-textMuted text-sm">No accounts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-textMuted">
                <tr>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Currency</th>
                  <th className="py-2 pr-4">In budget</th>
                  <th className="py-2 pr-4">In net worth</th>
                </tr>
              </thead>
              <tbody className="text-text">
                {sortedAccounts.map((acc) => (
                  <tr key={acc.id} className="border-t border-border group hover:bg-surfaceAlt/40">
                    <td className="py-2 pr-4 font-medium">{acc.name}</td>
                    <td className="py-2 pr-4">{acc.type ?? "—"}</td>
                    <td className="py-2 pr-4">{safeCurrency(acc.currency ?? "EUR")}</td>
                    <td className="py-2 pr-4">{acc.includeInBudget ? "Yes" : "No"}</td>
                    <td className="py-2 pr-4">{acc.includeInNetWorth ? "Yes" : "No"}</td>
                    <td className="py-2 pr-4">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(acc)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(acc.id)}>
                        Delete
                      </Button>
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
        onClose={() => {
          if (submitting) return;
          setDialogOpen(false);
          resetForm();
        }}
        title={editMode === "new" ? "New account" : "Edit account"}
        description={editMode === "new" ? "Create a personal account to start tracking balances." : "Edit your account details."}
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
              <label className="text-sm text-textMuted">Type</label>
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-textMuted">Currency</label>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={includeBudget}
                onChange={(e) => setIncludeBudget(e.target.checked)}
                className="h-4 w-4 rounded border-white/10 bg-[#0f0f11]"
              />
              Include in budget
            </label>
            <label className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={includeNetWorth}
                onChange={(e) => setIncludeNetWorth(e.target.checked)}
                className="h-4 w-4 rounded border-white/10 bg-[#0f0f11]"
              />
              Include in net worth
            </label>
          </div>
          <div>
            <label className="text-sm text-textMuted">Initial balance (optional)</label>
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={initialBalance ?? ""}
              onChange={(e) => setInitialBalance(e.target.value ? Number(e.target.value) : undefined)}
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
