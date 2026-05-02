import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  LayoutGrid,
  LockKeyhole,
  Radio,
  ShieldCheck,
  Truck,
  UserCheck,
  UsersRound,
} from "lucide-react";

import { mvpApi, type MvpCoordinatorRoleView, type MvpCoordinatorWorkspace } from "@/lib/mvp-api";
import {
  PrismCompactRecordList,
  PrismEventDayActionGroup,
  PrismStatusSummary,
  RolePageHeader,
} from "@prism/ui";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Separator } from "@/app/components/ui/separator";
import { label } from "./helpers";
import { Panel } from "./primitives";
import type { PmcmEventSession } from "./types";

function sameText(left?: string | null, right?: string | null) {
  return (left ?? "").trim().toLowerCase() === (right ?? "").trim().toLowerCase();
}

function isRegistrationRole(role?: string | null) {
  return Boolean(role && role.toLowerCase().includes("registration"));
}

export function CoordinatorView({
  session,
  state,
  onRefresh,
}: {
  session: PmcmEventSession;
  state: MvpCoordinatorWorkspace;
  onRefresh: () => Promise<void>;
}) {
  const assignments = state.assignments.filter((item) => sameText(item.coordinatorName, session.name));
  const assignment = assignments.find((item) => item.attendanceStatus !== "replaced" && item.status !== "replaced") ?? assignments[0];
  const event = assignment ? state.events.find((item) => item.id === assignment.eventId) : undefined;
  const activeDraft = event?.floorPlanDrafts?.find((draft) => draft.eventId === event?.id && draft.isActive);
  const [busy, setBusy] = useState(false);
  const [roleView, setRoleView] = useState<MvpCoordinatorRoleView | null>(null);
  const [roleViewLoading, setRoleViewLoading] = useState(false);
  const [roleViewError, setRoleViewError] = useState<string | null>(null);

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
    mvpApi.coordinatorRoleView(session, event.id)
      .then((next) => {
        if (alive) setRoleView(next);
      })
      .catch((err) => {
        if (!alive) return;
        setRoleView(null);
        setRoleViewError(err instanceof Error ? err.message : "Unable to load role-safe event data.");
      })
      .finally(() => {
        if (alive) setRoleViewLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [event?.id, session.email, session.name]);

  async function ack() {
    if (!event || !assignment) return;
    setBusy(true);
    try {
      await mvpApi.acknowledgeCoordinator(event.id, assignment.id);
      setRoleViewLoading(true);
      setRoleViewError(null);
      try {
        setRoleView(await mvpApi.coordinatorRoleView(session, event.id));
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
  const registrationRole = isRegistrationRole(assignment?.role);
  const scrollToRoleQueue = () => document.getElementById("coordinator-role-queue")?.scrollIntoView({ behavior: "smooth" });
  const scrollToLiveData = () => document.getElementById("coordinator-live-data")?.scrollIntoView({ behavior: "smooth" });
  const taskActionDescription = roleViewLoading
    ? "Loading assigned role tasks."
    : roleViewError
      ? "Role task data is unavailable."
      : `${roleView?.tasks.length ?? 0} assigned task(s) for this role.`;
  const issueActionDescription = roleViewLoading
    ? "Loading visible urgent issues."
    : roleViewError
      ? "Urgent issue data is unavailable."
      : `${roleView?.urgentIssues.length ?? 0} visible issue(s). Escalations route to PMCM/operator context only.`;
  const roleDataStatus = roleViewLoading ? "loading" : roleViewError ? "unavailable" : roleView ? "ready" : "pending";

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="rounded-lg bg-sidebar p-5 text-sidebar-foreground">
        <div className="flex items-center gap-3">
          <Avatar className="size-10 border border-(--prism-amber)/30">
            <AvatarFallback className="bg-card text-xs font-black text-foreground">{session.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-black">{session.name}</p>
            <p className="truncate text-xs text-sidebar-foreground/70">{label(session.role)}</p>
          </div>
        </div>
        <Separator className="my-5 bg-white/10" />
        <div className="flex flex-col gap-2 text-sm font-bold">
          {["Role badge visible", "Live queue only", "No finance or audit", "No private reviews"].map((item) => (
            <div key={item} className="rounded-md bg-white/7 px-3 py-2 text-sidebar-foreground/75">{item}</div>
          ))}
        </div>
      </aside>
      <div className="space-y-6">
        <RolePageHeader
          eyebrow="Live operations"
          title={event?.eventName ?? "No assigned event"}
          description={
            event
              ? `${event.clientName} - ${event.eventDate}. This coordinator view only exposes role-safe tasks, supplier readiness, attendance counts, and urgent issues.`
              : "No assignment is matched to this coordinator account, so event-day data is withheld."
          }
          meta={[
            <Badge key="scope" variant="outline" className="rounded-full border-(--prism-success)/25 bg-(--prism-success)/8 px-3 py-1.5 text-(--prism-success)">
              Role-safe
            </Badge>,
            assignment ? <Badge key="role" variant="outline" className="rounded-full px-3 py-1.5">{assignment.role}</Badge> : "No assignment",
            assignment ? `Attendance ${label(attendanceStatus)}` : "Unassigned",
          ]}
          action={
            assignment ? (
              <div className="rounded-lg border border-border bg-secondary px-4 py-3 text-right">
                <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Role badge</p>
                <p className="mt-1 text-lg font-black text-foreground">{roleName}</p>
                <p className="text-xs capitalize text-muted-foreground">Attendance: {label(attendanceStatus)}</p>
              </div>
            ) : null
          }
        />

        <section className="flex items-start gap-3 rounded-lg border border-(--prism-amber)/20 bg-(--prism-amber)/8 p-4 text-sm leading-6 text-(--prism-amber)">
          <LockKeyhole className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-black text-foreground">Coordinator information boundary</p>
            <p className="mt-0.5">
              This role view excludes billing, audit trail rows, internal cost data, and private supplier review notes. Registration details are limited to the assigned registration role.
            </p>
          </div>
        </section>

        <section className="rounded-lg border border-primary/12 bg-card p-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-(--prism-amber)">Event-day actions</p>
              <h2 className="mt-1 text-lg font-black text-foreground">{assignment?.role ?? "Coordinator"} run controls</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Large actions stay readable on phones during ingress, supplier calls, and issue escalation.
              </p>
            </div>
          </div>
          <PrismEventDayActionGroup
            actions={[
              {
                id: "acknowledge",
                label: assignment?.status === "acknowledged" ? "Role acknowledged" : "Acknowledge role",
                description: assignment?.status === "acknowledged" ? "PMCM has your definite yes." : "Confirm this assignment before event day.",
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
                status: roleViewLoading ? "loading" : roleViewError ? "unavailable" : (roleView?.tasks.length ?? 0) > 0 ? "open" : "clear",
                onSelect: scrollToRoleQueue,
              },
              {
                id: "issues",
                label: "Review urgent issues",
                description: issueActionDescription,
                icon: BellRing,
                status: roleViewLoading ? "loading" : roleViewError ? "unavailable" : (roleView?.urgentIssues.length ?? 0) > 0 ? "open" : "clear",
                onSelect: scrollToLiveData,
              },
              {
                id: "attendance",
                label: "Attendance state",
                description: assignment ? `Current coordinator attendance is ${label(attendanceStatus)}.` : "No assignment state available.",
                icon: UserCheck,
                status: attendanceStatus,
              },
            ]}
          />
        </section>

        <PrismStatusSummary
          columns="four"
          items={[
            { id: "floorplan", label: "Official floorplan", value: activeDraft ? "Ready" : "Pending", icon: LayoutGrid, status: activeDraft?.status ?? "pending" },
            { id: "suppliers", label: "Supplier setup", value: roleViewLoading ? "Loading" : roleView?.supplierStatuses.length ?? 0, icon: Truck, status: roleDataStatus, detail: "Readiness signals only. Quote amounts and private reviews stay hidden." },
            {
              id: "attendance",
              label: "Guest attendance",
              value: roleViewLoading ? "Loading" : roleView?.guestAttendanceCount ?? 0,
              icon: UsersRound,
              status: roleDataStatus,
              detail: registrationRole ? "Registration role can review check-in context." : "Aggregate count only; guest names stay hidden.",
            },
            { id: "assignment", label: "Coordinator attendance", value: label(attendanceStatus), icon: ShieldCheck, status: attendanceStatus, detail: assignment ? label(assignment.status) : "No active assignment." },
          ]}
        />

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Panel title="Critical timeline" icon={CalendarClock}>
            <div className="space-y-3">
              {[
                ["02:00", "Production ingress opens", "Technicals and staging team report to dock."],
                ["05:30", "Registration desk setup", "QR readers and fallback list checked."],
                ["08:00", "Client walkthrough", "Floor Director escorts PMCM and client."],
                ["09:00", "Doors open", "Guest arrival and welcome desk live."],
              ].map(([time, title, detail]) => (
                <div key={time} className="grid grid-cols-[4.5rem_1fr] gap-3 rounded-md bg-background p-3">
                  <p className="font-black tabular-nums text-foreground">{time}</p>
                  <div>
                    <p className="font-black">{title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Acknowledgment" icon={BadgeCheck}>
            {assignment ? (
              <div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Confirm the assignment so PMCM does not need to chase a definite yes through group chat.
                </p>
                <Button disabled={busy || assignment.status === "acknowledged"} onClick={ack} className="mt-4 h-10 rounded-md font-black">
                  <CheckCircle2 className="size-4" /> {assignment.status === "acknowledged" ? "Acknowledged" : "Acknowledge role"}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No coordinator assignment is available yet.</p>
            )}
          </Panel>
        </div>

        {roleViewLoading && (
          <Panel title="Loading role-safe data" icon={ShieldCheck}>
            <p className="text-sm leading-6 text-muted-foreground">
              Assignment-safe tasks, supplier readiness signals, attendance counts, and urgent issues are loading for this coordinator role.
            </p>
          </Panel>
        )}

        {roleViewError && (
          <Panel title="Role-safe data unavailable" icon={AlertTriangle}>
            <p className="text-sm leading-6 text-muted-foreground">
              {roleViewError}. Refresh the coordinator command or ask PMCM to confirm this assignment.
            </p>
          </Panel>
        )}

        {roleView && !roleViewLoading && !roleViewError && (
          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <Panel title="Role queue" icon={ClipboardList}>
              <div id="coordinator-role-queue" className="scroll-mt-24" />
              <PrismCompactRecordList
                emptyText="No event-day tasks assigned to this role yet."
                items={roleView.tasks.map((task) => ({
                  id: task.id,
                  title: task.title,
                  description: `${task.assignedRole} - ${task.notes}`,
                  meta: task.slaDueAt ? `Due ${new Date(task.slaDueAt).toLocaleString("en-PH")}` : undefined,
                  status: task.status,
                  icon: ClipboardList,
                }))}
              />
            </Panel>
            <Panel title="Role-safe live data" icon={ShieldCheck}>
              <div id="coordinator-live-data" className="scroll-mt-24" />
              <div className="space-y-3">
                <div className="rounded-md border border-border bg-background p-3 text-sm">
                  <p className="font-black">Registration check-ins</p>
                  <p className="mt-1 text-muted-foreground">
                    {registrationRole
                      ? `${roleView.guestAttendanceCount} checked in, including walk-ins flagged for PMCM review.`
                      : `${roleView.guestAttendanceCount} checked in. Guest-level check-in records are hidden for this role.`}
                  </p>
                </div>
                <PrismCompactRecordList
                  emptyText="No urgent issue assigned to this role."
                  items={roleView.urgentIssues.map((issue) => ({
                    id: issue.id,
                    title: issue.title,
                    description: `${label(issue.status)} - ${issue.ownerRole || "Unassigned"}`,
                    meta: issue.slaDueAt ? `Due ${new Date(issue.slaDueAt).toLocaleString("en-PH")}` : undefined,
                    status: issue.slaStatus ?? issue.status,
                    icon: Radio,
                  }))}
                />
              </div>
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}
