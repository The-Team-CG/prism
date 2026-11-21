"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import { usePathname, useRouter } from "next/navigation";
import { formatPortalDate } from "@prism/ui/format-date";
import { Bell, BellRing, CalendarClock, CalendarDays, ClipboardCheck, ClipboardList, Clock, MessageSquare, Plus, Radio, UserRound, UsersRound } from "lucide-react";
import { EventMessagesWorkspace } from '@/features/event-dashboard/messages/views/event-messages-workspace';
import { EventAccountView } from '@/features/account';
import { useEventUnreadMessages } from '@/features/event-dashboard/messages/view-models/use-event-unread-messages';
import { unreadNavBadge } from "@prism/ui/chat";
import { unreadNoticeBadge } from "@prism/ui/notifications";
import { useEventUnreadNotices } from "@/features/account-notifications/view-models/use-event-unread-notices";
import type { PrismAuthenticatedSession, PrismCoordinatorWorkspace } from "@prism/types";
import { PrismDashboardShell, useIsMobile } from "@prism/ui";
import { Button } from "@prism/ui/components/button";
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
import { CoordinatorEventSwitcher, eventCards } from "./coordinator-event-switcher";
import { CoordinatorTimelineCard } from "./sections/coordinator-view-sections";
import { CoordinatorRoleData, CoordinatorTaskSheet } from "./sections/coordinator-role-sections";
import { CoordinatorNowPage } from "./sections/coordinator-now-page";
import { coordinatorMobileBar, CoordinatorPhoneTitle, PageStatusLine, ReportIssueSheet } from "./coordinator-on-site";
import { issuesSummary, tasksSummary } from "../model/coordinator-shift";
import { CoordinatorAssignmentsPage } from "./sections/coordinator-assignments-page";
import { AccountNotificationsView } from "@/features/account-notifications/views/account-notifications-view";

type CoordinatorVm = ReturnType<typeof useCoordinatorViewModel>;
type NavigateTo = (view: CoordinatorViewId) => void;

/** App-relative href for a sidebar item, so the shell can render it as a real link. */
function viewHref(view: CoordinatorViewId, eventId?: string | null): string {
  return `${COORDINATOR_HOME_PATH}${coordinatorViewSearch(view, eventId)}`;
}

type Panels = { onReportIssue: () => void; onLogTask: () => void };

