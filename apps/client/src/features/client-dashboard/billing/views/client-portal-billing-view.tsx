"use client";

import { WalletCards } from "lucide-react";
import { EmptyState } from "@/app/components/ui/empty-state";
import { useClientWorkspace } from "../../workspace/shared";
import { ClientAccountEventPicker, useClientAccountEventChoiceRequired } from "../../workspace/views/sections/client-account-event-picker";
import { ClientBillingTab } from "./client-billing-tab";

export function ClientPortalBillingView() {
  const {
    selectedEvent,
    payments,
    billing,
    disputes,
  } = useClientWorkspace();
  const choiceRequired = useClientAccountEventChoiceRequired();

  if (!selectedEvent) {
    return <EmptyState icon={WalletCards} title="No billing workspace yet" description="Billing opens after your event workspace is activated." />;
  }

  return (
    <div className="space-y-5">
      <ClientAccountEventPicker purpose="billing" />
      {choiceRequired ? null : <ClientBillingTab payments={payments} billing={billing} disputes={disputes} />}
    </div>
  );
}
