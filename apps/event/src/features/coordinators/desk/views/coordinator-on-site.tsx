"use client";

import { Bell, CalendarDays, ChevronDown, ChevronLeft, Clock, ClipboardCheck, ClipboardList, ListOrdered, LogOut, MessageSquare, Radio, RefreshCw, UserRound, UsersRound } from "lucide-react";
import type { PrismCoordinatorRoleView } from "@prism/types";
import type { PrismShellNavItem as PrismNavItem } from "@prism/ui";
import { Button } from "@prism/ui/components/button";
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
const EVENT_VIEWS: CoordinatorViewId[] = ["shift", "tasks", "issues", "run-sheet", "registration", "messages"];

/**
 * The phone tab bar: Now, Tasks (Check-in for the registration coordinator), Run sheet and Messages, with Report
 * raised between them. Issues open from Now, which carries the open-issue count and lights up on the Issues page.
 */
export function coordinatorMobileTabs({ roleView, href, registrationRole, unreadMessages }: {
  roleView: PrismCoordinatorRoleView | null;
  href: (view: CoordinatorViewId) => string;
  registrationRole: boolean;
  unreadMessages?: number;
}): PrismNavItem[] {
  const issues = roleView ? openIssues(roleView.urgentIssues).length : 0;
  const tasks = roleView?.tasks.filter(isOpenTask).length ?? 0;
  const second: PrismNavItem = registrationRole
    ? { id: "registration", label: "Check-in", icon: ClipboardCheck, href: href("registration") }
    : { id: "tasks", label: COORDINATOR_VIEW_LABELS.tasks, icon: ClipboardList, href: href("tasks"), badge: tasks || undefined, badgeLabel: `${tasks} open tasks` };
  const nowCovers = registrationRole ? ["issues", "tasks"] : ["issues"];
  return [
    { id: "shift", label: COORDINATOR_VIEW_LABELS.shift, icon: Clock, href: href("shift"), badge: issues || undefined, badgeLabel: `${issues} open issues`, subItems: nowCovers.map((id) => ({ id, label: id })) },
    second,
    { id: "run-sheet", label: COORDINATOR_VIEW_LABELS["run-sheet"], icon: ListOrdered, href: href("run-sheet") },
    { id: "messages", label: COORDINATOR_VIEW_LABELS.messages, icon: MessageSquare, href: href("messages"), badge: unreadMessages || undefined, badgeLabel: `${unreadMessages ?? 0} unread messages` },
  ];
}

/** Report, raised in the middle of the phone tab bar. */
export function reportTabAction(onReport: () => void) {
  return { label: "Report", ariaLabel: "Report an issue", icon: Radio, onSelect: onReport };
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
 * The phone top bar's title: the event switch on event pages; on a page opened from the account menu, a way back to
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

/** The phone top bar's right side: notifications and the account menu (calendar, assignments, account, sign out). */
export function CoordinatorPhoneActions({ initials, unreadNotices, onNavigate, onSignOut }: {
  initials: string;
  unreadNotices?: number;
  onNavigate: (view: CoordinatorViewId) => void;
  onSignOut?: () => void;
}) {
  return (
    <>
      <Button type="button" variant="ghost" size="icon" className="relative size-11" aria-label={unreadNotices ? `Notifications, ${unreadNotices} unread` : "Notifications"} onClick={() => onNavigate("notifications")}>
        <Bell className="size-5" aria-hidden />
        {unreadNotices ? <span aria-hidden className="absolute right-1.5 top-1.5 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] font-semibold leading-4 text-white">{unreadNotices}</span> : null}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Your account" className="grid size-11 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="grid size-8 place-items-center rounded-full bg-ink text-[11px] font-semibold text-ink-foreground">{initials}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem className="min-h-11" onSelect={() => onNavigate("calendar")}><CalendarDays className="size-4" aria-hidden />My calendar</DropdownMenuItem>
          <DropdownMenuItem className="min-h-11" onSelect={() => onNavigate("assignments")}><UsersRound className="size-4" aria-hidden />My assignments</DropdownMenuItem>
          <DropdownMenuItem className="min-h-11" onSelect={() => onNavigate("account")}><UserRound className="size-4" aria-hidden />Account</DropdownMenuItem>
          {onSignOut ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="min-h-11" onSelect={onSignOut}><LogOut className="size-4" aria-hidden />Sign out</DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

/** "Updated 20 s ago" with a Refresh button, so a coordinator on patchy signal knows whether what they see is current. */
export function FreshnessLine({ roleView, loading, onRefresh }: { roleView: PrismCoordinatorRoleView | null; loading: boolean; onRefresh: () => void }) {
  const { label } = useUpdatedAgo(roleView);
  if (!roleView) return null;
  return (
    <div className="flex max-w-3xl items-center justify-between gap-3 text-xs text-muted-foreground">
      <p role="status" aria-live="polite" className="flex items-center gap-1.5">
        <span aria-hidden className="size-2 rounded-full bg-success" />
        {loading ? "Refreshing…" : label}
      </p>
      <Button type="button" variant="ghost" size="sm" className="min-h-9 text-xs" disabled={loading} onClick={onRefresh}>
        <RefreshCw className="size-3.5" aria-hidden />Refresh
      </Button>
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
