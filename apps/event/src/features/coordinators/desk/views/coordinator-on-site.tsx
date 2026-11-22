"use client";

import { ChevronDown, ChevronLeft, Clock, ClipboardCheck, Radio, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import type { PrismCoordinatorRoleView } from "@prism/types";
import type { PrismMobileBar, PrismShellNavItem as PrismNavItem } from "@prism/ui";
import { PRISM_NAV_ICONS } from "@prism/ui/nav-icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@prism/ui/components/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@prism/ui/components/sheet";
import { formatPortalDate } from "@prism/ui/format-date";
import { isOpenTask, issueAreaOptions, openIssues } from "../model/coordinator-shift";
import { COORDINATOR_VIEW_LABELS, type CoordinatorViewId } from "../model/coordinator-portal-routes";
import { useUpdatedAgo } from "../view-models/use-updated-ago";
import type { CoordinatorEventCard } from "./coordinator-event-switcher";
import type { CoordinatorIssueFormModel } from "./sections/coordinator-role-sections";
import { CoordinatorQuickReport } from "./sections/coordinator-quick-report";

/** Pages that belong to the open event, or are used all day; the phone top bar shows the event switch on these. */
const EVENT_VIEWS: CoordinatorViewId[] = ["shift", "tasks", "issues", "run-sheet", "registration", "games", "messages"];

/**
 * The phone bar: Now, Tasks (Check-in for the registration coordinator) and Run sheet, with Report raised between
 * them, and messages and notifications in the top bar. Issues open from Now, which carries the open-issue count and
 * lights up on the Issues page. Calendar and assignments sit under More.
 */
export function coordinatorMobileBar({ roleView, href, registrationRole, onReport }: {
  roleView: PrismCoordinatorRoleView | null;
  href: (view: CoordinatorViewId) => string;
  registrationRole: boolean;
  onReport: () => void;
}): PrismMobileBar {
  const issues = roleView ? openIssues(roleView.urgentIssues).length : 0;
  const tasks = roleView?.tasks.filter(isOpenTask).length ?? 0;
  const second: PrismNavItem = registrationRole
    ? { id: "registration", label: "Check-in", icon: ClipboardCheck, href: href("registration") }
    : { id: "tasks", label: COORDINATOR_VIEW_LABELS.tasks, icon: PRISM_NAV_ICONS.Tasks, href: href("tasks"), badge: tasks || undefined, badgeLabel: `${tasks} open tasks` };
  const nowCovers = registrationRole ? ["issues", "tasks"] : ["issues"];
  const now: PrismNavItem = { id: "shift", label: COORDINATOR_VIEW_LABELS.shift, icon: Clock, href: href("shift"), badge: issues || undefined, badgeLabel: `${issues} open issues`, subItems: nowCovers.map((id) => ({ id, label: id })) };
  return {
    tabs: [now, second, "run-sheet"],
    action: { label: "Report", ariaLabel: "Report an issue", icon: Radio, onSelect: onReport },
    header: ["messages", "notifications"],
  };
}

/** The open event in the phone top bar; tapping it switches to another assigned event. */
function CoordinatorEventMenu({ cards, selectedEventId, onSelect, onAllAssignments }: {
  cards: CoordinatorEventCard[];
  selectedEventId?: string;
  onSelect: (eventId: string) => void;
  onAllAssignments: () => void;
}) {
  const selected = cards.find(({ event }) => event.id === selectedEventId);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-h-11 max-w-full items-center gap-1 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Switch event">
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-foreground">{selected?.event.eventName ?? "Choose an event"}</span>
          {selected ? <span className="block truncate text-xs text-muted-foreground">{formatPortalDate(selected.event.eventDate)} · {selected.assignment.role}</span> : null}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[min(20rem,calc(100vw-2rem))]">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Your events</DropdownMenuLabel>
        {cards.map(({ event }) => (
          <DropdownMenuItem key={event.id} className="min-h-11 justify-between gap-3" onSelect={() => onSelect(event.id)} aria-current={event.id === selectedEventId ? "true" : undefined}>
            <span className={event.id === selectedEventId ? "truncate font-semibold text-primary" : "truncate"}>{event.eventName}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{formatPortalDate(event.eventDate)}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="min-h-11 text-primary" onSelect={onAllAssignments}>All my assignments</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The phone top bar's title: the event switch on event pages; on a page opened from More, a way back to
 * Now and that page's name.
 */
export function CoordinatorPhoneTitle({ view, cards, selectedEventId, onSelectEvent, onNavigate }: {
  view: CoordinatorViewId;
  cards: CoordinatorEventCard[];
  selectedEventId?: string;
  onSelectEvent: (eventId: string) => void;
  onNavigate: (view: CoordinatorViewId) => void;
}) {
  if (EVENT_VIEWS.includes(view)) {
    return <CoordinatorEventMenu cards={cards} selectedEventId={selectedEventId} onSelect={onSelectEvent} onAllAssignments={() => onNavigate("assignments")} />;
  }
  return (
    <button type="button" onClick={() => onNavigate("shift")} className="-ml-2 flex min-h-11 items-center gap-1 rounded-md px-1 text-sm font-semibold text-foreground">
      <ChevronLeft className="size-5" aria-hidden /><span className="sr-only">Back to Now, </span>{COORDINATOR_VIEW_LABELS[view]}
    </button>
  );
}

function UpdatedAgo({ roleView, loading, onRefresh }: { roleView: PrismCoordinatorRoleView; loading: boolean; onRefresh: () => void }) {
  const { label } = useUpdatedAgo(roleView);
  return (
    <span className="flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
      <span aria-hidden className="size-1.5 rounded-full bg-success" />
      <span role="status" aria-live="polite">{loading ? "Refreshing…" : label}</span>
      <button type="button" aria-label="Refresh" disabled={loading} onClick={onRefresh} className="-my-2 grid size-8 place-items-center rounded-full text-primary hover:bg-muted disabled:opacity-50">
        <RefreshCw className="size-3.5" aria-hidden />
      </button>
    </span>
  );
}

/**
 * The block under a page's title: what the page holds ("3 open · 1 blocked"), with when it was last updated and a
 * refresh under it, and the page's own action on the right. A coordinator on patchy signal sees at a glance whether
 * what they are looking at is current.
 */
export function PageStatusLine({ roleView, loading, onRefresh, summary, action }: {
  roleView: PrismCoordinatorRoleView | null;
  loading: boolean;
  onRefresh: () => void;
  summary?: string;
  action?: ReactNode;
}) {
  if (!roleView) return null;
  return (
    <div className="flex max-w-3xl lg:max-w-none items-center justify-between gap-3">
      <div className="grid min-w-0 gap-0.5">
        {summary ? <p className="text-sm text-foreground">{summary}</p> : null}
        <UpdatedAgo roleView={roleView} loading={loading} onRefresh={onRefresh} />
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** The quick report in a panel: from the bottom on a phone, from the side on a larger screen. */
export function ReportIssueSheet({ issueForm, roleView, venue, eventName, open, side, onOpenChange, onReported }: {
  issueForm: CoordinatorIssueFormModel;
  roleView: PrismCoordinatorRoleView | null;
  venue?: string;
  eventName?: string;
  open: boolean;
  side: "right" | "bottom";
  onOpenChange: (open: boolean) => void;
  onReported: () => void;
}) {
  const areas = roleView ? issueAreaOptions(roleView, venue) : [];
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className={side === "bottom" ? "max-h-[92dvh] overflow-y-auto rounded-t-2xl" : "w-full overflow-y-auto sm:max-w-lg"}>
        <SheetHeader>
          <SheetTitle>Report an issue</SheetTitle>
          <SheetDescription>{eventName ? `${eventName}. PMCM sees it as soon as you send it.` : "PMCM sees it as soon as you send it."}</SheetDescription>
        </SheetHeader>
        {/* Rendered only while open, so each report starts fresh. */}
        <div className="px-4 pb-6">{open ? <CoordinatorQuickReport issueForm={issueForm} areas={areas} onDone={onReported} /> : null}</div>
      </SheetContent>
    </Sheet>
  );
}
