import { CalendarDays, Check, ChevronDown, Flag, Send, X } from "lucide-react";

import type { PrismSupplier, PrismSupplierCategory } from "@prism/types";
import { DatePicker } from "@prism/ui/components/date-picker";
import { cx, label, money, RatingStars, tierLabel } from "@/features/pmcm-kit";
import type { SupplierQuoteRow } from "@/features/pmcm-kit";
import {
  inclusionCountLabel,
  isQuoteClosed,
  quoteCardAccentClass,
  quoteSelectButtonClass,
  quoteSelectLabel,
  submittedBidCopy,
} from "../model/suppliers-directory-rules";

export function QuotePlannerToolbar({
  rangeCopy,
  categoryId,
  categories,
  busy,
  canRequest,
  onCategory,
  onRequest,
}: {
  rangeCopy: { summary: string; badge: string };
  categoryId: string;
  categories: PrismSupplierCategory[];
  busy: boolean;
  canRequest: boolean;
  onCategory: (id: string) => void;
  onRequest: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-attention">Supplier Quotes</p>
          <p className="mt-1 text-sm text-muted-foreground">{rangeCopy.summary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={categoryId} onChange={(event) => onCategory(event.target.value)} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <button
            disabled={busy || !canRequest}
            onClick={onRequest}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-3 text-sm font-black text-ink-foreground disabled:opacity-60"
          >
            <Send className="size-4" /> Request Quotes
          </button>
        </div>
      </div>
    </div>
  );
}

export function QuoteComparisonSection({
  categoryName,
  rangeCopy,
  quotes,
  expandedQuoteId,
  busy,
  onToggleExpanded,
  onSelectQuote,
}: {
  categoryName: string;
  rangeCopy: { summary: string; badge: string };
  quotes: SupplierQuoteRow[];
  expandedQuoteId: string | null;
  busy: boolean;
  onToggleExpanded: (id: string) => void;
  onSelectQuote: (id: string) => void;
}) {
  return (
    <section className="rounded-xl border border-primary/15 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-primary">Quote comparison</p>
          <h3 className="mt-1 text-lg font-black text-foreground">{categoryName}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{submittedBidCopy(quotes.length)}</p>
        </div>
        <span className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-black text-muted-foreground">
          {rangeCopy.badge}
        </span>
      </div>
      {quotes.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border bg-background p-5">
          <p className="font-black text-foreground">No submitted quotes yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Send quote requests to available suppliers, then compare returned bids here.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          {quotes.map((quote) => (
            <QuoteComparisonCard
              key={quote.id}
              quote={quote}
              expanded={expandedQuoteId === quote.id}
              busy={busy}
              onToggle={() => onToggleExpanded(quote.id)}
              onSelect={() => onSelectQuote(quote.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function QuoteComparisonCard({
  quote,
  expanded,
  busy,
  onToggle,
  onSelect,
}: {
  quote: SupplierQuoteRow;
  expanded: boolean;
  busy: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  const closed = isQuoteClosed(quote.status);
  return (
    <article className={cx("rounded-lg border bg-background p-4 shadow-sm", quoteCardAccentClass(quote))}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {quote.outsideAcceptableRange && <Flag className="size-4 shrink-0 fill-danger text-danger" />}
            <h4 className="truncate text-base font-black text-foreground">{quote.supplierName}</h4>
          </div>
          <p className="mt-1 text-xs font-medium text-muted-foreground">{label(quote.status)}</p>
        </div>
        <p className="shrink-0 text-lg font-black text-foreground">{money.format(quote.amount)}</p>
      </div>
      {quote.outsideAcceptableRange && (
        <div className="mt-3 rounded-md border border-danger/25 bg-white px-2.5 py-2 text-xs font-black text-danger">
          Outside budget range
        </div>
      )}
      <div className="mt-4 grid gap-3 text-sm">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Inclusions</p>
          <button
            onClick={onToggle}
            className="mt-1 inline-flex items-center gap-1 rounded-md border border-border bg-white px-2 py-1 text-xs font-black"
          >
            {inclusionCountLabel(quote.inclusions.length)}
            <ChevronDown className={cx("size-3.5 transition", expanded && "rotate-180")} />
          </button>
          {expanded && (
            <ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
              {quote.inclusions.map((item) => <li key={item}>{item}</li>)}
            </ul>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Payment terms</p>
          <p className="mt-1 text-sm text-foreground">{quote.paymentTerms || "Not provided"}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Notes</p>
          <p className="mt-1 line-clamp-3 text-sm text-foreground">{quote.notes || "No notes"}</p>
        </div>
      </div>
      <button
        disabled={busy || closed}
        onClick={onSelect}
        className={cx(
          "mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md px-3 text-sm font-black disabled:opacity-60",
          quoteSelectButtonClass(quote.status),
        )}
      >
        <Check className="size-4" />
        {quoteSelectLabel(quote.status)}
      </button>
    </article>
  );
}

export function SupplierTierColumns({
  tierOne,
  tierTwo,
  pending,
}: {
  tierOne: PrismSupplier[];
  tierTwo: PrismSupplier[];
  pending: PrismSupplier[];
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <section className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs font-medium text-success">Auto-Suggested Tier 1</p>
        <div className="mt-3 space-y-2">
          {tierOne.map((supplier) => (
            <div key={supplier.id} className="w-full rounded-md border border-success/25 bg-success-soft p-3 text-left text-sm">
              <span className="block font-black">{supplier.name}</span>
              <span className="mt-1 flex items-center gap-2 text-xs text-success"><RatingStars rating={supplier.aggregateRating} /></span>
            </div>
          ))}
          {tierOne.length === 0 && <p className="text-sm text-muted-foreground">No Tier 1 supplier for this category yet.</p>}
        </div>
      </section>
      <section className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs font-medium text-brand-blue">Backup Suppliers</p>
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
        <p className="text-xs font-medium text-attention">First Event Manual Select</p>
        <div className="mt-3 space-y-2">
          {pending.map((supplier) => (
            <div key={supplier.id} className="w-full rounded-md border border-brand-orange/25 bg-accent p-3 text-left text-sm">
              <span className="block font-black">{supplier.name}</span>
              <span className="mt-1 text-xs text-attention">Excluded from auto-suggestions</span>
            </div>
          ))}
          {pending.length === 0 && <p className="text-sm text-muted-foreground">No pending-first-event suppliers here.</p>}
        </div>
      </section>
    </div>
  );
}

export function QuoteRequestModal({
  categoryName,
  groups,
  selectedSupplierIds,
  activeRequestSupplierIds,
  deadline,
  confidentialBid,
  busy,
  canSubmit,
  onToggle,
  onDeadline,
  onConfidential,
  onClose,
  onSubmit,
}: {
  categoryName?: string;
  groups: Array<{ title: string; suppliers: PrismSupplier[] }>;
  selectedSupplierIds: string[];
  activeRequestSupplierIds: Set<string>;
  deadline: string;
  confidentialBid: boolean;
  busy: boolean;
  canSubmit: boolean;
  onToggle: (id: string) => void;
  onDeadline: (value: string) => void;
  onConfidential: (value: boolean) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
      <div className="flex max-h-[calc(100dvh-2rem)] w-full min-w-0 max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <p className="text-xs font-medium text-attention">Request Quotes</p>
            <h3 className="mt-1 text-xl font-black">{categoryName}</h3>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 space-y-5 overflow-y-auto p-5">
          <div className="space-y-2">
            {groups.map((group) => (
              <QuoteRequestGroup
                key={group.title}
                title={group.title}
                suppliers={group.suppliers}
                selectedSupplierIds={selectedSupplierIds}
                activeRequestSupplierIds={activeRequestSupplierIds}
                onToggle={onToggle}
              />
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border bg-background p-3 text-sm">
              <span className="flex items-center gap-2 font-black"><CalendarDays className="size-4" /> Deadline</span>
              <DatePicker aria-label="Quote deadline" value={deadline} onValueChange={onDeadline} className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3" />
            </div>
            <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3 text-sm">
              <span>
                <span className="block font-black">Confidential Bid</span>
                <span className="text-xs text-muted-foreground">Hide client details from request</span>
              </span>
              <input type="checkbox" checked={confidentialBid} onChange={(event) => onConfidential(event.target.checked)} className="size-5" />
            </label>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border p-5">
          <button onClick={onClose} className="h-10 rounded-md border border-border bg-white px-3 text-sm font-black">Cancel</button>
          <button
            disabled={busy || !canSubmit}
            onClick={onSubmit}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-3 text-sm font-black text-ink-foreground disabled:opacity-60"
          >
            <Send className="size-4" /> Send Requests
          </button>
        </div>
      </div>
    </div>
  );
}

function QuoteRequestGroup({
  title,
  suppliers,
  selectedSupplierIds,
  activeRequestSupplierIds,
  onToggle,
}: {
  title: string;
  suppliers: PrismSupplier[];
  selectedSupplierIds: string[];
  activeRequestSupplierIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-black text-muted-foreground">{title}</p>
      {suppliers.map((supplier) => (
        <QuoteRequestSupplierRow
          key={supplier.id}
          supplier={supplier}
          alreadyRequested={activeRequestSupplierIds.has(supplier.id)}
          checked={selectedSupplierIds.includes(supplier.id)}
          onToggle={onToggle}
        />
      ))}
      {suppliers.length === 0 ? <p className="text-sm text-muted-foreground">No suppliers in this group.</p> : null}
    </div>
  );
}

function QuoteRequestSupplierRow({
  supplier,
  alreadyRequested,
  checked,
  onToggle,
}: {
  supplier: PrismSupplier;
  alreadyRequested: boolean;
  checked: boolean;
  onToggle: (id: string) => void;
}) {
  const hint = alreadyRequested
    ? "Active request already sent"
    : `${tierLabel(supplier.tier)} - ${supplier.email || supplier.phone || "No contact saved"}`;
  return (
    <label className={cx("flex items-start gap-3 rounded-md border border-border bg-background p-3", alreadyRequested && "opacity-60")}>
      <input
        type="checkbox"
        checked={checked}
        disabled={alreadyRequested}
        onChange={() => onToggle(supplier.id)}
        className="mt-1 size-4"
      />
      <span className="min-w-0">
        <span className="block font-black">{supplier.name}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}
