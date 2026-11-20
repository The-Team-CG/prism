"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import { usePathname, useRouter } from "next/navigation";
import { formatPortalDate } from "@prism/ui/format-date";
import { Bell, BellRing, CalendarClock, CalendarDays, ClipboardCheck, ClipboardList, Home, MessageSquare, Radio, UserRound, UsersRound } from "lucide-react";
import { EventMessagesWorkspace } from '@/features/event-dashboard/messages/views/event-messages-workspace';
import { EventAccountView } from '@/features/account';
import { useEventUnreadMessages } from '@/features/event-dashboard/messages/view-models/use-event-unread-messages';
import { unreadNavBadge } from "@prism/ui/chat";
import { unreadNoticeBadge } from "@prism/ui/notifications";
import { useEventUnreadNotices } from "@/features/account-notifications/view-models/use-event-unread-notices";
import type { PrismAuthenticatedSession, PrismCoordinatorWorkspace } from "@prism/types";
import { PrismDashboardShell } from "@prism/ui";
import { Button } from "@prism/ui/components/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@prism/ui/components/sheet";
import { useDocumentTitle } from "@/app/components/document-title";
import { roleLabel } from "@/features/pmcm-kit";
import { CoordinatorRegistrationDesk } from "@/features/coordinators/registration";
import { optionalNavBadge } from "../model/coordinator-view-copy";
import { buildCoordinatorCalendarItems } from "../model/coordinator-calendar-items";
import { buildCoordinatorCommandActions, buildCoordinatorRecordGroups } from "../model/coordinator-command-index";
import {
  COORDINATOR_HOME_PATH,
  COORDINATOR_VIEW_LABELS,
  OUTSIDE_PORTAL_NOTICE,
  coordinatorLocationRedirect,
  coordinatorViewFromParam,
  coordinatorViewSearch,
  isCoordinatorHomePath,
  type CoordinatorViewId,
} from "../model/coordinator-portal-routes";
import { useCoordinatorViewModel } from "../view-models/use-coordinator-view-model";
import { CoordinatorCalendar } from "./coordinator-calendar";
import { CoordinatorEventSwitcher } from "./coordinator-event-switcher";
import { CoordinatorTimelineCard } from "./sections/coordinator-view-sections";
import { CoordinatorIssueFormFields, CoordinatorRoleData } from "./sections/coordinator-role-sections";
import { CoordinatorShiftPage } from "./sections/coordinator-shift-page";
import { CoordinatorAssignmentsPage } from "./sections/coordinator-assignments-page";
import { AccountNotificationsView } from "@/features/account-notifications/views/account-notifications-view";

type CoordinatorVm = ReturnType<typeof useCoordinatorViewModel>;
type NavigateTo = (view: CoordinatorViewId) => void;

/** App-relative href for a sidebar item, so the shell can render it as a real link. */
function viewHref(view: CoordinatorViewId, eventId?: string | null): string {
  return `${COORDINATOR_HOME_PATH}${coordinatorViewSearch(view, eventId)}`;
}

function CoordinatorRoleSection({ vm, section, onReportIssue }: { vm: CoordinatorVm; section: "tasks" | "issues"; onReportIssue: () => void }) {
  return (
    <CoordinatorRoleData
      section={section}
      roleViewLoading={vm.roleViewLoading}
      roleViewError={vm.roleViewError}
      roleView={vm.roleView}
      registrationRole={vm.registrationRole && !vm.readOnly}
      taskForm={vm.taskForm}
      reassignment={vm.reassignment}
      taskActions={vm.taskActions}
      operatorActions={vm.operatorActions}
      onReportIssue={onReportIssue}
    />
  );
}

/** Primary issue entry point. It sits in the top bar on every view, so reporting takes one step from anywhere. */
function ReportIssueButton({ onReport }: { onReport: () => void }) {
  return (
    <Button type="button" onClick={onReport} aria-label="Report an issue" className="min-h-11 rounded-md px-3 font-semibold">
      <Radio className="size-4" aria-hidden="true" /><span className="hidden sm:inline">Report an issue</span>
    </Button>
  );
}

