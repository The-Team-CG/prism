import { useEffect, useState } from "react";
import {
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  LayoutGrid,
  MapPinned,
  Radio,
  ShieldCheck,
  Truck,
  UserCheck,
} from "lucide-react";

import { mvpApi, type MvpCoordinatorRoleView, type MvpDemoState } from "@/lib/mvp-api";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Separator } from "@/app/components/ui/separator";
import { label } from "./helpers";
import { Metric, Panel } from "./primitives";
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
        <section className="rounded-lg border border-primary/12 bg-card p-5">
          <Badge variant="outline" className="rounded-full border-(--prism-amber)/35 bg-accent px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-(--prism-amber)">
            <Radio className="size-4" /> Live operations
          </Badge>
          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl font-black leading-none">{event?.eventName ?? "No assigned event"}</h1>
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <MapPinned className="size-4" /> {event?.clientName ?? "PMCM"} - {event?.eventDate ?? "TBD"}
              </p>
            </div>
            {assignment && (
              <div className="rounded-lg border border-primary/12 bg-secondary p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Role badge</p>
                <p className="mt-1 text-xl font-black text-foreground">{assignment.role}</p>
                <p className="mt-1 text-sm capitalize text-muted-foreground">{label(assignment.status)}</p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-primary/12 bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-(--prism-amber)">Role-safe workspace</p>
              <h2 className="mt-1 text-lg font-black text-foreground">{assignment?.role ?? "Coordinator"} event-day actions</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                This view keeps the coordinator focused on assigned tasks, supplier signals, attendance counts, and urgent issues. Finance, private supplier reviews, and audit logs stay PMCM-only.
              </p>
            </div>
            <Badge variant="outline" className="rounded-full border-(--prism-success)/25 bg-(--prism-success)/8 px-3 py-1.5 text-(--prism-success)">
              Scoped
            </Badge>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {[
              { label: "Acknowledge", detail: assignment?.status === "acknowledged" ? "Role confirmed" : "Confirm definite yes", icon: BadgeCheck },
              { label: "Run queue", detail: `${roleView?.tasks.length ?? 0} role task(s)`, icon: ClipboardList },
              { label: "Escalate", detail: `${roleView?.urgentIssues.length ?? 0} urgent issue(s)`, icon: Radio },
            ].map(({ label: itemLabel, detail, icon: Icon }) => (
              <div key={itemLabel} className="rounded-md border border-border bg-secondary/45 p-3">
                <Icon className="size-4 text-(--prism-amber)" />
                <p className="mt-2 text-sm font-black text-foreground">{itemLabel}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="Official floorplan" value={activeDraft ? "Ready" : "Pending"} icon={LayoutGrid} />
          <Metric label="Supplier signals" value={roleView?.supplierStatuses.length ?? quotes.length} icon={Truck} />
          <Metric label="Guest attendance" value={roleView?.guestAttendanceCount ?? 0} icon={ShieldCheck} />
          <Metric label="Assignment" value={assignment ? label(assignment.status) : "None"} icon={UserCheck} />
        </div>

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
              <div className="space-y-3">
                {roleView.tasks.length === 0 && <p className="text-sm text-muted-foreground">No event-day tasks assigned to this role yet.</p>}
                {roleView.tasks.map((task) => (
                  <div key={task.id} className="rounded-md border border-border bg-background p-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-black">{task.title}</p>
                      <span className="rounded-full bg-muted px-2 py-1 text-xs font-black capitalize text-muted-foreground">{label(task.status)}</span>
                    </div>
                    <p className="mt-1 text-muted-foreground">{task.assignedRole}</p>
                    <LiveOpsBadges slaStatus={task.slaStatus} escalationLevel={task.escalationLevel} slaDueAt={task.slaDueAt} />
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Role-safe live data" icon={ShieldCheck}>
              <div className="space-y-3">
                {roleView.guestCheckIns.length > 0 && (
                  <div className="rounded-md border border-border bg-background p-3 text-sm">
                    <p className="font-black">Registration check-ins</p>
                    <p className="mt-1 text-muted-foreground">{roleView.guestAttendanceCount} checked in, including walk-ins flagged for PMCM review.</p>
                  </div>
                )}
                {roleView.urgentIssues.length === 0 && <p className="text-sm text-muted-foreground">No urgent issue assigned to this role.</p>}
                {roleView.urgentIssues.map((issue) => (
                  <div key={issue.id} className="rounded-md border border-border bg-background p-3 text-sm">
                    <p className="font-black">{issue.title}</p>
                    <p className="mt-1 text-muted-foreground">{label(issue.status)} - {issue.ownerRole || "Unassigned"}</p>
                    <LiveOpsBadges slaStatus={issue.slaStatus} escalationLevel={issue.escalationLevel} slaDueAt={issue.slaDueAt} />
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}

function LiveOpsBadges({
  slaStatus,
  escalationLevel,
  slaDueAt,
}: {
  slaStatus?: string | null;
  escalationLevel?: string | null;
  slaDueAt?: string | null;
}) {
  const urgent = slaStatus === "overdue" || escalationLevel === "critical" || escalationLevel === "pmcm";
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span className={`rounded-full px-2 py-1 font-black capitalize ${urgent ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
        {label(slaStatus ?? "on_track")}
      </span>
      {escalationLevel && escalationLevel !== "none" && (
        <span className="rounded-full bg-amber-50 px-2 py-1 font-black capitalize text-amber-800">{label(escalationLevel)}</span>
      )}
      {slaDueAt && <span>Due {new Date(slaDueAt).toLocaleString("en-PH")}</span>}
    </div>
  );
}
