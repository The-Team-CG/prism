import { useEffect, useState } from "react";
import { CalendarDays, Check, ChevronDown, Flag, Send, ShieldOff, X } from "lucide-react";

import type { PrismSupplier, PrismSupplierCategory } from "@/lib/prism-api";
import { cx, label, money, RatingStars, tierLabel } from "./helpers";
import type { SupplierQuoteRequestRow, SupplierQuoteRow, SupplierQuoteSelectHandler, SupplierRequestHandler } from "./types";

export function SupplierQuotePlanner({
  categories,
  suppliers,
  requests,
  quotes,
  onRequestQuotes,
  onSelectQuote,
  busy,
}: {
  categories: PrismSupplierCategory[];
  suppliers: PrismSupplier[];
  requests: SupplierQuoteRequestRow[];
  quotes: SupplierQuoteRow[];
  onRequestQuotes: SupplierRequestHandler;
  onSelectQuote: SupplierQuoteSelectHandler;
  busy: boolean;
}) {
  const preferredCategoryId = categories.find((category) => category.slug === "digital-registration")?.id ?? categories[0]?.id ?? "";
  const [categoryId, setCategoryId] = useState(preferredCategoryId);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [confidentialBid, setConfidentialBid] = useState(false);
  const [deadline, setDeadline] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().slice(0, 10);
  });
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);

  useEffect(() => {
    if (categoryId && categories.some((category) => category.id === categoryId)) return;
    setCategoryId(preferredCategoryId);
  }, [categoryId, categories, preferredCategoryId]);

  const category = categories.find((item) => item.id === categoryId);
  const categorySuppliers = suppliers.filter((supplier) => supplier.categoryId === categoryId);
  const tierOne = categorySuppliers.filter((supplier) => supplier.tier === "tier_1");
  const tierTwo = categorySuppliers.filter((supplier) => supplier.tier === "tier_2");
  const pending = categorySuppliers.filter((supplier) => supplier.tier === "pending_first_event");
  const categoryRequests = requests.filter((request) => request.categoryId === categoryId || request.category === category?.name);
  const categoryQuotes = quotes.filter((quote) => quote.categoryId === categoryId || quote.category === category?.name);
  const activeRequestSupplierIds = new Set(
    categoryRequests
      .filter((request) => request.supplierId && !["closed", "expired"].includes(request.status))
      .map((request) => request.supplierId as string),
  );
  const availableTierOne = tierOne.filter((supplier) => !activeRequestSupplierIds.has(supplier.id));
  const availableTierTwo = tierTwo.filter((supplier) => !activeRequestSupplierIds.has(supplier.id));
  const availablePending = pending.filter((supplier) => !activeRequestSupplierIds.has(supplier.id));
  const availableRequestSuppliers = [...availableTierOne, ...availableTierTwo, ...availablePending];
  const selectedAvailableSupplierIds = selectedSupplierIds.filter((supplierId) => !activeRequestSupplierIds.has(supplierId));

  function openRequestModal() {
    setSelectedSupplierIds((availableTierOne.length ? availableTierOne : availableTierTwo).map((supplier) => supplier.id));
    setConfidentialBid(false);
    setModalOpen(true);
  }

  function toggleSupplier(supplierId: string) {
    setSelectedSupplierIds((current) =>
      current.includes(supplierId) ? current.filter((id) => id !== supplierId) : [...current, supplierId],
    );
  }

  async function submitQuoteRequest() {
    await onRequestQuotes({
      categoryId,
      supplierIds: selectedAvailableSupplierIds,
      confidentialBid,
      deadline,
    });
    setModalOpen(false);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-muted p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-(--prism-amber)">Supplier Quotes</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {category?.acceptableMin && category?.acceptableMax
                ? `Acceptable range: ${money.format(category.acceptableMin)} to ${money.format(category.acceptableMax)}`
                : "Acceptable range not set"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            <button
              disabled={busy || availableRequestSuppliers.length === 0}
              onClick={openRequestModal}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-(--prism-ink) px-3 text-sm font-black text-sidebar-foreground disabled:opacity-60"
            >
              <Send className="size-4" /> Request Quotes
            </button>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-primary/15 bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">Quote comparison</p>
            <h3 className="mt-1 text-lg font-black text-foreground">{category?.name ?? "Selected category"}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {categoryQuotes.length
                ? `${categoryQuotes.length} submitted bid${categoryQuotes.length === 1 ? "" : "s"} ready for PMCM review.`
                : "Submitted supplier bids will appear here for side-by-side review."}
            </p>
          </div>
          <span className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-black text-muted-foreground">
            {category?.acceptableMin && category?.acceptableMax
              ? `${money.format(category.acceptableMin)} - ${money.format(category.acceptableMax)}`
              : "No budget band"}
          </span>
        </div>

        {categoryQuotes.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border bg-background p-5">
            <p className="font-black text-foreground">No submitted quotes yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Send quote requests to available suppliers, then compare returned bids here.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 xl:grid-cols-3">
            {categoryQuotes.map((quote) => {
              const expanded = expandedQuoteId === quote.id;
              const quoteClosed = ["selected", "locked", "not_selected"].includes(quote.status);
              return (
                <article
                  key={quote.id}
                  className={cx(
                    "rounded-lg border bg-background p-4 shadow-sm",
                    quote.status === "selected" || quote.status === "locked"
                      ? "border-emerald-300 bg-emerald-50/70"
                      : quote.outsideAcceptableRange
                        ? "border-rose-200 bg-rose-50/70"
                        : "border-border",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {quote.outsideAcceptableRange && <Flag className="size-4 shrink-0 fill-rose-500 text-rose-500" />}
                        <h4 className="truncate text-base font-black text-foreground">{quote.supplierName}</h4>
                      </div>
                      <p className="mt-1 text-xs font-black uppercase tracking-wide text-muted-foreground">{label(quote.status)}</p>
                    </div>
                    <p className="shrink-0 text-lg font-black text-foreground">{money.format(quote.amount)}</p>
                  </div>

                  {quote.outsideAcceptableRange && (
                    <div className="mt-3 rounded-md border border-rose-200 bg-white px-2.5 py-2 text-xs font-black text-rose-700">
                      Outside budget range
                    </div>
                  )}

                  <div className="mt-4 grid gap-3 text-sm">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">Inclusions</p>
                      <button
                        onClick={() => setExpandedQuoteId(expanded ? null : quote.id)}
                        className="mt-1 inline-flex items-center gap-1 rounded-md border border-border bg-white px-2 py-1 text-xs font-black"
                      >
                        {quote.inclusions.length} item{quote.inclusions.length === 1 ? "" : "s"}
                        <ChevronDown className={cx("size-3.5 transition", expanded && "rotate-180")} />
                      </button>
                      {expanded && (
                        <ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
                          {quote.inclusions.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                      )}
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">Payment terms</p>
                      <p className="mt-1 text-sm text-foreground">{quote.paymentTerms || "Not provided"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">Notes</p>
                      <p className="mt-1 line-clamp-3 text-sm text-foreground">{quote.notes || "No notes"}</p>
                    </div>
                  </div>

                  <button
                    disabled={busy || quoteClosed}
                    onClick={() => onSelectQuote(quote.id)}
                    className={cx(
                      "mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md px-3 text-sm font-black disabled:opacity-60",
                      quote.status === "selected" || quote.status === "locked"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-(--prism-ink) text-sidebar-foreground",
                    )}
                  >
                    <Check className="size-4" />
                    {quote.status === "selected" || quote.status === "locked"
                      ? "Selected"
                      : quote.status === "not_selected"
                        ? "Closed"
                        : "Select supplier"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Auto-Suggested Tier 1</p>
          <div className="mt-3 space-y-2">
            {tierOne.map((supplier) => (
              <div key={supplier.id} className="w-full rounded-md border border-emerald-200 bg-emerald-50 p-3 text-left text-sm">
                <span className="block font-black">{supplier.name}</span>
                <span className="mt-1 flex items-center gap-2 text-xs text-emerald-700"><RatingStars rating={supplier.aggregateRating} /></span>
              </div>
            ))}
            {tierOne.length === 0 && <p className="text-sm text-muted-foreground">No Tier 1 supplier for this category yet.</p>}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#40A0D0]">Backup Suppliers</p>
          <div className="mt-3 space-y-2">
            {tierTwo.map((supplier) => (
              <div key={supplier.id} className="w-full rounded-md border border-border bg-secondary p-3 text-left text-sm">
                <span className="block font-black">{supplier.name}</span>
                <span className="mt-1 text-xs text-muted-foreground">{supplier.bniMember ? "BNI Auto-Trust" : "Manual backup"}</span>
              </div>
            ))}
            {tierTwo.length === 0 && <p className="text-sm text-muted-foreground">No Tier 2 backup in this category.</p>}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-(--prism-amber)">First Event Manual Select</p>
          <div className="mt-3 space-y-2">
            {pending.map((supplier) => (
              <div key={supplier.id} className="w-full rounded-md border border-[#F06030]/25 bg-accent p-3 text-left text-sm">
                <span className="block font-black">{supplier.name}</span>
                <span className="mt-1 text-xs text-(--prism-amber)">Excluded from auto-suggestions</span>
              </div>
            ))}
            {pending.length === 0 && <p className="text-sm text-muted-foreground">No pending-first-event suppliers here.</p>}
          </div>
        </section>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-border bg-card shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-border p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-(--prism-amber)">Request Quotes</p>
                <h3 className="mt-1 text-xl font-black">{category?.name}</h3>
              </div>
              <button onClick={() => setModalOpen(false)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-5 p-5">
              <div className="space-y-2">
                {[
                  { title: "Tier 1", suppliers: tierOne },
                  { title: "Backup", suppliers: tierTwo },
                  { title: "First event", suppliers: pending },
                ].map((group) => (
                  <div key={group.title} className="space-y-2">
                    <p className="text-xs font-black text-muted-foreground">{group.title}</p>
                    {group.suppliers.map((supplier) => {
                      const alreadyRequested = activeRequestSupplierIds.has(supplier.id);
                      return (
                        <label key={supplier.id} className={cx("flex items-start gap-3 rounded-md border border-border bg-background p-3", alreadyRequested && "opacity-60")}>
                          <input
                            type="checkbox"
                            checked={selectedSupplierIds.includes(supplier.id)}
                            disabled={alreadyRequested}
                            onChange={() => toggleSupplier(supplier.id)}
                            className="mt-1 size-4"
                          />
                          <span className="min-w-0">
                            <span className="block font-black">{supplier.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {alreadyRequested ? "Active request already sent" : `${tierLabel(supplier.tier)} - ${supplier.email || supplier.phone || "No contact saved"}`}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                    {group.suppliers.length === 0 && <p className="text-sm text-muted-foreground">No suppliers in this group.</p>}
                  </div>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="rounded-md border border-border bg-background p-3 text-sm">
                  <span className="flex items-center gap-2 font-black"><CalendarDays className="size-4" /> Deadline</span>
                  <input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3" />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3 text-sm">
                  <span>
                    <span className="block font-black">Confidential Bid</span>
                    <span className="text-xs text-muted-foreground">Hide client details from request</span>
                  </span>
                  <input type="checkbox" checked={confidentialBid} onChange={(event) => setConfidentialBid(event.target.checked)} className="size-5" />
                </label>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-border p-5">
              <button onClick={() => setModalOpen(false)} className="h-10 rounded-md border border-border bg-white px-3 text-sm font-black">Cancel</button>
              <button
                disabled={busy || selectedAvailableSupplierIds.length === 0}
                onClick={submitQuoteRequest}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-(--prism-ink) px-3 text-sm font-black text-sidebar-foreground disabled:opacity-60"
              >
                <Send className="size-4" /> Send Requests
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