function CoordinatorShiftSection({ vm, event, roleName, onNavigate }: { vm: CoordinatorVm; event: NonNullable<CoordinatorVm["event"]>; roleName: string; onNavigate: NavigateTo }) {
  return (
    <CoordinatorShiftPage
      event={event}
      assignment={vm.assignment}
      roleName={roleName}
      busy={vm.busy}
      roleView={vm.roleView}
      roleViewLoading={vm.roleViewLoading}
      roleViewError={vm.roleViewError}
      registrationRole={vm.registrationRole && !vm.readOnly}
      attendanceForm={vm.attendanceForm}
      onAcknowledge={vm.acknowledge}
      onNavigate={onNavigate}
    />
  );
}

/** The issue form in a side panel, so an issue is reported from whatever view the coordinator is on. */
function ReportIssueSheet({ vm, open, onOpenChange, onReported }: { vm: CoordinatorVm; open: boolean; onOpenChange: (open: boolean) => void; onReported: () => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Report an issue</SheetTitle>
          <SheetDescription>{vm.event ? `${vm.event.eventName}. PMCM sees it as soon as you send it.` : "PMCM sees it as soon as you send it."}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6"><CoordinatorIssueFormFields issueForm={vm.issueForm} onDone={onReported} /></div>
      </SheetContent>
    </Sheet>
  );
}

function CoordinatorRegistrationSection({ vm }: { vm: CoordinatorVm }) {
  if (!vm.event || !vm.registrationRole || vm.readOnly) {
    return <p role="status" className="text-sm text-muted-foreground">Registration is available to the assigned registration coordinator.</p>;
  }
  return <CoordinatorRegistrationDesk key={vm.event.id} eventId={vm.event.id} guestAttendanceCount={vm.roleView?.guestAttendanceCount} onAttendanceChange={vm.refreshRoleView} />;
}

function CoordinatorCalendarSection({ vm, onOpen }: { vm: CoordinatorVm; onOpen: (view: CoordinatorViewId, eventId: string) => void }) {
  const focus = vm.event && vm.roleView ? { eventId: vm.event.id, tasks: vm.roleView.tasks, days: vm.roleView.schedule?.days ?? [] } : null;
  return <CoordinatorCalendar items={buildCoordinatorCalendarItems(vm.assignedEvents, focus)} onOpen={onOpen} />;
}

/** Views that belong to the account, not to one event. */
const ACCOUNT_VIEWS: Partial<Record<CoordinatorViewId, (vm: CoordinatorVm, onOpen: (view: CoordinatorViewId, eventId: string) => void, session: PrismAuthenticatedSession) => ReactElement>> = {
  calendar: (vm, onOpen) => <CoordinatorCalendarSection vm={vm} onOpen={onOpen} />,
  notifications: () => <AccountNotificationsView role="coordinator" />,
  messages: (_vm, _onOpen, session) => <EventMessagesWorkspace session={session} />,
  account: () => <EventAccountView />,
};

function coordinatorDescription(view: CoordinatorViewId, event: CoordinatorVm['event'], roleName: string) {
  if (view === 'messages') return 'Conversations PMCM has invited you to across your assigned events.';
  if (view === 'account') return 'Who you are, how you sign in, and how PMCM reaches you.';
  return event ? `${event.eventName} · ${formatPortalDate(event.eventDate)} · ${roleName}` : 'Choose an assigned event to get started.';
}

function CoordinatorViewContent({ vm, view, session, events, roleName, onNavigate, onOpenItem, onReportIssue }: {
  vm: CoordinatorVm;
  view: CoordinatorViewId;
  session: PrismAuthenticatedSession;
  events: PrismCoordinatorWorkspace["events"];
  roleName: string;
  onNavigate: NavigateTo;
  onOpenItem: (view: CoordinatorViewId, eventId: string) => void;
  onReportIssue: () => void;
}) {
  const accountView = ACCOUNT_VIEWS[view];
  if (accountView) return accountView(vm, onOpenItem, session);
  if (!vm.event) return <p role="status" className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">{vm.selectedEventId ? "That event is not available to this account. Choose an assigned event." : "Choose an assigned event to see your work."}</p>;
  switch (view) {
    case "shift": return <CoordinatorShiftSection vm={vm} event={vm.event} roleName={roleName} onNavigate={onNavigate} />;
    case "tasks": return <CoordinatorRoleSection vm={vm} section="tasks" onReportIssue={onReportIssue} />;
    case "issues": return <CoordinatorRoleSection vm={vm} section="issues" onReportIssue={onReportIssue} />;
    case "run-sheet": return <CoordinatorTimelineCard roleView={vm.roleView} readOnly={vm.readOnly} onCheckAgain={() => void vm.refreshRoleView()} />;
    case "assignments": return (
      <CoordinatorAssignmentsPage
        event={vm.event}
        assignment={vm.assignment}
        assignments={vm.assignments}
        events={events}
        busy={vm.busy}
        onAcknowledge={vm.acknowledge}
        onDecline={vm.decline}
        onWithdraw={vm.withdraw}
        onOpenEvent={(eventId) => onOpenItem("shift", eventId)}
      />
    );
    case "registration": return <CoordinatorRegistrationSection vm={vm} />;
  }
}