function CoordinatorRoleSection({ vm, section }: { vm: CoordinatorVm; section: "tasks" | "issues" }) {
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

function CoordinatorNowSection({ vm, event, onNavigate }: { vm: CoordinatorVm; event: NonNullable<CoordinatorVm["event"]>; onNavigate: NavigateTo }) {
  return (
    <CoordinatorNowPage
      event={event}
      assignment={vm.assignment}
      busy={vm.busy}
      roleView={vm.roleView}
      roleViewLoading={vm.roleViewLoading}
      roleViewError={vm.roleViewError}
      attendanceForm={vm.attendanceForm}
      taskActions={vm.taskActions}
      operatorActions={vm.operatorActions}
      onAcknowledge={vm.acknowledge}
      onDecline={vm.decline}
      onWithdraw={vm.withdraw}
      onNavigate={onNavigate}
    />
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

/** Views that stay usable on an archived event: reading the run sheet, messages and everything account-wide. */
/** Views showing the open event's live data, which carry the "Updated … ago" line. */
const LIVE_VIEWS: CoordinatorViewId[] = ["shift", "tasks", "issues", "run-sheet"];

const READ_ONLY_SAFE_VIEWS: CoordinatorViewId[] = ["run-sheet", "messages", "calendar", "notifications", "account", "assignments"];

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

/** Pages for the open event. Without one, the coordinator is asked to choose. */
function EventViewContent({ vm, view, events, onNavigate, onOpenItem }: {
  vm: CoordinatorVm;
  view: CoordinatorViewId;
  events: PrismCoordinatorWorkspace["events"];
  onNavigate: NavigateTo;
  onOpenItem: (view: CoordinatorViewId, eventId: string) => void;
}) {
  if (!vm.event) return <p role="status" className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">{vm.selectedEventId ? "That event is not available to this account. Choose an assigned event." : "Choose an assigned event to see your work."}</p>;
  switch (view) {
    case "tasks": return <CoordinatorRoleSection vm={vm} section="tasks" />;
    case "issues": return <CoordinatorRoleSection vm={vm} section="issues" />;
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
    default: return <CoordinatorNowSection vm={vm} event={vm.event} onNavigate={onNavigate} />;
  }
}

function CoordinatorViewContent({ vm, view, session, onOpenItem, ...rest }: {
  vm: CoordinatorVm;
  view: CoordinatorViewId;
  session: PrismAuthenticatedSession;
  events: PrismCoordinatorWorkspace["events"];
  onNavigate: NavigateTo;
  onOpenItem: (view: CoordinatorViewId, eventId: string) => void;
}) {
  const accountView = ACCOUNT_VIEWS[view];
  if (accountView) return accountView(vm, onOpenItem, session);
  return <EventViewContent vm={vm} view={view} onOpenItem={onOpenItem} {...rest} />;
}

/**
 * The view named in the URL, kept in step with Back and Forward. A PMCM or unknown path leaves the coordinator
 * portal and goes home; legacy section ids are rewritten in place, so old links keep their event and view.
 */
function useCoordinatorLocation(selectEvent: (eventId: string | null) => void) {
  const pathname = usePathname() ?? COORDINATOR_HOME_PATH;
  const router = useRouter();
  const [requestedView, setActiveView] = useState<CoordinatorViewId>("shift");
  const [outsideNotice, setOutsideNotice] = useState(false);
  const selectEventRef = useRef(selectEvent);
  useEffect(() => { selectEventRef.current = selectEvent; });
  useEffect(() => {
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
  return { requestedView, setActiveView, outsideNotice, setOutsideNotice };
}

/** The sidebar from a tablet up: every coordinator page, with open counts and unread badges. */
function coordinatorSidebarItems(vm: CoordinatorVm, unreadMessages: number | undefined, unreadNotices: number | undefined) {
  const eventId = vm.event?.id;
  const openIssues = vm.roleView?.urgentIssues.filter((issue) => issue.status !== "resolved").length;
  const registration = vm.registrationRole && !vm.readOnly
    ? [{ id: "registration", icon: ClipboardCheck, label: COORDINATOR_VIEW_LABELS.registration, section: "Coordinator", href: viewHref("registration", eventId) }]
    : [];
  return [
    { id: "shift", icon: Clock, label: COORDINATOR_VIEW_LABELS.shift, section: "Coordinator", href: viewHref("shift", eventId) },
    { id: "tasks", icon: ClipboardList, label: COORDINATOR_VIEW_LABELS.tasks, section: "Coordinator", badge: optionalNavBadge(vm.roleView?.tasks.length), href: viewHref("tasks", eventId) },
    { id: "issues", icon: BellRing, label: COORDINATOR_VIEW_LABELS.issues, section: "Coordinator", badge: optionalNavBadge(openIssues), href: viewHref("issues", eventId) },
    { id: "run-sheet", icon: CalendarClock, label: COORDINATOR_VIEW_LABELS["run-sheet"], section: "Coordinator", href: viewHref("run-sheet", eventId) },
    { id: "calendar", icon: CalendarDays, label: COORDINATOR_VIEW_LABELS.calendar, section: "Coordinator", href: viewHref("calendar", eventId) },
    { id: "messages", icon: MessageSquare, label: COORDINATOR_VIEW_LABELS.messages, section: "Coordinator", href: viewHref("messages"), ...unreadNavBadge(unreadMessages) },
    { id: "notifications", icon: Bell, label: COORDINATOR_VIEW_LABELS.notifications, section: "Coordinator", href: viewHref("notifications"), ...unreadNoticeBadge(unreadNotices) },
    { id: "assignments", icon: UsersRound, label: COORDINATOR_VIEW_LABELS.assignments, section: "Coordinator", href: viewHref("assignments", eventId) },
    ...registration,
  ];
}

/** Report an issue and Log a task, as panels over whatever page is open. Without a writable event, the page explains. */
function useCoordinatorPanels(vm: CoordinatorVm, navigateTo: NavigateTo) {
  const [reporting, setReporting] = useState(false);
  const [logging, setLogging] = useState(false);
  // Reporting must open at once, even while the event's data is still arriving on a slow connection.
  const canReport = Boolean(vm.event && !vm.readOnly);
  const writable = canReport && Boolean(vm.roleView);
  return {
    writable,
    reporting,
    setReporting,
    logging,
    setLogging,
    panels: {
      onReportIssue: () => (canReport ? setReporting(true) : navigateTo("issues")),
      onLogTask: () => (writable ? setLogging(true) : navigateTo("tasks")),
    } satisfies Panels,
    issueReported: () => {
      setReporting(false);
      navigateTo("issues");
    },
  };
}

/** Each live page's status: Tasks and Issues count their work and carry their action; Now and Run sheet only say when. */
function pageStatus(view: CoordinatorViewId, vm: CoordinatorVm, panels: Panels) {
  if (!vm.roleView) return {};
  if (view === "tasks") {
    if (vm.taskForm.blockedReason) return { summary: tasksSummary(vm.roleView.tasks) };
    return { summary: tasksSummary(vm.roleView.tasks), action: <Button type="button" size="sm" variant="outline" className="min-h-10" onClick={panels.onLogTask}><Plus className="size-4" aria-hidden />Log a task</Button> };
  }
  if (view === "issues") {
    return { summary: issuesSummary(vm.roleView.urgentIssues, vm.roleView.guestAttendanceCount), action: <Button type="button" size="sm" variant="outline" className="hidden min-h-10 md:inline-flex" onClick={panels.onReportIssue}><Radio className="size-4" aria-hidden />Report an issue</Button> };
  }
  return {};
}

function PageNotices({ vm, view, panels, outsideNotice, onDismiss, live }: { vm: CoordinatorVm; view: CoordinatorViewId; panels: Panels; outsideNotice: boolean; onDismiss: () => void; live: boolean }) {
  return (
    <>
      {live ? <PageStatusLine roleView={vm.roleView} loading={vm.roleViewLoading} onRefresh={() => void vm.refreshRoleView()} {...pageStatus(view, vm, panels)} /> : null}
      {outsideNotice ? (
        <div role="status" className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <span>{"That page isn't part of the coordinator portal."}</span>
          <button type="button" onClick={onDismiss} className="min-h-11 shrink-0 px-2 font-semibold text-foreground focus-visible:ring-2 focus-visible:ring-primary">
            Dismiss
          </button>
        </div>
      ) : null}
      {vm.readOnly ? <p role="status" className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">Archived event: operational records are read-only.</p> : null}
    </>
  );
}

function CoordinatorPanels({ vm, panelState, compact }: { vm: CoordinatorVm; panelState: ReturnType<typeof useCoordinatorPanels>; compact: boolean }) {
  const side = compact ? "bottom" : "right";
  return (
    <>
      <ReportIssueSheet issueForm={vm.issueForm} roleView={vm.roleView} venue={vm.event?.venue} eventName={vm.event?.eventName} open={panelState.reporting} side={side} onOpenChange={panelState.setReporting} onReported={panelState.issueReported} />
      <CoordinatorTaskSheet taskForm={vm.taskForm} open={panelState.logging} side={side} onOpenChange={panelState.setLogging} />
    </>
  );
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
  const compact = useIsMobile();
  const location = useCoordinatorLocation(vm.selectEvent);
  const registrationOpen = vm.registrationRole && !vm.readOnly;
  const activeView = location.requestedView === "registration" && !registrationOpen ? "shift" : location.requestedView;

  function navigateTo(view: CoordinatorViewId, eventId = vm.event?.id) {
    location.setActiveView(view);
    window.history.pushState(null, "", `${window.location.pathname}${coordinatorViewSearch(view, eventId)}`);
  }
  function openEventView(view: CoordinatorViewId, eventId: string) {
    vm.selectEvent(eventId);
    navigateTo(view, eventId);
  }
  function dismissOutsideNotice() {
    location.setOutsideNotice(false);
    window.history.replaceState(null, "", `${window.location.pathname}${coordinatorViewSearch(activeView, vm.event?.id)}`);
  }
  const panelState = useCoordinatorPanels(vm, navigateTo);
  const eventSwitcher = <CoordinatorEventSwitcher events={state.events} assignments={vm.assignments} selectedEventId={vm.event?.id} onSelect={(eventId) => openEventView(activeView, eventId)} />;
  const roleName = vm.assignment?.role ?? roleLabel(session.role);
  useDocumentTitle(`${COORDINATOR_VIEW_LABELS[activeView]} · P.R.I.S.M`);

  return (
    <PrismDashboardShell
      portal="event"
      productLabel="P.R.I.S.M"
      roleLabel="Coordinator Portal"
      title={COORDINATOR_VIEW_LABELS[activeView]}
      description={coordinatorDescription(activeView, vm.event, roleName)}
      activeItemId={activeView}
      breadcrumb={[COORDINATOR_VIEW_LABELS[activeView]]}
      navItems={coordinatorSidebarItems(vm, unreadMessages, unreadNotices)}
      onNavSelect={(id) => navigateTo(coordinatorViewFromParam(id))}
      headerActions={<ReportIssueButton onReport={panelState.panels.onReportIssue} />}
      alwaysShowHeaderActions
      mobileBar={coordinatorMobileBar({ roleView: vm.roleView, href: (view) => viewHref(view, vm.event?.id), registrationRole: registrationOpen, onReport: panelState.panels.onReportIssue })}
      mobileTitle={<CoordinatorPhoneTitle view={activeView} cards={eventCards(state.events, vm.assignments)} selectedEventId={vm.event?.id} onSelectEvent={(eventId) => openEventView(activeView, eventId)} onNavigate={navigateTo} />}
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
      sidebarContext={eventSwitcher}
    >
      <div className="space-y-4">
        <PageNotices vm={vm} view={activeView} panels={panelState.panels} outsideNotice={location.outsideNotice} onDismiss={dismissOutsideNotice} live={Boolean(vm.event && !vm.readOnly && LIVE_VIEWS.includes(activeView))} />
        <fieldset disabled={vm.readOnly && !READ_ONLY_SAFE_VIEWS.includes(activeView)} className="min-w-0">
          <CoordinatorViewContent
            vm={vm}
            view={activeView}
            session={session}
            events={state.events}
            onNavigate={navigateTo}
            onOpenItem={openEventView}
          />
        </fieldset>
        <CoordinatorPanels vm={vm} panelState={panelState} compact={compact} />
      </div>
    </PrismDashboardShell>
  );
}
