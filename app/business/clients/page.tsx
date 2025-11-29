"use client";

import { useState } from "react";
import { PageHeader, Card, Button, Dialog } from "@/components/ui";
import {
  useActiveBusiness,
  useBusinessClients,
  businessActions,
} from "@/lib/hooks/useBusinessData";

export default function ClientsPage() {
  const activeBusiness = useActiveBusiness();
  const businessId = activeBusiness.data?.business.id;
  const { data, loading, error, reload } = useBusinessClients(businessId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"individual" | "company">("company");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!businessId) return;
    if (!name.trim()) {
      setFormError("Name is required.");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await businessActions.createClient(businessId, {
        name,
        type,
        email: email || undefined,
        phone: phone || undefined,
        companyName: companyName || undefined,
        vatNumber: vatNumber || undefined,
        address: address || undefined,
        notes: notes || undefined,
      });
      setDialogOpen(false);
      reload();
    } catch (e: any) {
      setFormError(e?.message ?? "Failed to create client");
    } finally {
      setSubmitting(false);
    }
  };

  const emptyState = error && error.message.includes("(404)");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Clients"
          description="Manage your business clients and relationships."
        />
        <Button onClick={() => setDialogOpen(true)} disabled={!businessId}>
          Add client
        </Button>
      </div>

      <Card>
        {activeBusiness.loading || loading ? (
          <p className="text-textMuted text-sm">Loading…</p>
        ) : emptyState ? (
          <p className="text-textMuted text-sm">
            No clients yet. Add your first client to get started.
          </p>
        ) : error ? (
          <p className="text-danger text-sm">{error.message}</p>
        ) : !data || data.length === 0 ? (
          <p className="text-textMuted text-sm">No clients yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-textMuted">
                <tr>
                  <th className="py-2 pr-4">Client</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Company</th>
                  <th className="py-2 pr-4">Created</th>
                </tr>
              </thead>
              <tbody className="text-text">
                {data.map((c) => (
                  <tr key={c.id} className="border-t border-border/60">
                    <td className="py-2 pr-4">{c.name}</td>
                    <td className="py-2 pr-4">
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs uppercase tracking-wide">
                        {c.type === "individual" ? "Individual" : "Company"}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-textMuted">{c.email ?? "—"}</td>
                    <td className="py-2 pr-4 text-textMuted">{c.companyName ?? "—"}</td>
                    <td className="py-2 pr-4 text-textMuted">
                      {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"}
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
        title="New client"
        description="Create a client record to link projects and invoices."
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
                onChange={(e) => setType(e.target.value as "individual" | "company")}
              >
                <option value="individual">Individual</option>
                <option value="company">Company</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-textMuted">Email</label>
              <input
                type="email"
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-textMuted">Company name</label>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-textMuted">VAT number</label>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-textMuted">Phone</label>
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm text-textMuted">Address</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50"
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm text-textMuted">Notes (optional)</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
