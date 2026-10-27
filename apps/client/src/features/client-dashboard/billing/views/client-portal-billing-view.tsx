"use client";

import { WalletCards } from "lucide-react";
import { EmptyState } from "@/app/components/ui/empty-state";
import { useClientWorkspace } from "../../workspace/shared";
import { ClientAccountEventPicker } from "../../workspace/views/sections/client-account-event-picker";

export function ClientPortalBillingView() {
  const { events } = useClientWorkspace();

  if (events.length === 0) {
    return <EmptyState icon={WalletCards} title="No billing workspace yet" description="Billing opens after your event workspace is activated." />;
  }

  return (
    <ClientAccountEventPicker purpose="billing" destination="billing" />
  );
}
