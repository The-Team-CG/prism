"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { manilaDateKey } from "@prism/ui/format-date";
import { Button } from "@prism/ui/components/button";
import { PortalCalendar } from "@prism/ui/portal-calendar";
import { dashboardHref, formatStatusLabel, useClientWorkspace } from "../../workspace/shared";
import { CLIENT_PORTAL_VIEW_HREFS } from "../../workspace/model/client-dashboard-navigation";
import type { ClientDashboardRoute, ClientPortalView } from "../../workspace/model/client-dashboard-types";
import { ClientListEmpty } from "../../shared/client-list-ui";
import { ClientRouteTabs } from "../../shared/client-route-tabs";
import { buildClientCalendarItems, clientCalendarEmptyCopy, type ClientCalendarItem, type ClientCalendarItemKind } from "../model/client-calendar-items";

const CALENDAR_TABS: Array<{ id: string; label: string; href: string; view?: ClientPortalView }> = [
  { id: "calendar-all", label: "All", href: "/dashboard/calendar" },
  { id: "calendar-event-dates", label: "Event dates", href: CLIENT_PORTAL_VIEW_HREFS["calendar-event-dates"], view: "calendar-event-dates" },
  { id: "calendar-meetings", label: "Site visits", href: CLIENT_PORTAL_VIEW_HREFS["calendar-meetings"], view: "calendar-meetings" },
  { id: "calendar-deadlines", label: "Due dates", href: CLIENT_PORTAL_VIEW_HREFS["calendar-deadlines"], view: "calendar-deadlines" },
  { id: "calendar-payment-due-dates", label: "Payment schedule", href: CLIENT_PORTAL_VIEW_HREFS["calendar-payment-due-dates"], view: "calendar-payment-due-dates" },
  { id: "calendar-approval-deadlines", label: "Layout approvals", href: CLIENT_PORTAL_VIEW_HREFS["calendar-approval-deadlines"], view: "calendar-approval-deadlines" },
];

const KIND: Record<ClientCalendarItemKind, { label: string; chip: string; dot: string; route: ClientDashboardRoute; action: string }> = {
  event: { label: "Event", chip: "bg-primary/10 text-primary hover:bg-primary/15", dot: "bg-primary", route: "overview", action: "Open event" },
  payment: { label: "Payment due", chip: "bg-attention-soft text-attention hover:bg-attention/15", dot: "bg-attention", route: "billing", action: "Open billing" },
  visit: { label: "Site visit", chip: "bg-info-soft text-info hover:bg-info/15", dot: "bg-info", route: "overview", action: "Open event" },
  approval: { label: "Layout approved", chip: "bg-success-soft text-success hover:bg-success/15", dot: "bg-success", route: "floorplan", action: "Open layout" },
};

function itemHref(item: ClientCalendarItem) {
  return dashboardHref(KIND[item.kind].route, item.eventId);
}

export function ClientCalendarView() {
  const { portalView, state, events } = useClientWorkspace();
  const today = manilaDateKey();
  const items = useMemo(() => (state ? buildClientCalendarItems(state, events, portalView) : []), [events, portalView, state]);
  const tabs = CALENDAR_TABS.map((tab) => ({ ...tab, count: state ? buildClientCalendarItems(state, events, tab.view).length : 0 })).filter((tab) => tab.id === "calendar-all" || tab.view === portalView || tab.count > 0);
  if (!state) return null;

  const upcoming = items.filter((item) => item.date >= today);
  const activeTab = CALENDAR_TABS.find((tab) => tab.view === portalView) ?? CALENDAR_TABS[0];

  return (
    <div className="min-w-0 space-y-4">
      {items.length === 0 ? (
        <><ClientRouteTabs label="Calendar views" activeId={activeTab.id} tabs={tabs} /><ClientListEmpty icon={CalendarDays} {...clientCalendarEmptyCopy(portalView)} /></>
      ) : (
        <PortalCalendar
          categoryControls={{ content: <ClientRouteTabs label="Calendar views" activeId={activeTab.id} tabs={tabs} />, selection: activeTab.id === "calendar-all" ? null : { label: activeTab.label, reset: <Link href="/dashboard/calendar">Clear filters</Link> } }}
          items={items}
          kinds={KIND}
          today={today}
          initialDate={upcoming[0]?.date ?? today}
          detail={{
            body: (item) => <p className="text-muted-foreground">Status: {formatStatusLabel(item.status)}</p>,
            action: (item) => <Button asChild><Link href={itemHref(item)}>{KIND[item.kind].action}</Link></Button>,
          }}
        />
      )}
    </div>
  );
}
