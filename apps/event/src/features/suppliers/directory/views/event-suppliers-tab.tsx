import { Truck } from "lucide-react";

import type { PrismSupplier, PrismSupplierCategory } from "@prism/types";
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
}: {
  categories: PrismSupplierCategory[];
  suppliers: PrismSupplier[];
  requests: SupplierQuoteRequestRow[];
  quotes: SupplierQuoteRow[];
  busy: boolean;
  onRequestQuotes: SupplierRequestHandler;
  onSelectQuote: SupplierQuoteSelectHandler;
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
        busy={busy}
      />
    </Panel>
  );
}
