"use client";


import {
  useEffect,
  useState } from "react";
import {
  acknowledgeAndRefreshRoleView,
  loadCoordinatorRoleView,
} from "../use-cases/coordinator-desk-actions";
import {
  isRegistrationCoordinatorRole,
  pickActiveAssignment,
  sameCoordinatorName,
} from "../model/coordinators-desk-rules";
import {
  AlertTriangle,
  BadgeCheck,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Home,
  LayoutGrid,
  LockKeyhole,
  Radio,
  ShieldCheck,
  Truck,
  UserCheck,
  UsersRound,
  } from "lucide-react";

import type { PrismCoordinatorRoleView } from "@/lib/prism-api";
import type { PrismCoordinatorWorkspace } from "@prism/types";
import { PrismDashboardShell } from "@prism/ui";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { label } from "@/features/pmcm-kit";
import type { PmcmEventSession } from "@/features/pmcm-kit";

/* ── Inline primitives (replacing @prism/ui blocks) ────────────── */

type StatusSummaryItem = {
  id: string;
  label: string;
  value: React.ReactNode;
  icon?: React.ElementType;
  status?: string;
  detail?: string;
};

function StatusSummary({ items }: { items: StatusSummaryItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.id} className="rounded-lg border border-border bg-background/80 p-3.5">
            <div className="flex items-start gap-3">
              {Icon ? (
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-black uppercase tracking-widest text-muted-foreground">{item.label}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-black text-foreground">
                  <span className="min-w-0 truncate">{item.value}</span>
                  {item.status ? <StatusBadge status={item.status} /> : null}
                </div>
                {item.detail ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.detail}</p> : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type EventDayAction = {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  status?: string;
  active?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
};

function EventDayActionGroup({ actions }: { actions: EventDayAction[] }) {
  if (!actions.length) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            type="button"
            disabled={action.disabled}
            data-active={action.active}
            onClick={action.onSelect}
            className="min-h-24 rounded-lg border border-border bg-background/75 p-4 text-left transition hover:border-primary/30 hover:bg-secondary/35 disabled:cursor-not-allowed disabled:opacity-55 data-[active=true]:border-primary/45 data-[active=true]:bg-secondary"
          >
            <span className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-black text-foreground">{action.label}</span>
                  {action.status ? <StatusBadge status={action.status} /> : null}
                </span>
                {action.description ? <span className="mt-1 block text-xs leading-5 text-muted-foreground">{action.description}</span> : null}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

type CompactRecordItem = {
  id: string;
  title: string;
  description?: string;
  meta?: string;
  status?: string;
  icon?: React.ElementType;
  onSelect?: () => void;
};

function CompactRecordList({ items, emptyText = "No records available." }: { items: CompactRecordItem[]; emptyText?: string }) {
  if (!items.length) {
    return (
      <p className="rounded-md border border-dashed border-border bg-secondary/40 px-4 py-6 text-center text-sm text-muted-foreground">
        {emptyText}
      </p>
    );
  }
  return (
    <div className="flex flex-col divide-y divide-border">
      {items.map((item) => {
        const Icon = item.icon;
        const content = (
          <span className="flex w-full items-start gap-3 text-left">
            {Icon ? (
              <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                <Icon className="size-4" />
              </span>
            ) : null}
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-black text-foreground">{item.title}</span>
                {item.status ? <StatusBadge status={item.status} /> : null}
              </span>
              {item.description ? <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-muted-foreground">{item.description}</span> : null}
              {item.meta ? <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{item.meta}</span> : null}
            </span>
          </span>
        );
        const cls = "border-l-2 border-l-transparent px-3 py-3 transition hover:bg-muted/50";
        return item.onSelect
          ? <button key={item.id} type="button" onClick={item.onSelect} className={cls}>{content}</button>
          : <div key={item.id} className={cls}>{content}</div>;
      })}
    </div>
  );
}

/* ── Card primitives ─────────────────────────────────────────── */

function CCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-card shadow-sm ${className}`}>{children}</div>
  );
}

function CCardHeader({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-border px-5 py-4">{children}</div>;
}

function CCardBody({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return <div id={id} className={`px-5 py-4 ${className}`}>{children}</div>;
}

function SectionAccent({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-widest text-(--prism-signal)">{children}</p>
  );
}

export function CoordinatorView({
  session,
  state,
  onRefresh,
  onSignOut,
}: {
  session: PmcmEventSession;
  state: PrismCoordinatorWorkspace;
  onRefresh: () => Promise<void>;
  onSignOut?: () => void;
}) {
  const assignments = state.assignments.filter((item) =>
    sameCoordinatorName(item.coordinatorName, session.name),
  );
  const assignment = pickActiveAssignment(assignments);
  const event = assignment ? state.events.find((item) => item.id === assignment.eventId) : undefined;
  const activeDraft = event?.floorPlanDrafts?.find((draft) => draft.eventId === event?.id && draft.isActive);
  const [busy, setBusy] = useState(false);
  const [roleView, setRoleView] = useState<PrismCoordinatorRoleView | null>(null);
  const [roleViewLoading, setRoleViewLoading] = useState(false);
  const [roleViewError, setRoleViewError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("coord-home");

  useEffect(() => {
    if (!event?.id) {
      setRoleView(null);
      setRoleViewLoading(false);
      setRoleViewError(null);
      return;
    }
    let alive = true;
    setRoleViewLoading(true);
    setRoleViewError(null);
    loadCoordinatorRoleView(session, event.id)
      .then((next) => { if (alive) setRoleView(next); })
      .catch((err) => {
        if (!alive) return;
        setRoleView(null);
        setRoleViewError(err instanceof Error ? err.message : "Unable to load role-safe event data.");
      })
      .finally(() => { if (alive) setRoleViewLoading(false); });
    return () => { alive = false; };
  }, [event?.id, session.email, session.name]);

  async function ack() {
    if (!event || !assignment) return;
    setBusy(true);
    try {
      setRoleViewLoading(true);
      setRoleViewError(null);
      try {
        setRoleView(
          await acknowledgeAndRefreshRoleView({
            session,
            eventId: event.id,
            assignmentId: assignment.id,
          }),
        );
      } catch (err) {
        setRoleView(null);
        setRoleViewError(err instanceof Error ? err.message : "Unable to refresh role-safe event data.");
      } finally {
        setRoleViewLoading(false);
      }
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  const roleName = assignment?.role ?? label(session.role);
  const attendanceStatus = assignment?.attendanceStatus ?? assignment?.status ?? "pending";
  const registrationRole = isRegistrationCoordinatorRole(assignment?.role);
  const roleDataStatus = roleViewLoading ? "loading" : roleViewError ? "unavailable" : roleView ? "ready" : "pending";

  const taskActionDescription = roleViewLoading
    ? "Loading assigned role tasks."
    : roleViewError
      ? "Role task data is unavailable."
      : `${roleView?.tasks.length ?? 0} assigned task(s) for this role.`;

  const issueActionDescription = roleViewLoading
    ? "Loading visible urgent issues."
    : roleViewError
      ? "Urgent issue data is unavailable."
      : `${roleView?.urgentIssues.length ?? 0} visible issue(s). Escalations route to PMCM only.`;

  const navItems = [
    { id: "coord-home", icon: Home, label: "Home", section: "Coordinator" },
    { id: "coord-queue", icon: ClipboardList, label: "Role queue", section: "Coordinator", badge: roleView?.tasks.length || undefined },
    { id: "coord-issues", icon: BellRing, label: "Urgent issues", section: "Coordinator", badge: roleView?.urgentIssues.filter((i) => i.status !== "resolved").length || undefined },
    { id: "coord-attendance", icon: UserCheck, label: "Attendance", section: "Coordinator" },
    { id: "coord-timeline", icon: CalendarClock, label: "Timeline", section: "Coordinator" },
  ];

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  function handleNav(id: string) {
    setActiveSection(id);
    if (id === "coord-queue") scrollTo("coordinator-role-queue");
    if (id === "coord-issues") scrollTo("coordinator-live-data");
    if (id === "coord-attendance") scrollTo("coordinator-attendance");
    if (id === "coord-timeline") scrollTo("coordinator-timeline");
  }

  return (
    <PrismDashboardShell
      productLabel="P.R.I.S.M"
      roleLabel="Coordinator Portal"
      eyebrow="Event operations"
      title={event?.eventName ?? "No assigned event"}
      description={
        event
          ? `${event.clientName} — ${event.eventDate}. Role: ${roleName}`
          : "No assignment matched to this coordinator account."
      }
      activeItemId={activeSection}
      navItems={navItems}
      onNavSelect={handleNav}
      user={{
        name: session.name,
        detail: label(session.role),
        initials: session.name.slice(0, 2).toUpperCase(),
      }}
      onSignOut={onSignOut}
      searchPlaceholder="Search tasks and issues..."
    >
      <div className="space-y-5">
        {/* Greeting banner */}
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-(--prism-signal) to-[#8b0f48] px-6 py-7 text-white shadow-lg">
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white/70">P.R.I.S.M Coordinator Portal</p>
              <h1 className="mt-1 text-2xl font-black leading-tight">
                {event ? event.eventName : "No assigned event"}
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/80">
                {event
                  ? `${event.clientName} — ${event.eventDate}. Your view is limited to role-safe tasks, issues, and attendance signals.`
                  : "No assignment is matched to this coordinator account. Contact PMCM to confirm your event assignment."}
              </p>
              {assignment?.status !== "acknowledged" && assignment && (
                <Button
                  className="mt-5 rounded-lg bg-white font-bold text-(--prism-signal) hover:bg-white/90"
                  onClick={ack}
                  disabled={busy}
                >
                  <BadgeCheck className="size-4" /> Acknowledge role
                </Button>
              )}
              {assignment?.status === "acknowledged" && (
                <div className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-bold backdrop-blur-sm">
                  <CheckCircle2 className="size-4" /> Role acknowledged
                </div>
              )}
            </div>
            {assignment && (
              <div className="hidden shrink-0 flex-col items-center rounded-xl bg-white/15 px-5 py-4 text-center backdrop-blur-sm sm:flex">
                <Avatar className="mb-2 size-10 border-2 border-white/40">
                  <AvatarFallback className="bg-white/20 text-sm font-black text-white">
                    {session.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-black leading-tight">{roleName}</span>
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-white/70">
                  {label(attendanceStatus)}
                </span>
              </div>
            )}
          </div>
          <span className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-white/6" />
          <span className="pointer-events-none absolute -bottom-16 -right-8 size-64 rounded-full bg-white/4" />
        </div>

        {/* Info boundary notice */}
        <CCard>
          <CCardBody className="flex items-start gap-3">
            <LockKeyhole className="mt-0.5 size-5 shrink-0 text-(--prism-amber)" />
            <div>
              <p className="text-sm font-bold text-foreground">Coordinator information boundary</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                This portal excludes billing, audit trail, internal cost data, and private supplier review notes.
                Registration details are limited to the assigned registration role only.
              </p>
            </div>
          </CCardBody>
        </CCard>

        {/* Status summary */}
        <StatusSummary
          items={[
            {
              id: "floorplan",
              label: "Official floorplan",
              value: activeDraft ? "Ready" : "Pending",
              icon: LayoutGrid,
              status: activeDraft?.status ?? "pending",
            },
            {
              id: "suppliers",
              label: "Supplier setup",
              value: roleViewLoading ? "Loading" : roleView?.supplierStatuses.length ?? 0,
              icon: Truck,
              status: roleDataStatus,
              detail: "Readiness signals only.",
            },
            {
              id: "attendance",
              label: "Guest attendance",
              value: roleViewLoading ? "—" : roleView?.guestAttendanceCount ?? 0,
              icon: UsersRound,
              status: roleDataStatus,
              detail: registrationRole ? "Registration role: check-in context visible." : "Aggregate count only.",
            },
            {
              id: "assignment",
              label: "Your attendance",
              value: label(attendanceStatus),
              icon: ShieldCheck,
              status: attendanceStatus,
              detail: assignment ? label(assignment.status) : "No active assignment.",
            },
          ]}
        />

        {/* Event-day action group */}
        <CCard>
          <CCardHeader>
            <SectionAccent>Event-day actions</SectionAccent>
            <h2 className="mt-1 text-base font-bold text-foreground">
              {assignment?.role ?? "Coordinator"} run controls
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Large actions stay readable on phones during ingress, supplier calls, and issue escalation.
            </p>
          </CCardHeader>
          <CCardBody>
            <EventDayActionGroup
              actions={[
                {
                  id: "acknowledge",
                  label: assignment?.status === "acknowledged" ? "Role acknowledged" : "Acknowledge role",
                  description:
                    assignment?.status === "acknowledged"
                      ? "PMCM has your definite yes."
                      : "Confirm this assignment before event day.",
                  icon: BadgeCheck,
                  status: assignment?.status ?? "pending",
                  active: assignment?.status === "acknowledged",
                  disabled: busy || !assignment || assignment.status === "acknowledged",
                  onSelect: ack,
                },
                {
                  id: "queue",
                  label: "Run role queue",
                  description: taskActionDescription,
                  icon: ClipboardList,
                  status:
                    roleViewLoading
                      ? "loading"
                      : roleViewError
                        ? "unavailable"
                        : (roleView?.tasks.length ?? 0) > 0
                          ? "open"
                          : "clear",
                  onSelect: () => scrollTo("coordinator-role-queue"),
                },
                {
                  id: "issues",
                  label: "Review urgent issues",
                  description: issueActionDescription,
                  icon: BellRing,
                  status:
                    roleViewLoading
                      ? "loading"
                      : roleViewError
                        ? "unavailable"
                        : (roleView?.urgentIssues.length ?? 0) > 0
                          ? "open"
                          : "clear",
                  onSelect: () => scrollTo("coordinator-live-data"),
                },
                {
                  id: "attendance",
                  label: "Attendance state",
                  description: assignment
                    ? `Current attendance is ${label(attendanceStatus)}.`
                    : "No assignment state available.",
                  icon: UserCheck,
                  status: attendanceStatus,
                },
              ]}
            />
          </CCardBody>
        </CCard>

        {/* Timeline + acknowledgment */}
        <div className="grid gap-4 xl:grid-cols-2">
          <CCard>
            <CCardHeader>
              <div className="flex items-center gap-2">
                <CalendarClock className="size-4 text-(--prism-signal)" />
                <h3 className="text-sm font-bold text-foreground">Critical timeline</h3>
              </div>
            </CCardHeader>
            <CCardBody id="coordinator-timeline" className="scroll-mt-24 space-y-3">
              {[
                ["02:00", "Production ingress opens", "Technicals and staging team report to dock."],
                ["05:30", "Registration desk setup", "QR readers and fallback list checked."],
                ["08:00", "Client walkthrough", "Floor Director escorts PMCM and client."],
                ["09:00", "Doors open", "Guest arrival and welcome desk live."],
              ].map(([time, title, detail]) => (
                <div key={time} className="flex items-start gap-4 rounded-xl bg-muted/40 p-3.5">
                  <span className="w-12 shrink-0 text-sm font-black tabular-nums text-foreground">{time}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">{title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{detail}</p>
                  </div>
                </div>
              ))}
            </CCardBody>
          </CCard>

          <CCard>
            <CCardHeader>
              <div className="flex items-center gap-2">
                <BadgeCheck className="size-4 text-(--prism-signal)" />
                <h3 className="text-sm font-bold text-foreground">Role badge</h3>
              </div>
            </CCardHeader>
            <CCardBody id="coordinator-attendance" className="scroll-mt-24">
              {assignment ? (
                <div>
                  <div className="rounded-xl bg-muted/50 p-5 text-center">
                    <p className="text-xs font-bold uppercase tracking-widest text-(--prism-signal)">Assigned role</p>
                    <p className="mt-2 text-2xl font-black text-foreground">{roleName}</p>
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      <Badge
                        variant="outline"
                        className="rounded-full border-(--prism-success)/25 bg-(--prism-success)/8 px-3 py-1 text-(--prism-success)"
                      >
                        Role-safe view
                      </Badge>
                      <Badge variant="outline" className="rounded-full px-3 py-1">
                        {label(attendanceStatus)}
                      </Badge>
                    </div>
                  </div>
                  {assignment.status !== "acknowledged" && (
                    <Button
                      disabled={busy}
                      onClick={ack}
                      className="mt-4 w-full rounded-xl font-bold"
                    >
                      <CheckCircle2 className="size-4" /> Acknowledge role
                    </Button>
                  )}
                  {assignment.status === "acknowledged" && (
                    <p className="mt-4 text-center text-sm font-semibold text-(--prism-success)">
                      PMCM has your definite yes.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No coordinator assignment is available yet.</p>
              )}
            </CCardBody>
          </CCard>
        </div>

        {/* Role-safe data states */}
        {roleViewLoading && (
          <CCard>
            <CCardBody className="flex items-center gap-3">
              <ShieldCheck className="size-5 shrink-0 text-(--prism-signal)" />
              <div>
                <p className="text-sm font-bold text-foreground">Loading role-safe data</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Assignment-safe tasks, supplier signals, attendance counts, and urgent issues are loading.
                </p>
              </div>
            </CCardBody>
          </CCard>
        )}

        {roleViewError && !roleViewLoading && (
          <CCard>
            <CCardBody className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-(--prism-amber)" />
              <div>
                <p className="text-sm font-bold text-foreground">Role-safe data unavailable</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {roleViewError}. Refresh the coordinator portal or ask PMCM to confirm this assignment.
                </p>
              </div>
            </CCardBody>
          </CCard>
        )}

        {roleView && !roleViewLoading && !roleViewError && (
          <div className="grid gap-4 xl:grid-cols-2">
            <CCard>
              <CCardHeader>
                <div className="flex items-center gap-2">
                  <ClipboardList className="size-4 text-(--prism-signal)" />
                  <h3 className="text-sm font-bold text-foreground">Role queue</h3>
                  {roleView.tasks.length > 0 && (
                    <span className="ml-auto rounded-full bg-(--prism-signal)/10 px-2 py-0.5 text-[10px] font-bold text-(--prism-signal)">
                      {roleView.tasks.length}
                    </span>
                  )}
                </div>
              </CCardHeader>
              <CCardBody id="coordinator-role-queue" className="scroll-mt-24">
                <CompactRecordList
                  emptyText="No event-day tasks assigned to this role yet."
                  items={roleView.tasks.map((task) => ({
                    id: task.id,
                    title: task.title,
                    description: `${task.assignedRole} — ${task.notes}`,
                    meta: task.slaDueAt
                      ? `Due ${new Date(task.slaDueAt).toLocaleString("en-PH")}`
                      : undefined,
                    status: task.status,
                    icon: ClipboardList,
                  }))}
                />
              </CCardBody>
            </CCard>

            <CCard>
              <CCardHeader>
                <div className="flex items-center gap-2">
                  <Radio className="size-4 text-(--prism-signal)" />
                  <h3 className="text-sm font-bold text-foreground">Role-safe live data</h3>
                </div>
              </CCardHeader>
              <CCardBody id="coordinator-live-data" className="scroll-mt-24 space-y-3">
                <div className="rounded-xl bg-muted/40 p-4">
                  <p className="text-sm font-bold text-foreground">Registration check-ins</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {registrationRole
                      ? `${roleView.guestAttendanceCount} checked in, including walk-ins flagged for PMCM review.`
                      : `${roleView.guestAttendanceCount} checked in. Guest-level records are hidden for this role.`}
                  </p>
                </div>
                <CompactRecordList
                  emptyText="No urgent issue assigned to this role."
                  items={roleView.urgentIssues.map((issue) => ({
                    id: issue.id,
                    title: issue.title,
                    description: `${label(issue.status)} — ${issue.ownerRole || "Unassigned"}`,
                    meta: issue.slaDueAt
                      ? `Due ${new Date(issue.slaDueAt).toLocaleString("en-PH")}`
                      : undefined,
                    status: issue.slaStatus ?? issue.status,
                    icon: Radio,
                  }))}
                />
              </CCardBody>
            </CCard>
          </div>
        )}
      </div>
    </PrismDashboardShell>
  );
}
