"use client";

import { WalletCards } from "lucide-react";
import { formatPortalDate, manilaDateKey } from "@prism/ui/format-date";
import { dashboardHref, formatStatusLabel, useClientWorkspace } from "../../workspace/shared";
import { CLIENT_PORTAL_VIEW_HREFS } from "../../workspace/model/client-dashboard-navigation";
import type { ClientPortalView } from "../../workspace/model/client-dashboard-types";
import { money } from "../../workspace/model/client-dashboard-view-rules";
import { ClientAccountEventPicker } from "../../workspace/views/sections/client-account-event-picker";
import { ClientFigureStrip, ClientListEmpty, ClientListRow, ClientListSection } from "../../shared/client-list-ui";
import { ClientRouteTabs } from "../../shared/client-route-tabs";
import { clientBillingAccountFigures } from "../../home/model/client-home-summary";
import { portalBillingRows } from "../model/client-billing-rules";

const BILLING_TABS: Array<{ id: string; view?: ClientPortalView; label: string; href: string }> = [
  { id: "billing-overview", label: "Overview", href: "/dashboard/billing" },
  { id: "billing-quotations", view: "billing-quotations", label: "Quotations", href: CLIENT_PORTAL_VIEW_HREFS["billing-quotations"] },
  { id: "billing-invoices", view: "billing-invoices", label: "Invoices", href: CLIENT_PORTAL_VIEW_HREFS["billing-invoices"] },
  { id: "billing-payment-schedule", view: "billing-payment-schedule", label: "Payment schedule", href: CLIENT_PORTAL_VIEW_HREFS["billing-payment-schedule"] },
  { id: "dashboard-payment-reminders", view: "dashboard-payment-reminders", label: "Reminders", href: CLIENT_PORTAL_VIEW_HREFS["billing-payment-reminders"] },
  { id: "billing-receipts", view: "billing-receipts", label: "Receipts", href: CLIENT_PORTAL_VIEW_HREFS["billing-receipts"] },
  { id: "billing-balance", view: "billing-balance", label: "Balance", href: CLIENT_PORTAL_VIEW_HREFS["billing-balance"] },
];

export function ClientPortalBillingView() {
  const { events, state, portalView } = useClientWorkspace();

  if (events.length === 0 || !state) {
    return <ClientListEmpty icon={WalletCards} title="No billing yet" description="Billing opens once your event workspace is active and PMCM posts your statement." />;
  }

  const activeTab = BILLING_TABS.find((tab) => tab.view === portalView) ?? BILLING_TABS[0];
  const tabs = (
    <ClientRouteTabs label="Billing views" activeId={activeTab.id} tabs={BILLING_TABS.map((tab) => ({ id: tab.id, label: tab.label, href: tab.href }))} />
  );
  const rows = portalBillingRows(portalView, { events, payments: state.paymentMilestones, statements: state.billingStatements });

  if (rows) {
    return (
      <div className="space-y-4">
        {tabs}
        {rows.length ? (
          <ClientListSection id="client-billing-list" title={activeTab.label} count={rows.length}>
            {rows.map((row) => (
              <ClientListRow
                key={row.id}
                icon={WalletCards}
                title={row.title}
                meta={[row.eventName, row.date ? formatPortalDate(row.date) : null].filter(Boolean).join(" · ")}
                status={money.format(row.amount)}
                statusTitle={formatStatusLabel(row.status)}
                action="Open billing"
                href={dashboardHref("billing", row.eventId)}
              />
            ))}
          </ClientListSection>
        ) : (
          <ClientListEmpty icon={WalletCards} title={`No ${activeTab.label.toLowerCase()} yet`} description="Billing items appear here once PMCM posts them for your events." />
        )}
      </div>
    );
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
      {tabs}
      <ClientFigureStrip label="Billing across your events" figures={figures} />
      <ClientAccountEventPicker purpose="billing" destination="billing" />
    </div>
  );
}
