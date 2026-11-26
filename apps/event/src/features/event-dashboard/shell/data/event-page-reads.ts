import type { usePrefetch } from "@prism/portal-query";
import { eventFinancialSummary } from "@/features/finance/financials";
import { paymentReceipts } from "@/features/finance/receipts";
import { eventStatementOfAccount, financeEventAddenda } from "@/features/finance/workspace";
import { eventPreConformeContext } from "@/features/inquiries/context-notes";
import { pmcmSupplierScheduleWindows, pmcmSupplierWorkflows } from "@/features/suppliers/workflows";

type Prefetch = ReturnType<typeof usePrefetch>;

/**
 * The reads an event page makes for itself, keyed by the route's view. An event page renders only once the shell has
 * the session and the PMCM reference, so the shell starts these from the event id in the URL instead, alongside its
 * own reads. Each entry must use the same resource and params as the page, or the page asks again.
 */
export const EVENT_PAGE_READS: Partial<Record<string, (prefetch: Prefetch, eventId: string) => void>> = {
  briefing: (prefetch, eventId) => {
    prefetch(eventPreConformeContext, eventId);
  },
  suppliers: (prefetch, eventId) => {
    prefetch(pmcmSupplierWorkflows, eventId);
    prefetch(pmcmSupplierScheduleWindows, eventId);
  },
  billing: (prefetch, eventId) => {
    prefetch(financeEventAddenda, eventId);
    prefetch(eventStatementOfAccount, eventId);
    prefetch(paymentReceipts, { eventId });
    prefetch(eventFinancialSummary, eventId);
  },
};
