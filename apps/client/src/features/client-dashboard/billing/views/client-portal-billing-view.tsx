"use client";

import { WalletCards } from "lucide-react";
import { EmptyState } from "@/app/components/ui/empty-state";
import { PageHeader } from "../../workspace/shared";
import { CLIENT_PORTAL_VIEW_META } from "../../workspace/shared";
import { useClientWorkspace } from "../../workspace/shared";
import { ClientBillingTab } from "./client-billing-tab";

export function ClientPortalBillingView() {
  const {
    portalView,
    selectedEvent,
    payments,
    billing,
  } = useClientWorkspace();
  const portalViewMeta = portalView ? CLIENT_PORTAL_VIEW_META[portalView] : undefined;

    if (!selectedEvent) {
      return <EmptyState icon={WalletCards} title="No billing workspace yet" description="Billing opens after your event workspace is activated." />;
    }
  
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Billing & payments"
          title={portalViewMeta?.title ?? selectedEvent.eventName}
          description={portalViewMeta?.description ?? "Quotations, invoices, payment schedule, receipts, and balance for the selected event."}
        />
        <ClientBillingTab payments={payments} billing={billing} />
      </div>
    );
}
