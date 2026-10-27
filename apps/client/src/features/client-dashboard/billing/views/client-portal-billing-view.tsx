"use client";

import { WalletCards } from "lucide-react";
import { EmptyState } from "@/app/components/ui/empty-state";
import { PageHeader } from "../../workspace/shared";
import { CLIENT_PORTAL_VIEW_META } from "../../workspace/shared";
import { useClientWorkspace } from "../../workspace/shared";
import { ClientAccountEventPicker, useClientAccountEventChoiceRequired } from "../../workspace/views/sections/client-account-event-picker";
import { ClientBillingTab } from "./client-billing-tab";

export function ClientPortalBillingView() {
  const {
    portalView,
    selectedEvent,
    payments,
    billing,
    disputes,
  } = useClientWorkspace();
  const choiceRequired = useClientAccountEventChoiceRequired();
  const portalViewMeta = portalView ? CLIENT_PORTAL_VIEW_META[portalView] : undefined;

  if (!selectedEvent) {
    return <EmptyState icon={WalletCards} title="No billing workspace yet" description="Billing opens after your event workspace is activated." />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Billing & payments"
        title={portalViewMeta?.title ?? "Billing & payments"}
        description={portalViewMeta?.description ?? "Quotations, invoices, payment schedule, receipts, and balance for one event."}
      />
      <ClientAccountEventPicker purpose="billing" />
      {choiceRequired ? null : <ClientBillingTab payments={payments} billing={billing} disputes={disputes} />}
    </div>
  );
}
