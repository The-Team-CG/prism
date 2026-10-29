"use client";

import { WalletCards } from "lucide-react";
import { manilaDateKey } from "@prism/ui/format-date";
import { dashboardHref, useClientWorkspace } from "../../workspace/shared";
import { money } from "../../workspace/model/client-dashboard-view-rules";
import { ClientAccountEventPicker } from "../../workspace/views/sections/client-account-event-picker";
import { ClientFigureStrip, ClientListEmpty } from "../../shared/client-list-ui";
import { clientBillingAccountFigures } from "../../home/model/client-home-summary";

export function ClientPortalBillingView() {
  const { events, state } = useClientWorkspace();

  if (events.length === 0 || !state) {
    return <ClientListEmpty icon={WalletCards} title="No billing yet" description="Billing opens once your event workspace is active and PMCM posts your statement." />;
  }

  const figures = clientBillingAccountFigures(
    state.paymentMilestones,
    new Set(events.map((event) => event.id)),
    manilaDateKey(),
    (amount) => money.format(amount),
    (route, eventId) => dashboardHref(route, eventId),
  );
  return (
    <div className="space-y-4">
      <ClientFigureStrip label="Billing across your events" figures={figures} />
      <ClientAccountEventPicker purpose="billing" destination="billing" />
    </div>
  );
}
