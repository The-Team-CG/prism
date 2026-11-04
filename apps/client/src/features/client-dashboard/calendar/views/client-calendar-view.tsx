"use client";

import { useMemo } from "react";
import Link from "next/link";
import { BadgeCheck, CalendarDays, MapPinned, WalletCards, type LucideIcon } from "lucide-react";
import { formatPortalDate, manilaDateKey } from "@prism/ui/format-date";
import { PortalCalendar } from "@prism/ui/portal-calendar";
import { cn } from "@/app/components/ui/utils";
import { CLIENT_PORTAL_VIEW_META, dashboardHref, formatStatusLabel, useClientWorkspace } from "../../workspace/shared";
import type { ClientDashboardRoute } from "../../workspace/model/client-dashboard-types";
import { ClientListEmpty, ClientListSection, type ClientRowTone } from "../../shared/client-list-ui";
import { dueState, eventCountdown } from "../../home/model/client-home-summary";
import { buildClientCalendarItems, type ClientCalendarItem, type ClientCalendarItemKind } from "../model/client-calendar-items";

const KIND: Record<ClientCalendarItemKind, { label: string; icon: LucideIcon; chip: string; dot: string; route: ClientDashboardRoute }> = {
  event: { label: "Event", icon: CalendarDays, chip: "bg-primary/10 text-primary hover:bg-primary/15", dot: "bg-primary", route: "overview" },
  payment: { label: "Payment due", icon: WalletCards, chip: "bg-attention-soft text-attention hover:bg-attention/15", dot: "bg-attention", route: "billing" },
  visit: { label: "Site visit", icon: MapPinned, chip: "bg-info-soft text-info hover:bg-info/15", dot: "bg-info", route: "overview" },
  approval: { label: "Layout approved", icon: BadgeCheck, chip: "bg-success-soft text-success hover:bg-success/15", dot: "bg-success", route: "floorplan" },
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

  if (items.length === 0) {
    return <ClientListEmpty icon={CalendarDays} title="Nothing scheduled yet" description="Event dates, payment due dates, site visits and layout approvals appear here once they're set." />;
  }

  return (
    <div className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_22rem]">
      <PortalCalendar
        items={items}
        kinds={KIND}
        today={today}
        initialDate={upcoming[0]?.date ?? today}
        renderItem={({ item, className, title, children }) => <Link href={itemHref(item)} title={title} className={className}>{children}</Link>}
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
      <span className={cn("shrink-0 whitespace-nowrap text-xs tabular-nums", status.tone === "urgent" ? "font-semibold text-danger" : status.tone === "attention" ? "font-medium text-attention" : status.tone === "done" ? "text-success" : "text-muted-foreground")}>{status.label}</span>
    </li>
  );
}
