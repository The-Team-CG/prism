import { useEffect, useRef, useState } from "react";

import type { PrismSupplier, PrismSupplierCategory, PrismSupplierQuoteRoundComparison, SupplierAvailabilityInput } from "@prism/types";
import { money } from "@/features/pmcm-kit";
import type { SupplierQuoteRequestRow, SupplierQuoteRow, SupplierQuoteSelectHandler, SupplierRequestHandler } from "@/features/pmcm-kit";
import {
  isQuoteRequestReady,
  quoteAcceptableRangeCopy,
  toggleSupplierSelection,
} from "../model/suppliers-directory-rules";
import {
  QuoteComparisonSection,
  QuotePlannerToolbar,
  QuoteRequestModal,
  SupplierTierColumns,
} from "./quote-planner-sections";

export function SupplierQuotePlanner({
  categories,
  suppliers,
  requests,
  quotes,
  onRequestQuotes,
  onSelectQuote,
  busy,
  onCompareRound,
  onSetAvailability,
}: {
  categories: PrismSupplierCategory[];
  suppliers: PrismSupplier[];
  requests: SupplierQuoteRequestRow[];
  quotes: SupplierQuoteRow[];
  onRequestQuotes: SupplierRequestHandler;
  onSelectQuote: SupplierQuoteSelectHandler;
  onCompareRound: (roundId: string) => Promise<PrismSupplierQuoteRoundComparison>;
  onSetAvailability: (supplierId: string, input: SupplierAvailabilityInput) => Promise<unknown>;
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
  const [comparison, setComparison] = useState<PrismSupplierQuoteRoundComparison | null>(null);
  const comparisonRequest = useRef(0);
  const [comparisonBusy, setComparisonBusy] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [availabilitySupplierId, setAvailabilitySupplierId] = useState("");
  const [availabilityDate, setAvailabilityDate] = useState("");
  const [availabilityCapacity, setAvailabilityCapacity] = useState("1");
  const [availabilityBlocked, setAvailabilityBlocked] = useState(false);
  const [availabilityNotice, setAvailabilityNotice] = useState<string | null>(null);

  useEffect(() => {
    if (categoryId && categories.some((category) => category.id === categoryId)) return;
    setCategoryId(preferredCategoryId);
  }, [categoryId, categories, preferredCategoryId]);

  useEffect(() => () => { comparisonRequest.current += 1; }, []);

  const category = categories.find((item) => item.id === categoryId);
  const categorySuppliers = suppliers.filter((supplier) => supplier.categoryId === categoryId);
  const tierOne = categorySuppliers.filter((supplier) => supplier.tier === "tier_1");
  const tierTwo = categorySuppliers.filter((supplier) => supplier.tier === "tier_2");
  const pending = categorySuppliers.filter((supplier) => supplier.tier === "pending_first_event");
  const categoryRequests = requests.filter((request) => request.categoryId === categoryId || request.category === category?.name);
  const categoryQuotes = quotes.filter((quote) => quote.categoryId === categoryId || quote.category === category?.name);
  const roundIds = [...new Set(categoryRequests.flatMap((request) => request.roundId ? [request.roundId] : []))];
  const roundNumbers = new Map(categoryRequests.flatMap((request) => request.roundId ? [[request.roundId, request.roundNumber] as const] : []));
  const comparisonQuotes = comparison?.bids.map((bid) => ({
    ...bid,
    supplierId: bid.supplierId ?? undefined,
    categoryId,
    category: comparison.category,
    inclusions: bid.inclusions ?? [],
    paymentTerms: bid.paymentTerms ?? "",
    notes: bid.notes ?? "",
    createdAt: "",
  })) ?? null;
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
  const rangeCopy = quoteAcceptableRangeCopy(
    {
      acceptableMin: category?.acceptableMin ?? undefined,
      acceptableMax: category?.acceptableMax ?? undefined,
    },
    (amount) => money.format(amount),
  );
  const requestGroups = [
    { title: "Tier 1", suppliers: tierOne },
    { title: "Backup", suppliers: tierTwo },
    { title: "First event", suppliers: pending },
  ];

  function openRequestModal() {
    setSelectedSupplierIds((availableTierOne.length ? availableTierOne : availableTierTwo).map((supplier) => supplier.id));
    setConfidentialBid(false);
    setModalOpen(true);
  }

  function toggleSupplier(supplierId: string) {
    setSelectedSupplierIds((current) => toggleSupplierSelection(current, supplierId));
  }

  async function submitQuoteRequest() {
    if (!isQuoteRequestReady({ supplierIds: selectedAvailableSupplierIds })) return;
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
      <QuotePlannerToolbar
        rangeCopy={rangeCopy}
        categoryId={categoryId}
        categories={categories}
        busy={busy}
        canRequest={availableRequestSuppliers.length > 0}
          onCategory={(id) => { setCategoryId(id); comparisonRequest.current += 1; setComparison(null); setComparisonBusy(false); }}
        onRequest={openRequestModal}
      />
      <section className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label className="grid gap-1 text-xs font-semibold">Supplier availability
          <select aria-label="Supplier availability supplier" value={availabilitySupplierId} onChange={(event) => setAvailabilitySupplierId(event.target.value)} className="h-10 rounded-md border border-border bg-background px-3 text-sm">
            <option value="">Choose supplier</option>
            {categorySuppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-xs font-semibold">Available on<input aria-label="Availability date" type="date" value={availabilityDate} onChange={(event) => setAvailabilityDate(event.target.value)} className="h-10 rounded-md border border-border bg-background px-3 text-sm" /></label>
          <label className="grid gap-1 text-xs font-semibold">Capacity<input aria-label="Availability capacity" type="number" min="0" max="1000" step="1" value={availabilityCapacity} onChange={(event) => setAvailabilityCapacity(event.target.value)} className="h-10 rounded-md border border-border bg-background px-3 text-sm" /></label>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={availabilityBlocked} onChange={(event) => setAvailabilityBlocked(event.target.checked)} />Blocked</label>
          <button type="button" disabled={busy || !availabilitySupplierId || !availabilityDate || !Number.isInteger(Number(availabilityCapacity)) || Number(availabilityCapacity) < 0} onClick={() => {
            setAvailabilityNotice(null);
            void onSetAvailability(availabilitySupplierId, { availableOn: availabilityDate, capacity: Number(availabilityCapacity), blocked: availabilityBlocked })
              .then((result) => setAvailabilityNotice(result ? "Availability saved for this supplier and date." : "Unable to save availability. Check the event workspace alert."))
              .catch((cause: unknown) => setAvailabilityNotice(cause instanceof Error ? cause.message : "Unable to save availability."));
          }} className="h-10 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">Save</button>
        </div>
        {availabilityNotice ? <p role="status" className="text-xs text-muted-foreground md:col-span-3">{availabilityNotice}</p> : null}
      </section>
      {roundIds.length ? <div className="flex flex-wrap items-center gap-2" aria-label="Supplier quote rounds">
        <span className="text-xs font-semibold text-muted-foreground">Compare bid round:</span>
        {roundIds.map((roundId, index) => <button key={roundId} type="button" disabled={comparisonBusy} onClick={() => {
          const request = ++comparisonRequest.current;
          setComparisonBusy(true); setComparisonError(null);
          void onCompareRound(roundId)
            .then((result) => { if (request === comparisonRequest.current) setComparison(result); })
            .catch((cause: unknown) => { if (request === comparisonRequest.current) setComparisonError(cause instanceof Error ? cause.message : "Unable to load quote comparison."); })
            .finally(() => { if (request === comparisonRequest.current) setComparisonBusy(false); });
        }} className="rounded-md border border-border px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50">{comparisonBusy ? "Loading…" : `Round ${roundNumbers.get(roundId) ?? index + 1}`}</button>)}
        {comparison ? <span className="text-xs text-muted-foreground">Loaded {comparison.bids.length} bids from round {comparison.roundNumber}</span> : null}
        {comparisonError ? <span role="alert" className="text-xs text-destructive">{comparisonError}</span> : null}
      </div> : null}
      <QuoteComparisonSection
        categoryName={category?.name ?? "Selected category"}
        rangeCopy={rangeCopy}
        quotes={comparisonQuotes ?? categoryQuotes}
        expandedQuoteId={expandedQuoteId}
        busy={busy}
        onToggleExpanded={(id) => setExpandedQuoteId((current) => (current === id ? null : id))}
        onSelectQuote={onSelectQuote}
      />
      <SupplierTierColumns tierOne={tierOne} tierTwo={tierTwo} pending={pending} />
      {modalOpen && (
        <QuoteRequestModal
          categoryName={category?.name}
          groups={requestGroups}
          selectedSupplierIds={selectedSupplierIds}
          activeRequestSupplierIds={activeRequestSupplierIds}
          deadline={deadline}
          confidentialBid={confidentialBid}
          busy={busy}
          canSubmit={selectedAvailableSupplierIds.length > 0}
          onToggle={toggleSupplier}
          onDeadline={setDeadline}
          onConfidential={setConfidentialBid}
          onClose={() => setModalOpen(false)}
          onSubmit={submitQuoteRequest}
        />
      )}
    </div>
  );
}
