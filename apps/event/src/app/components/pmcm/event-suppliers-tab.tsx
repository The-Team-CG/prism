import { Truck } from "lucide-react";

import type { PrismSupplier, PrismSupplierCategory } from "@/lib/prism-api";
import { SupplierQuotePlanner } from "./supplier-quote-planner";
import type {
  SupplierQuoteRequestRow,
  SupplierQuoteRow,
  SupplierQuoteSelectHandler,
  SupplierRequestHandler,
} from "./types";
import { Panel } from "./primitives";

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
