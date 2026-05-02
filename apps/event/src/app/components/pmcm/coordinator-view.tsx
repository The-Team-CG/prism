import { useEffect, useState } from "react";
import {
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  LayoutGrid,
  Radio,
  ShieldCheck,
  Truck,
  UserCheck,
} from "lucide-react";

import { mvpApi, type MvpCoordinatorRoleView, type MvpDemoState } from "@/lib/mvp-api";
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

export function CoordinatorView({
  session,
  state,
  onRefresh,
}: {
  session: PmcmEventSession;
  state: MvpDemoState;
  onRefresh: () => Promise<void>;
}) {
  const assignments = state.coordinatorAssignments.filter((item) => item.coordinatorName === session.name);
  const assignment = assignments[0] ?? state.coordinatorAssignments[0];
  const event = state.events.find((item) => item.id === assignment?.eventId) ?? state.events[0];
  const quotes = state.supplierQuotes.filter((item) => item.eventId === event?.id);
  const activeDraft = state.floorPlanDrafts.find((draft) => draft.eventId === event?.id && draft.isActive);
  const [busy, setBusy] = useState(false);
  const [roleView, setRoleView] = useState<MvpCoordinatorRoleView | null>(null);

  useEffect(() => {
    if (!event?.id) {
      setRoleView(null);
      return;
    }
    mvpApi.coordinatorRoleView(session, event.id).then(setRoleView).catch(() => setRoleView(null));
  }, [event?.id, session.email, session.name]);

  async function ack() {
    if (!event || !assignment) return;
    setBusy(true);
    try {
      await mvpApi.acknowledgeCoordinator(event.id, assignment.id);
      setRoleView(await mvpApi.coordinatorRoleView(session, event.id).catch(() => null));
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

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
          {["Live command", "Timeline", "Suppliers", "Acknowledgment"].map((item) => (
            <div key={item} className="rounded-md bg-white/7 px-3 py-2 text-sidebar-foreground/75">{item}</div>
          ))}
        </div>
      </aside>
      <div className="space-y-6">
        <RolePageHeader
          eyebrow="Live operations"
          title={event?.eventName ?? "No assigned event"}
          description={`${event?.clientName ?? "PMCM"} - ${event?.eventDate ?? "TBD"}. This coordinator view only exposes role-safe tasks, supplier readiness, attendance counts, and urgent issues.`}
          meta={[
            <Badge key="scope" variant="outline" className="rounded-full border-(--prism-success)/25 bg-(--prism-success)/8 px-3 py-1.5 text-(--prism-success)">
              Scoped
            </Badge>,
            assignment ? <Badge key="role" variant="outline" className="rounded-full px-3 py-1.5">{assignment.role}</Badge> : "No assignment",
            assignment ? label(assignment.status) : "Unassigned",
          ]}
          action={
            assignment ? (
              <div className="rounded-lg border border-border bg-secondary px-4 py-3 text-right">
                <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Role badge</p>
                <p className="mt-1 text-lg font-black text-foreground">{assignment.role}</p>
                <p className="text-xs capitalize text-muted-foreground">{label(assignment.attendanceStatus ?? assignment.status)}</p>
              </div>
            ) : null
          }
        />

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
                description: `${roleView?.tasks.length ?? 0} assigned task(s) for this role.`,
                icon: ClipboardList,
                status: (roleView?.tasks.length ?? 0) > 0 ? "open" : "clear",
              },
              {
                id: "issues",
                label: "Escalate urgent issue",
                description: `${roleView?.urgentIssues.length ?? 0} urgent issue(s) visible to this role.`,
                icon: Radio,
                status: (roleView?.urgentIssues.length ?? 0) > 0 ? "open" : "clear",
              },
            ]}
          />
        </section>

        <PrismStatusSummary
          columns="four"
          items={[
            { id: "floorplan", label: "Official floorplan", value: activeDraft ? "Ready" : "Pending", icon: LayoutGrid, status: activeDraft?.status ?? "pending" },
            { id: "suppliers", label: "Supplier signals", value: roleView?.supplierStatuses.length ?? quotes.length, icon: Truck, detail: "Only event-day readiness signals are shown." },
            { id: "attendance", label: "Guest attendance", value: roleView?.guestAttendanceCount ?? 0, icon: ShieldCheck, detail: "Includes walk-ins flagged for PMCM review." },
            { id: "assignment", label: "Assignment", value: assignment ? label(assignment.status) : "None", icon: UserCheck, status: assignment?.status ?? "pending" },
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

        {roleView && (
          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <Panel title="Role queue" icon={ClipboardList}>
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
              <div className="space-y-3">
                {roleView.guestCheckIns.length > 0 && (
                  <div className="rounded-md border border-border bg-background p-3 text-sm">
                    <p className="font-black">Registration check-ins</p>
                    <p className="mt-1 text-muted-foreground">{roleView.guestAttendanceCount} checked in, including walk-ins flagged for PMCM review.</p>
                  </div>
                )}
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