export function CoordinatorView({ session, state, onRefresh, onSignOut }: {
  session: PrismAuthenticatedSession;
  state: PrismCoordinatorWorkspace;
  onRefresh: () => Promise<void>;
  onSignOut?: () => void;
}) {
  const vm = useCoordinatorViewModel({ session, state, onRefresh });
  const unreadMessages = useEventUnreadMessages();
  const unreadNotices = useEventUnreadNotices();
  const pathname = usePathname() ?? COORDINATOR_HOME_PATH;
  const router = useRouter();
  const [requestedView, setActiveView] = useState<CoordinatorViewId>("shift");
  const activeView = requestedView === "registration" && (!vm.registrationRole || vm.readOnly) ? "shift" : requestedView;
  const [outsideNotice, setOutsideNotice] = useState(false);
  const [reporting, setReporting] = useState(false);
  const selectEventRef = useRef(vm.selectEvent);
  useEffect(() => { selectEventRef.current = vm.selectEvent; });
  useEffect(() => {
    // A PMCM or unknown path leaves the coordinator portal: send the coordinator home instead of rendering a page
    // for the wrong URL. Legacy section ids are rewritten in place, so old links keep their event and view.
    const redirect = coordinatorLocationRedirect({ pathname, search: window.location.search });
    if (redirect && !isCoordinatorHomePath(pathname)) {
      router.replace(`${COORDINATOR_HOME_PATH}${redirect.search}`);
      return;
    }
    if (redirect) window.history.replaceState(null, "", `${window.location.pathname}${redirect.search}`);
    const sync = () => {
      const params = new URLSearchParams(window.location.search);
      setActiveView(coordinatorViewFromParam(params.get("view")));
      setOutsideNotice(params.get("notice") === OUTSIDE_PORTAL_NOTICE);
      selectEventRef.current(params.get("event"));
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [pathname, router]);

  const roleName = vm.assignment?.role ?? roleLabel(session.role);
  const navItems = [
    { id: "shift", icon: Home, label: COORDINATOR_VIEW_LABELS.shift, section: "Coordinator", href: viewHref("shift", vm.event?.id) },
    { id: "tasks", icon: ClipboardList, label: COORDINATOR_VIEW_LABELS.tasks, section: "Coordinator", badge: optionalNavBadge(vm.roleView?.tasks.length), href: viewHref("tasks", vm.event?.id) },
    { id: "issues", icon: BellRing, label: COORDINATOR_VIEW_LABELS.issues, section: "Coordinator", badge: optionalNavBadge(vm.roleView?.urgentIssues.filter((issue) => issue.status !== "resolved").length), href: viewHref("issues", vm.event?.id) },
    { id: "run-sheet", icon: CalendarClock, label: COORDINATOR_VIEW_LABELS["run-sheet"], section: "Coordinator", href: viewHref("run-sheet", vm.event?.id) },
    { id: "calendar", icon: CalendarDays, label: COORDINATOR_VIEW_LABELS.calendar, section: "Coordinator", href: viewHref("calendar", vm.event?.id) },
    { id: "messages", icon: MessageSquare, label: COORDINATOR_VIEW_LABELS.messages, section: "Coordinator", href: viewHref("messages"), ...unreadNavBadge(unreadMessages) },
    { id: "notifications", icon: Bell, label: COORDINATOR_VIEW_LABELS.notifications, section: "Coordinator", href: viewHref("notifications"), ...unreadNoticeBadge(unreadNotices) },
    { id: "assignments", icon: UsersRound, label: COORDINATOR_VIEW_LABELS.assignments, section: "Coordinator", href: viewHref("assignments", vm.event?.id) },
    ...(vm.registrationRole && !vm.readOnly ? [{ id: "registration", icon: ClipboardCheck, label: COORDINATOR_VIEW_LABELS.registration, section: "Coordinator", href: viewHref("registration", vm.event?.id) }] : []),
  ];

  function navigateTo(view: CoordinatorViewId, eventId = vm.event?.id) {
    setActiveView(view);
    window.history.pushState(null, "", `${window.location.pathname}${coordinatorViewSearch(view, eventId)}`);
  }
  function handleEvent(eventId: string) {
    vm.selectEvent(eventId);
    navigateTo(activeView, eventId);
  }
  function openCalendarItem(view: CoordinatorViewId, eventId: string) {
    vm.selectEvent(eventId);
    navigateTo(view, eventId);
  }
  function reportIssue() {
    // Without a writable event and its data there is nothing to report against; Issues explains why.
    if (!vm.event || vm.readOnly || !vm.roleView) navigateTo("issues");
    else setReporting(true);
  }
  function issueReported() {
    setReporting(false);
    navigateTo("issues");
  }
  useDocumentTitle(`${COORDINATOR_VIEW_LABELS[activeView]} · P.R.I.S.M`);

  function dismissOutsideNotice() {
    setOutsideNotice(false);
    window.history.replaceState(null, "", `${window.location.pathname}${coordinatorViewSearch(activeView, vm.event?.id)}`);
  }

  return (
    <PrismDashboardShell
      portal="event"
      productLabel="P.R.I.S.M"
      roleLabel="Coordinator Portal"
      title={COORDINATOR_VIEW_LABELS[activeView]}
      description={coordinatorDescription(activeView, vm.event, roleName)}
      activeItemId={activeView}
      navItems={navItems}
      onNavSelect={(id) => navigateTo(coordinatorViewFromParam(id))}
      headerActions={<ReportIssueButton onReport={reportIssue} />}
      alwaysShowHeaderActions
      user={{ name: session.name, detail: roleLabel(session.role), initials: session.name.slice(0, 2).toUpperCase() }}
      accountMenuItems={[{ id: "account", label: "Account", icon: UserRound, onSelect: () => navigateTo("account") }]}
      onSignOut={onSignOut}
      searchPlaceholder="Search tasks and issues..."
      commandSectionLabel="Actions"
      commandActions={buildCoordinatorCommandActions(
        { canMark: vm.attendanceForm.canMark, hasAssignment: vm.attendanceForm.hasAssignment, windowOpen: vm.attendanceForm.windowOpen },
        navigateTo,
      )}
      commandGroups={buildCoordinatorRecordGroups({ tasks: vm.roleView?.tasks ?? [], issues: vm.roleView?.urgentIssues ?? [] }, navigateTo)}
      sidebarContext={<CoordinatorEventSwitcher events={state.events} assignments={vm.assignments} selectedEventId={vm.event?.id} onSelect={handleEvent} />}
    >
      <div className="space-y-5">
        {outsideNotice ? (
          <div role="status" className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <span>{"That page isn't part of the coordinator portal."}</span>
            <button type="button" onClick={dismissOutsideNotice} className="min-h-11 shrink-0 px-2 font-semibold text-foreground focus-visible:ring-2 focus-visible:ring-primary">
              Dismiss
            </button>
          </div>
        ) : null}
        {vm.readOnly ? <p role="status" className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">Archived event: operational records are read-only.</p> : null}
        <fieldset disabled={vm.readOnly && activeView !== "run-sheet" && activeView !== 'messages'} className="min-w-0">
          <CoordinatorViewContent vm={vm} view={activeView} session={session} events={state.events} roleName={roleName} onNavigate={navigateTo} onOpenItem={openCalendarItem} onReportIssue={reportIssue} />
        </fieldset>
        <ReportIssueSheet vm={vm} open={reporting} onOpenChange={setReporting} onReported={issueReported} />
      </div>
    </PrismDashboardShell>
  );
}
