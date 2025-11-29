"use client";

import { useMemo, useState } from "react";
import { PageHeader, Card, Button, Dialog } from "@/components/ui";
import {
  useActiveBusiness,
  useBusinessInvoices,
  useBusinessQuotes,
  useBusinessClients,
  useBusinessProjects,
  useBusinessServices,
  useBusinessAccounts,
  businessActions,
} from "@/lib/hooks/useBusinessData";

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

const INVOICE_STATUS_FILTERS = [
  "all",
  "draft",
  "sent",
  "paid",
  "overdue",
  "cancelled",
] as const;
type InvoiceStatusFilter = (typeof INVOICE_STATUS_FILTERS)[number];

const QUOTE_STATUS_FILTERS = [
  "all",
  "draft",
  "sent",
  "accepted",
  "rejected",
  "expired",
] as const;
type QuoteStatusFilter = (typeof QUOTE_STATUS_FILTERS)[number];

export default function BusinessBillingPage() {
  const activeBusiness = useActiveBusiness();
  const businessId = activeBusiness.data?.business.id;

  const invoices = useBusinessInvoices(businessId);
  const quotes = useBusinessQuotes(businessId);
  const { data: clients } = useBusinessClients(businessId);
  const { data: projects } = useBusinessProjects(businessId);
  const { data: services } = useBusinessServices(businessId);
  const accounts = useBusinessAccounts(businessId);

  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatusFilter>("all");
  const [invoiceClient, setInvoiceClient] = useState<string>("all");

  const [quoteStatus, setQuoteStatus] = useState<QuoteStatusFilter>("all");
  const [quoteClient, setQuoteClient] = useState<string>("all");

  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceClientId, setInvoiceClientId] = useState("");
  const [invoiceProjectId, setInvoiceProjectId] = useState("");
  const [invoiceCurrency, setInvoiceCurrency] = useState("EUR");
  const [issuedAt, setIssuedAt] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [invoiceNotes, setInvoiceNotes] = useState("");

  const [itemServiceId, setItemServiceId] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemUnitPrice, setItemUnitPrice] = useState<number>(0);
  const [itemVatRate, setItemVatRate] = useState<number>(20);

  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [quoteClientId, setQuoteClientId] = useState("");
  const [quoteProjectId, setQuoteProjectId] = useState("");
  const [quoteCurrency, setQuoteCurrency] = useState("EUR");
  const [quoteTitle, setQuoteTitle] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [quoteNotes, setQuoteNotes] = useState("");
  const [editingQuote, setEditingQuote] = useState<any | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<any | null>(null);
  const [showCancelledQuotes, setShowCancelledQuotes] = useState(false);
  const [showCancelledInvoices, setShowCancelledInvoices] = useState(false);

  const [submittingInvoice, setSubmittingInvoice] = useState(false);
  const [submittingQuote, setSubmittingQuote] = useState(false);
  const [invoiceFormError, setInvoiceFormError] = useState<string | null>(null);
  const [quoteFormError, setQuoteFormError] = useState<string | null>(null);
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [acceptingQuote, setAcceptingQuote] = useState<any | null>(null);
  const [depositPercent, setDepositPercent] = useState<number>(30);
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [depositAccountId, setDepositAccountId] = useState<string>("");
  const [depositDate, setDepositDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const openNewQuoteDialog = () => {
    setEditingQuote(null);
    setQuoteClientId("");
    setQuoteProjectId("");
    setQuoteCurrency("EUR");
    setQuoteTitle("");
    setValidUntil("");
    setQuoteNotes("");
    setItemServiceId("");
    setItemDescription("");
    setItemQuantity(1);
    setItemUnitPrice(0);
    setItemVatRate(20);
    setQuoteFormError(null);
    setQuoteDialogOpen(true);
  };

  const openNewInvoiceDialog = () => {
    setEditingInvoice(null);
    setInvoiceClientId("");
    setInvoiceProjectId("");
    setInvoiceCurrency("EUR");
    setIssuedAt("");
    setDueAt("");
    setInvoiceNotes("");
    setItemServiceId("");
    setItemDescription("");
    setItemQuantity(1);
    setItemUnitPrice(0);
    setItemVatRate(20);
    setInvoiceFormError(null);
    setInvoiceDialogOpen(true);
  };
  const findClientName = (id?: string) =>
    clients?.find((c: any) => c.id === id)?.name ?? "—";

  const getStatusChip = (status: string) => {
    const base =
      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";
    switch (status) {
      case "paid":
        return `${base} bg-emerald-500/10 text-emerald-300`;
      case "overdue":
        return `${base} bg-rose-500/10 text-rose-300`;
      case "sent":
        return `${base} bg-sky-500/10 text-sky-300`;
      case "draft":
        return `${base} bg-white/5 text-textMuted`;
      case "accepted":
        return `${base} bg-emerald-500/10 text-emerald-300`;
      case "rejected":
        return `${base} bg-rose-500/10 text-rose-300`;
      case "expired":
        return `${base} bg-amber-500/10 text-amber-300`;
      case "cancelled":
        return `${base} bg-zinc-600/20 text-zinc-300`;
      default:
        return `${base} bg-white/5 text-textMuted`;
    }
  };

  const filteredInvoices = useMemo(() => {
    if (!invoices.data) return [];
    const base = invoices.data.filter((row: any) => {
      const inv = row.invoice;
      if (invoiceStatus !== "all" && inv.status !== invoiceStatus) return false;
      if (invoiceClient !== "all" && inv.clientId !== invoiceClient) return false;
      return true;
    });
    if (showCancelledInvoices) return base;
    return base.filter((row: any) => row.invoice.status !== "cancelled");
  }, [invoices.data, invoiceStatus, invoiceClient, showCancelledInvoices]);

  const filteredQuotes = useMemo(() => {
    if (!quotes.data) return [];
    const base = quotes.data.filter((row: any) => {
      const q = row.quote;
      if (quoteStatus !== "all" && q.status !== quoteStatus) return false;
      if (quoteClient !== "all" && q.clientId !== quoteClient) return false;
      return true;
    });
    if (showCancelledQuotes) return base;
    return base.filter(
      (row: any) => row.quote.status !== "rejected" && row.quote.status !== "cancelled"
    );
  }, [quotes.data, quoteStatus, quoteClient, showCancelledQuotes]);

  const baseCurrency =
    (invoices.data && invoices.data[0]?.invoice?.currency) || invoiceCurrency || "EUR";

  const handleCreateInvoice = async () => {
    if (!businessId) return;

    if (!invoiceClientId) {
      setInvoiceFormError("Client is required.");
      return;
    }
    if (!issuedAt) {
      setInvoiceFormError("Issue date is required.");
      return;
    }
    if (!itemDescription.trim() || !itemQuantity || !itemUnitPrice) {
      setInvoiceFormError("Item description, quantity, and unit price are required.");
      return;
    }

    setInvoiceFormError(null);
    try {
      setSubmittingInvoice(true);
      const payload = {
        clientId: invoiceClientId,
        projectId: invoiceProjectId || undefined,
        currency: invoiceCurrency,
        issuedAt,
        dueAt: dueAt || undefined,
        notes: invoiceNotes || undefined,
        items: [
          {
            serviceId: itemServiceId || undefined,
            description: itemDescription,
            quantity: itemQuantity,
            unitPrice: itemUnitPrice,
            vatRate: itemVatRate,
          },
        ],
      };
      if (editingInvoice) {
        await businessActions.updateInvoice(editingInvoice.id, payload as any);
      } else {
        await businessActions.createInvoice(businessId, payload);
      }

      setInvoiceDialogOpen(false);
      setEditingInvoice(null);
      invoices.reload();
      quotes.reload();
    } catch (e: any) {
      setInvoiceFormError(e?.message ?? "Failed to create invoice");
    } finally {
      setSubmittingInvoice(false);
    }
  };

  const handleCreateQuote = async () => {
    if (!businessId) return;

    if (!quoteClientId) {
      setQuoteFormError("Client is required.");
      return;
    }
    if (!validUntil) {
      setQuoteFormError("Valid until date is required.");
      return;
    }
    if (!itemDescription.trim() || !itemQuantity || !itemUnitPrice) {
      setQuoteFormError("Item description, quantity, and unit price are required.");
      return;
    }

    setQuoteFormError(null);
    try {
      setSubmittingQuote(true);
      const payload = {
        clientId: quoteClientId,
        projectId: quoteProjectId || undefined,
        title: quoteTitle || undefined,
        currency: quoteCurrency,
        validUntil,
        notes: quoteNotes || undefined,
        items: [
          {
            serviceId: itemServiceId || undefined,
            description: itemDescription,
            quantity: itemQuantity,
            unitPrice: itemUnitPrice,
            vatRate: itemVatRate,
          },
        ],
      };
      if (editingQuote) {
        await businessActions.updateQuote(editingQuote.id, payload as any);
      } else {
        await businessActions.createQuote(businessId, payload);
      }

      setQuoteDialogOpen(false);
      setEditingQuote(null);
      quotes.reload();
      invoices.reload();
    } catch (e: any) {
      setQuoteFormError(e?.message ?? "Failed to create quote");
    } finally {
      setSubmittingQuote(false);
    }
  };

  const openAcceptDialog = (quote: any) => {
    const total = quote.totalTtc ?? quote.totalHt ?? 0;
    const defaultPercent = 30;
    setAcceptingQuote(quote);
    setDepositPercent(defaultPercent);
    setDepositAmount(Math.round(total * (defaultPercent / 100)));
    setDepositAccountId(accounts.data?.[0]?.id ?? "");
    setDepositDate(new Date().toISOString().slice(0, 10));
    setAcceptDialogOpen(true);
  };

  const handleConfirmAccept = async () => {
    if (!businessId || !acceptingQuote) return;
    try {
      await businessActions.acceptQuote(acceptingQuote.id);
      if (depositAmount > 0 && depositAccountId) {
        await businessActions.recordBusinessTransaction(businessId, {
          accountId: depositAccountId,
          direction: "in",
          amount: depositAmount,
          currency: acceptingQuote.currency || "EUR",
          occurredAt: depositDate || new Date().toISOString(),
          label: `Deposit ${depositPercent}% - quote ${
            acceptingQuote.quoteNumber || acceptingQuote.id
          }`,
          category: "deposit",
          notes: "Automatic deposit on quote acceptance",
        });
      }
      setAcceptDialogOpen(false);
      setAcceptingQuote(null);
      quotes.reload();
      invoices.reload();
    } catch (e) {
      console.error("Failed to accept quote", e);
    }
  };

  const handleInvoiceFromQuote = async (quoteId: string) => {
    if (!window.confirm("Create invoice from this quote?")) return;
    try {
      await businessActions.createInvoiceFromQuote(quoteId);
      quotes.reload();
      invoices.reload();
    } catch (e) {
      console.error("Failed to create invoice from quote", e);
    }
  };

  const handleCancelQuote = async (quote: any) => {
    if (!window.confirm("Cancel this quote?")) return;
    try {
      await businessActions.deleteQuote(quote.id);
      quotes.reload();
      invoices.reload();
      setQuoteDialogOpen(false);
      setEditingQuote(null);
    } catch (finalErr: any) {
      setQuoteFormError(finalErr?.message ?? "Failed to cancel quote");
      console.error("Failed to cancel quote", finalErr);
    }
  };

  const handleCancelInvoice = async (invoiceId: string) => {
    if (!window.confirm("Cancel this invoice?")) return;
    try {
      await businessActions.updateInvoice(invoiceId, { status: "cancelled" });
      invoices.reload();
      setInvoiceDialogOpen(false);
      setEditingInvoice(null);
    } catch (e) {
      console.error("Failed to cancel invoice", e);
    }
  };

  const handleEditQuote = (quote: any) => {
    setQuoteFormError(null);
    setItemServiceId(quote.items?.[0]?.serviceId ?? "");
    setItemDescription(quote.items?.[0]?.description ?? "");
    setItemQuantity(quote.items?.[0]?.quantity ?? 1);
    setItemUnitPrice(quote.items?.[0]?.unitPrice ?? 0);
    setItemVatRate(quote.items?.[0]?.vatRate ?? 20);
    setQuoteClientId(quote.clientId);
    setQuoteProjectId(quote.projectId ?? "");
    setQuoteCurrency(quote.currency || "EUR");
    setQuoteTitle(quote.title || "");
    setValidUntil(quote.validUntil?.slice(0, 10) || "");
    setQuoteNotes(quote.notes || "");
    setEditingQuote(quote);
    setQuoteDialogOpen(true);
  };

  const handleEditInvoice = (invRow: any) => {
    const inv = invRow.invoice;
    setInvoiceFormError(null);
    setItemServiceId(inv.items?.[0]?.serviceId ?? "");
    setItemDescription(inv.items?.[0]?.description ?? "");
    setItemQuantity(inv.items?.[0]?.quantity ?? 1);
    setItemUnitPrice(inv.items?.[0]?.unitPrice ?? 0);
    setItemVatRate(inv.items?.[0]?.vatRate ?? 20);
    setInvoiceClientId(inv.clientId);
    setInvoiceProjectId(inv.projectId ?? "");
    setInvoiceCurrency(inv.currency || "EUR");
    setIssuedAt(inv.issuedAt?.slice(0, 10) || "");
    setDueAt(inv.dueAt?.slice(0, 10) || "");
    setInvoiceNotes(inv.notes || "");
    setEditingInvoice(inv);
    setInvoiceDialogOpen(true);
  };

  const emptyInvoices = invoices.error && invoices.error.message.includes("(404)");
  const emptyQuotes = quotes.error && quotes.error.message.includes("(404)");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Billing"
          description="Quotes and invoices for your business."
        />
      </div>

      {/* QUOTES SECTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-textMuted uppercase tracking-wide">
              Quotes
            </h2>
            <p className="text-xs text-textMuted">
              Draft, sent, accepted and rejected quotes.
            </p>
          </div>
          <Button onClick={openNewQuoteDialog} disabled={!businessId}>
            New quote
          </Button>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            className="rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-xs text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
            value={quoteStatus}
            onChange={(e) => setQuoteStatus(e.target.value as QuoteStatusFilter)}
          >
            {QUOTE_STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All statuses" : s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>

          <select
            className="rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-xs text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
            value={quoteClient}
            onChange={(e) => setQuoteClient(e.target.value)}
          >
            <option value="all">All clients</option>
            {clients?.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs text-textMuted">
            <input
              type="checkbox"
              className="accent-primary"
              checked={showCancelledQuotes}
              onChange={(e) => setShowCancelledQuotes(e.target.checked)}
            />
            Show cancelled / rejected
          </label>
        </div>

        <Card>
        {quotes.loading || activeBusiness.loading ? (
            <p className="text-textMuted text-sm">Loading…</p>
          ) : emptyQuotes ? (
            <p className="text-textMuted text-sm">
              No quotes yet. Create your first quote to get started.
            </p>
          ) : quotes.error ? (
            <p className="text-danger text-sm">{quotes.error.message}</p>
          ) : !filteredQuotes || filteredQuotes.length === 0 ? (
            <p className="text-textMuted text-sm">No quotes match your filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-textMuted">
                  <tr>
                    <th className="py-2 pr-4">Number</th>
                    <th className="py-2 pr-4">Client</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Created</th>
                    <th className="py-2 pr-4">Valid until</th>
                    <th className="py-2 pr-4 text-right">Total</th>
                    <th className="py-2 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-text">
                  {filteredQuotes.map((row: any) => {
                    const q = row.quote;
                    const total = q.totalTtc ?? q.totalHt ?? 0;

                    return (
                      <tr key={q.id} className="border-t border-border/60">
                        <td className="py-2 pr-4">
                          <div className="flex flex-col">
                            <span className="font-medium">{q.quoteNumber || "—"}</span>
                            {q.title && (
                              <span className="text-xs text-textMuted line-clamp-1">
                                {q.title}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 pr-4 text-textMuted">
                          {findClientName(q.clientId)}
                        </td>
                        <td className="py-2 pr-4">
                          <span className={getStatusChip(q.status)}>
                            {q.status ? q.status[0].toUpperCase() + q.status.slice(1) : "—"}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-textMuted">
                          {q.createdAt ? new Date(q.createdAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-2 pr-4 text-textMuted">
                          {q.validUntil ? new Date(q.validUntil).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-2 pr-4 text-right">
                          {formatMoney(total, q.currency || baseCurrency)}
                        </td>
                        <td className="py-2 pr-4 text-right">
                          <div className="flex justify-end gap-2">
                            {(q.status === "draft" || q.status === "sent") && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openAcceptDialog(q)}
                              >
                                Accept
                              </Button>
                            )}
                            {q.status === "accepted" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleInvoiceFromQuote(q.id)}
                              >
                                To invoice
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditQuote(q)}
                            >
                              Edit
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* INVOICES SECTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-textMuted uppercase tracking-wide">
              Invoices
            </h2>
            <p className="text-xs text-textMuted">
              Issued invoices, their status and payment progress.
            </p>
          </div>
          <Button onClick={openNewInvoiceDialog} disabled={!businessId}>
            New invoice
          </Button>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            className="rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-xs text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
            value={invoiceStatus}
            onChange={(e) => setInvoiceStatus(e.target.value as InvoiceStatusFilter)}
          >
            {INVOICE_STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All statuses" : s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>

          <select
            className="rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-xs text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
            value={invoiceClient}
            onChange={(e) => setInvoiceClient(e.target.value)}
          >
            <option value="all">All clients</option>
            {clients?.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs text-textMuted">
            <input
              type="checkbox"
              className="accent-primary"
              checked={showCancelledInvoices}
              onChange={(e) => setShowCancelledInvoices(e.target.checked)}
            />
            Show cancelled
          </label>
        </div>

        <Card>
          {invoices.loading || activeBusiness.loading ? (
            <p className="text-textMuted text-sm">Loading…</p>
          ) : emptyInvoices ? (
            <p className="text-textMuted text-sm">
              No invoices yet. Create your first invoice to get started.
            </p>
          ) : invoices.error ? (
            <p className="text-danger text-sm">{invoices.error.message}</p>
          ) : !filteredInvoices || filteredInvoices.length === 0 ? (
            <p className="text-textMuted text-sm">No invoices match your filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-textMuted">
                <tr>
                  <th className="py-2 pr-4">Number</th>
                  <th className="py-2 pr-4">Client</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Issue date</th>
                  <th className="py-2 pr-4">Due date</th>
                  <th className="py-2 pr-4 text-right">Total</th>
                  <th className="py-2 pr-4 text-right">Paid</th>
                  <th className="py-2 pr-4 text-right">Due</th>
                  <th className="py-2 pr-4 text-right">Actions</th>
                </tr>
              </thead>
                <tbody className="text-text">
                  {filteredInvoices.map((row: any) => {
                    const inv = row.invoice;
                    const total = inv.totalAmount ?? inv.totalTtc ?? 0;
                    const paid = inv.amountPaid ?? 0;
                    const due = inv.amountDue ?? total - paid;

                    return (
                      <tr key={inv.id} className="border-t border-border/60">
                        <td className="py-2 pr-4">
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {inv.number || inv.quoteNumber || "—"}
                            </span>
                            {inv.title && (
                              <span className="text-xs text-textMuted line-clamp-1">
                                {inv.title}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 pr-4 text-textMuted">
                          {findClientName(inv.clientId)}
                        </td>
                        <td className="py-2 pr-4">
                          <span className={getStatusChip(inv.status)}>
                            {inv.status ? inv.status[0].toUpperCase() + inv.status.slice(1) : "—"}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-textMuted">
                          {inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-2 pr-4 text-textMuted">
                          {inv.dueAt ? new Date(inv.dueAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-2 pr-4 text-right">
                          {formatMoney(total, inv.currency || baseCurrency)}
                        </td>
                        <td className="py-2 pr-4 text-right text-success">
                          {formatMoney(paid, inv.currency || baseCurrency)}
                        </td>
                        <td
                          className={`py-2 pr-4 text-right ${
                            due > 0 && inv.status === "overdue" ? "text-danger" : "text-textMuted"
                          }`}
                        >
                          {formatMoney(due, inv.currency || baseCurrency)}
                        </td>
                        <td className="py-2 pr-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditInvoice(row)}
                            >
                              Edit
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* DIALOG: NEW QUOTE */}
      <Dialog
        open={quoteDialogOpen}
        onClose={() => {
          if (submittingQuote) return;
          setQuoteDialogOpen(false);
          setEditingQuote(null);
          setQuoteFormError(null);
        }}
        title={editingQuote ? "Edit quote" : "New quote"}
        description={
          editingQuote
            ? "Update this quote. Multi-line items will come later."
            : "Create a quote for a client. Multi-line items will come later."
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-textMuted">Client</label>
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={quoteClientId}
                onChange={(e) => setQuoteClientId(e.target.value)}
                required
              >
                <option value="">Select a client</option>
                {clients?.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-textMuted">Project (optional)</label>
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={quoteProjectId}
                onChange={(e) => setQuoteProjectId(e.target.value)}
              >
                <option value="">None</option>
                {projects?.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="text-sm text-textMuted">Title (optional)</label>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={quoteTitle}
                onChange={(e) => setQuoteTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-textMuted">Valid until</label>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-sm text-textMuted">Currency</label>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={quoteCurrency}
                onChange={(e) => setQuoteCurrency(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-white/10 bg-[#101015] p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs uppercase tracking-wide text-textMuted">Line item</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-textMuted">Service (optional)</label>
                <select
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={itemServiceId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setItemServiceId(id);
                    const selected = services?.find((s: any) => s.id === id);
                    if (selected && !itemDescription) {
                      setItemDescription(selected.name);
                    }
                    if (selected && !itemUnitPrice) {
                      setItemUnitPrice(selected.unitPrice ?? 0);
                    }
                  }}
                >
                  <option value="">Custom</option>
                  {services?.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-textMuted">Description</label>
                <input
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm text-textMuted">Quantity</label>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={itemQuantity}
                  onChange={(e) => setItemQuantity(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-sm text-textMuted">Unit price</label>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={itemUnitPrice}
                  onChange={(e) => setItemUnitPrice(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-sm text-textMuted">VAT %</label>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={itemVatRate}
                  onChange={(e) => setItemVatRate(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm text-textMuted">Notes (optional)</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50"
              rows={3}
              value={quoteNotes}
              onChange={(e) => setQuoteNotes(e.target.value)}
            />
          </div>

          {quoteFormError && <p className="text-sm text-danger">{quoteFormError}</p>}

          {editingQuote && (
            <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-300">
                Danger zone
              </p>
              <p className="text-xs text-textMuted">
                Cancel this quote. It will be removed from your active billing view.
              </p>
              <Button
                variant="ghost"
                className="w-full text-red-400 hover:bg-red-500/10"
                onClick={() => handleCancelQuote(editingQuote)}
              >
                Cancel quote
              </Button>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => {
                if (submittingQuote) return;
                setQuoteDialogOpen(false);
                setEditingQuote(null);
                setQuoteFormError(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateQuote} disabled={submittingQuote || !businessId}>
              {submittingQuote ? "Saving…" : editingQuote ? "Update quote" : "Save quote"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* DIALOG: NEW INVOICE */}
      <Dialog
        open={invoiceDialogOpen}
        onClose={() => {
          if (submittingInvoice) return;
          setInvoiceDialogOpen(false);
          setEditingInvoice(null);
          setInvoiceFormError(null);
        }}
        title={editingInvoice ? "Edit invoice" : "New invoice"}
        description={
          editingInvoice
            ? "Update this invoice. Multi-line items will come later."
            : "Create an invoice from a client and one line item. Multi-line will come later."
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-textMuted">Client</label>
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={invoiceClientId}
                onChange={(e) => setInvoiceClientId(e.target.value)}
                required
              >
                <option value="">Select a client</option>
                {clients?.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-textMuted">Project (optional)</label>
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={invoiceProjectId}
                onChange={(e) => setInvoiceProjectId(e.target.value)}
              >
                <option value="">None</option>
                {projects?.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-sm text-textMuted">Issue date</label>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={issuedAt}
                onChange={(e) => setIssuedAt(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm text-textMuted">Due date</label>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-textMuted">Currency</label>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={invoiceCurrency}
                onChange={(e) => setInvoiceCurrency(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-white/10 bg-[#101015] p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs uppercase tracking-wide text-textMuted">Line item</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-textMuted">Service (optional)</label>
                <select
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={itemServiceId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setItemServiceId(id);
                    const selected = services?.find((s: any) => s.id === id);
                    if (selected && !itemDescription) {
                      setItemDescription(selected.name);
                    }
                    if (selected && !itemUnitPrice) {
                      setItemUnitPrice(selected.unitPrice ?? 0);
                    }
                  }}
                >
                  <option value="">Custom</option>
                  {services?.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-textMuted">Description</label>
                <input
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm text-textMuted">Quantity</label>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={itemQuantity}
                  onChange={(e) => setItemQuantity(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-sm text-textMuted">Unit price</label>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={itemUnitPrice}
                  onChange={(e) => setItemUnitPrice(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-sm text-textMuted">VAT %</label>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={itemVatRate}
                  onChange={(e) => setItemVatRate(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm text-textMuted">Notes (optional)</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50"
              rows={3}
              value={invoiceNotes}
              onChange={(e) => setInvoiceNotes(e.target.value)}
            />
          </div>

          {invoiceFormError && <p className="text-sm text-danger">{invoiceFormError}</p>}

          {editingInvoice && (
            <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-300">
                Danger zone
              </p>
              <p className="text-xs text-textMuted">
                Cancel this invoice. It will be removed from your active billing view.
              </p>
              <Button
                variant="ghost"
                className="w-full text-red-400 hover:bg-red-500/10"
                onClick={() => handleCancelInvoice(editingInvoice.id)}
              >
                Cancel invoice
              </Button>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => {
                if (submittingInvoice) return;
                setInvoiceDialogOpen(false);
                setEditingInvoice(null);
                setInvoiceFormError(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateInvoice} disabled={submittingInvoice || !businessId}>
              {submittingInvoice ? "Saving…" : editingInvoice ? "Update invoice" : "Save invoice"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Accept quote dialog */}
      <Dialog
        open={acceptDialogOpen}
        onClose={() => {
          setAcceptDialogOpen(false);
          setAcceptingQuote(null);
        }}
        title="Accept quote & record deposit"
        description={
          acceptingQuote ? `Quote ${acceptingQuote.quoteNumber || acceptingQuote.id}` : ""
        }
      >
        {acceptingQuote && (
          <div className="space-y-4">
            <p className="text-sm text-textMuted">
              Total amount:{" "}
              <span className="font-semibold text-text">
                {formatMoney(
                  acceptingQuote.totalTtc ?? acceptingQuote.totalHt ?? 0,
                  acceptingQuote.currency || baseCurrency
                )}
              </span>
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-textMuted">Deposit (%)</label>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={depositPercent}
                  onChange={(e) => {
                    const next = Number(e.target.value) || 0;
                    setDepositPercent(next);
                    const total = acceptingQuote.totalTtc ?? acceptingQuote.totalHt ?? 0;
                    setDepositAmount(Math.round(total * (next / 100)));
                  }}
                />
              </div>
              <div>
                <label className="text-sm text-textMuted">Deposit amount</label>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={depositAmount}
                  onChange={(e) => {
                    const next = Number(e.target.value) || 0;
                    setDepositAmount(next);
                    const total = acceptingQuote.totalTtc ?? acceptingQuote.totalHt ?? 0;
                    const pct = total > 0 ? Math.round((next / total) * 100) : 0;
                    setDepositPercent(pct);
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-textMuted">Business account</label>
                <select
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={depositAccountId}
                  onChange={(e) => setDepositAccountId(e.target.value)}
                >
                  <option value="">No account</option>
                  {accounts.data?.map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                {!accounts.data?.length && (
                  <p className="mt-1 text-xs text-amber-400">
                    No business account found. Deposit transaction will not be recorded.
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm text-textMuted">Deposit date</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f0f11] px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={depositDate}
                  onChange={(e) => setDepositDate(e.target.value)}
                />
              </div>
            </div>

            <p className="text-xs text-textMuted">
              This will accept the quote and record a deposit transaction if an account is selected.
            </p>

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setAcceptDialogOpen(false);
                  setAcceptingQuote(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleConfirmAccept}>Accept quote & record deposit</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
