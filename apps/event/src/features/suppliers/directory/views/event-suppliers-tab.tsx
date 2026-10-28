import { Truck } from "lucide-react";

import type { PrismSupplier, PrismSupplierCategory, PrismSupplierQuoteRoundComparison, SupplierAvailabilityInput } from "@prism/types";
import { SupplierQuotePlanner } from "./supplier-quote-planner";
import type { SupplierQuoteRequestRow, SupplierQuoteRow, SupplierQuoteSelectHandler, SupplierRequestHandler } from "@/features/pmcm-kit";
import { Panel } from "@/features/pmcm-kit";

export function EventSuppliersTab({
  categories,
  suppliers,
  requests,
  quotes,
  busy,
  onRequestQuotes,
  onSelectQuote,
  onCompareRound,
  onSetAvailability,
}: {
  categories: PrismSupplierCategory[];
  suppliers: PrismSupplier[];
  requests: SupplierQuoteRequestRow[];
  quotes: SupplierQuoteRow[];
  busy: boolean;
  onRequestQuotes: SupplierRequestHandler;
  onSelectQuote: SupplierQuoteSelectHandler;
  onCompareRound: (roundId: string) => Promise<PrismSupplierQuoteRoundComparison>;
  onSetAvailability: (supplierId: string, input: SupplierAvailabilityInput) => Promise<unknown>;
}) {
  return (
    <Panel title="Supplier desk" icon={Truck}>
      <SupplierQuotePlanner
        categories={categories}
        suppliers={suppliers}
        requests={requests}
        quotes={quotes}
        onRequestQuotes={onRequestQuotes}
        onSelectQuote={onSelectQuote}
        onCompareRound={onCompareRound}
        onSetAvailability={onSetAvailability}
        busy={busy}
      />
    </Panel>
  );
}
