"use client";

import { useMemo } from "react";
import Link from "next/link";
import { BadgeCheck, CalendarDays, MapPinned, WalletCards, type LucideIcon } from "lucide-react";
import { formatPortalDate, manilaDateKey } from "@prism/ui/format-date";
import { Button } from "@prism/ui/components/button";
import { PortalCalendar } from "@prism/ui/portal-calendar";
import { cn } from "@/app/components/ui/utils";
import { CLIENT_PORTAL_VIEW_META, dashboardHref, formatStatusLabel, useClientWorkspace } from "../../workspace/shared";
import { CLIENT_PORTAL_VIEW_HREFS } from "../../workspace/model/client-dashboard-navigation";
import type { ClientDashboardRoute, ClientPortalView } from "../../workspace/model/client-dashboard-types";
import { ClientListEmpty, ClientListSection, type ClientRowTone } from "../../shared/client-list-ui";
import { ClientRouteTabs } from "../../shared/client-route-tabs";
import { dueState, eventCountdown } from "../../home/model/client-home-summary";
import { buildClientCalendarItems, clientCalendarEmptyCopy, type ClientCalendarItem, type ClientCalendarItemKind } from "../model/client-calendar-items";

const CALENDAR_TABS: Array<{ id: string; label: string; href: string; view?: ClientPortalView }> = [
  { id: "calendar-all", label: "All", href: "/dashboard/calendar" },
  { id: "calendar-event-dates", label: "Event dates", href: CLIENT_PORTAL_VIEW_HREFS["calendar-event-dates"], view: "calendar-event-dates" },
  { id: "calendar-meetings", label: "Site visits", href: CLIENT_PORTAL_VIEW_HREFS["calendar-meetings"], view: "calendar-meetings" },
  { id: "calendar-deadlines", label: "Due dates", href: CLIENT_PORTAL_VIEW_HREFS["calendar-deadlines"], view: "calendar-deadlines" },
  { id: "calendar-payment-due-dates", label: "Payment schedule", href: CLIENT_PORTAL_VIEW_HREFS["calendar-payment-due-dates"], view: "calendar-payment-due-dates" },
  { id: "calendar-approval-deadlines", label: "Layout approvals", href: CLIENT_PORTAL_VIEW_HREFS["calendar-approval-deadlines"], view: "calendar-approval-deadlines" },
];

const KIND: Record<ClientCalendarItemKind, { label: string; icon: LucideIcon; chip: string; dot: string; route: ClientDashboardRoute; action: string }> = {
  event: { label: "Event", icon: CalendarDays, chip: "bg-primary/10 text-primary hover:bg-primary/15", dot: "bg-primary", route: "overview", action: "Open event" },
  payment: { label: "Payment due", icon: WalletCards, chip: "bg-attention-soft text-attention hover:bg-attention/15", dot: "bg-attention", route: "billing", action: "Open billing" },
  visit: { label: "Site visit", icon: MapPinned, chip: "bg-info-soft text-info hover:bg-info/15", dot: "bg-info", route: "overview", action: "Open event" },
  approval: { label: "Layout approved", icon: BadgeCheck, chip: "bg-success-soft text-success hover:bg-success/15", dot: "bg-success", route: "floorplan", action: "Open layout" },
};

function itemHref(item: ClientCalendarItem) {
  return dashboardHref(KIND[item.kind].route, item.eventId);
}

function itemStatus(item: ClientCalendarItem, today: string): { label: string; tone: ClientRowTone } {
  if (item.kind === "payment") {
    if (item.status === "paid") return { label: "Paid", tone: "done" };
    return dueState(item.date, today) ?? { label: formatStatusLabel(item.status), tone: "neutral" };
  }
  if (item.kind === "approval") return { label: "Approved", tone: "done" };
  return { label: eventCountdown(item.date, today) ?? formatPortalDate(item.date), tone: "neutral" };
}

export function ClientCalendarView() {
  const { portalView, state, events } = useClientWorkspace();
  const today = manilaDateKey();
  const items = useMemo(() => (state ? buildClientCalendarItems(state, events, portalView) : []), [events, portalView, state]);
  if (!state) return null;

  const upcoming = items.filter((item) => item.date >= today);
  const viewTitle = portalView ? CLIENT_PORTAL_VIEW_META[portalView]?.title : undefined;
  const activeTab = CALENDAR_TABS.find((tab) => tab.view === portalView) ?? CALENDAR_TABS[0];

  return (
    <div className="min-w-0 space-y-4">
      {items.length === 0 ? (
        <><ClientRouteTabs label="Calendar views" activeId={activeTab.id} tabs={CALENDAR_TABS.map((tab) => ({ id: tab.id, label: tab.label, href: tab.href }))} /><ClientListEmpty icon={CalendarDays} {...clientCalendarEmptyCopy(portalView)} /></>
      ) : (
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 2xl:grid-cols-[minmax(0,1fr)_22rem]">
          <PortalCalendar
            categoryControls={<ClientRouteTabs label="Calendar views" activeId={activeTab.id} tabs={CALENDAR_TABS.map((tab) => ({ id: tab.id, label: tab.label, href: tab.href }))} />}
            items={items}
            kinds={KIND}
            today={today}
            initialDate={upcoming[0]?.date ?? today}
            detail={{
              action: (item) => <Button asChild><Link href={itemHref(item)}>{KIND[item.kind].action}</Link></Button>,
            }}
          />

          <ClientListSection id="client-calendar-upcoming" title={viewTitle ?? (upcoming.length ? "Coming up" : "Recent")} count={(upcoming.length ? upcoming : items).length}>
            {(upcoming.length ? upcoming : [...items].reverse()).slice(0, 8).map((item) => {
              const status = itemStatus(item, today);
              return (
                <ClientCalendarRow key={item.id} item={item} status={status} />
              );
            })}
          </ClientListSection>
        </div>
      )}
    </div>
  );
}

/** Narrow side list: the four-column row would not fit, so date and status share the second line. */
function ClientCalendarRow({ item, status }: { item: ClientCalendarItem; status: { label: string; tone: ClientRowTone } }) {
  const Icon = KIND[item.kind].icon;
  return (
    <li className="relative flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-raised has-[a:focus-visible]:bg-surface-raised">
      <span aria-hidden className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-md", KIND[item.kind].chip)}><Icon className="size-4" /></span>
      <span className="min-w-0 flex-1">
        <Link href={itemHref(item)} className="block truncate text-sm font-semibold text-foreground outline-none after:absolute after:inset-0">{item.title}</Link>
        <span className="block truncate text-xs text-muted-foreground">{formatPortalDate(item.date)} · {item.detail}</span>
      </span>
      <span className={cn("w-28 shrink-0 whitespace-nowrap text-center text-xs tabular-nums", status.tone === "urgent" ? "font-semibold text-danger" : status.tone === "attention" ? "font-medium text-attention" : status.tone === "done" ? "text-success" : "text-muted-foreground")}>{status.label}</span>
    </li>
  );
}
