import { useEffect, useState } from "react";

import type { PrismSupplier, PrismSupplierCategory } from "@prism/types";
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
        onCategory={setCategoryId}
        onRequest={openRequestModal}
      />
      <QuoteComparisonSection
        categoryName={category?.name ?? "Selected category"}
        rangeCopy={rangeCopy}
        quotes={categoryQuotes}
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
