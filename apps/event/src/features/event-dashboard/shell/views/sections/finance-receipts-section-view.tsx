"use client";

import { PaymentReceiptsWorkspace } from "@/features/finance/receipts";
import { useEventDashboardLoadedRouteViewModel } from "../event-dashboard-route-context";

/** Money received outside P.R.I.S.M. is not tied to one event, so this desk sits beside Finance, not inside an event. */
export function EventDashboardFinanceReceiptsSectionView() {
  const { events } = useEventDashboardLoadedRouteViewModel();
  return <PaymentReceiptsWorkspace events={events} />;
}
