"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, CircleCheck, ClipboardList, FileText, Gamepad2, MessageSquare, Navigation, Phone, Radio } from "lucide-react";
import type { PrismCoordinatorAssignment, PrismCoordinatorRoleView, PrismEvent } from "@prism/types";
import { prismCalendarDateKey } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { formatPortalDate, formatPortalTime } from "@prism/ui/format-date";
import { PrismEmptyLine, PrismSection, PrismStatRow } from "@prism/ui/page-blocks";
import { cn } from "@/app/components/ui/utils";
import { pmcmSupportContactFromEnvironment } from "@/lib/portal-urls";
import { CoordinatorRoleBriefCard } from "@/features/coordinators/role-briefs/views/coordinator-role-brief-card";
import { eventCountdown, eventPhase, formatCountdown, groupTasks, isOpenTask, issueTone, openIssues, quickAttendanceMode, runSheetNowAndNext, tasksSummary, type EventPhase } from "../../model/coordinator-shift";
import { coordinatorAttendanceRecordLine } from "../../model/coordinator-view-copy";
import { canCoordinatorUpdateTask, recordedAttendanceLabel } from "../../model/coordinators-desk-rules";
import { canCheckSuppliers, CoordinatorSupplierChecks, CoordinatorTaskItem, type CoordinatorOperatorActionsModel, type CoordinatorTaskActionsModel } from "./coordinator-operator-sections";
import { CoordinatorAttendanceControl, CoordinatorBriefing, CoordinatorRoleError, CoordinatorRoleLoading, type CoordinatorAttendanceFormModel } from "./coordinator-role-sections";
import { CoordinatorAssignmentActions } from "./coordinator-view-sections";
import { NavRow, RowGroup } from "./coordinator-blocks";

export type CoordinatorNowView = "tasks" | "issues" | "messages" | "run-sheet" | "games";

/** Seconds left on the running segment, counting down between refreshes. */
function useCountdown(secondsRemaining: number | undefined): number | undefined {
  const [left, setLeft] = useState(secondsRemaining);
  useEffect(() => {
    setLeft(secondsRemaining);
    if (secondsRemaining === undefined) return;
    const started = Date.now();
    const timer = window.setInterval(() => setLeft(Math.max(0, secondsRemaining - Math.floor((Date.now() - started) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, [secondsRemaining]);
  return left;
}

const INK_CARD = "rounded-2xl bg-ink px-4 py-4 text-ink-foreground sm:px-5";

type Segment = NonNullable<ReturnType<typeof runSheetNowAndNext>["next"]>;

function segmentLine(segment: Segment, lead: string): string {
  return `${lead} ${formatPortalTime(segment.plannedStartAt, "")} · ${segment.title}${segment.location ? ` · ${segment.location}` : ""}`;
}

/**
 * What the live card says. The top bar already names the event, so the card leads with the programme: what is on,
 * else what comes next, else why there is nothing to show yet.
 */
function liveCopy(event: PrismEvent, authored: boolean, now?: Segment, next?: Segment) {
  const today = `Today${event.venue ? ` · ${event.venue}` : ""}`;
  if (now) return { label: `On now${now.location ? ` · ${now.location}` : ""}`, title: now.title, footer: next ? segmentLine(next, "Next at") : "Last item on today's run sheet." };
  if (!authored) return { label: today, title: "Run sheet not published yet", footer: "PMCM's programme for the day shows here once it is out." };
  if (next) return { label: today, title: `Up next: ${next.title}`, footer: segmentLine(next, "Starts at") };
  return { label: today, title: "Programme finished", footer: "Everything on the run sheet is done." };
}

/** On the day: what is on now, for how long, and what follows. */
function LiveNow({ event, roleView, onNavigate }: { event: PrismEvent; roleView: PrismCoordinatorRoleView | null; onNavigate: (view: CoordinatorNowView) => void }) {
  const { now, next, secondsRemaining } = runSheetNowAndNext(roleView?.schedule, roleView?.timer);
  const left = useCountdown(now ? secondsRemaining : undefined);
  const authored = Boolean(roleView?.schedule?.authored);
  const copy = liveCopy(event, authored, now, next);
  return (
    <section aria-label="On now" className={INK_CARD}>
      <p className="text-xs text-ink-foreground/65">{copy.label}</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <h2 className="min-w-0 text-lg font-semibold leading-tight sm:text-xl">{copy.title}</h2>
        {left !== undefined ? <p className="shrink-0 text-3xl font-bold leading-none tabular-nums" aria-label={`${formatCountdown(left)} left`}>{formatCountdown(left)}</p> : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-ink-foreground/15 pt-2.5 text-sm text-ink-foreground/75">
        <p className="min-w-0">{copy.footer}</p>
        {authored ? <button type="button" onClick={() => onNavigate("run-sheet")} className="-my-1 flex min-h-9 items-center gap-0.5 font-medium text-ink-foreground">Full run sheet<ChevronRight className="size-4" aria-hidden /></button> : null}
      </div>
    </section>
  );
}

/** "10 days to go", "Tomorrow", or that the event is over. */
function leadHeadline(event: PrismEvent, phase: Exclude<EventPhase, "day">): string {
  if (phase === "after") return "Finished";
  const countdown = eventCountdown(event.eventDate, prismCalendarDateKey());
  if (!countdown) return "Coming up";
  return countdown.value === "1" ? "Tomorrow" : `${countdown.value} ${countdown.label}`;
}

/**
 * Before the day: how long until it. After: that it is over. The top bar already names the event, so the card leads
 * with the time and keeps the date, venue and client under it.
 */
function EventCardLead({ event, phase }: { event: PrismEvent; phase: Exclude<EventPhase, "day"> }) {
  return (
    <section aria-label="Your event" className={INK_CARD}>
      <p className="text-xs text-ink-foreground/65">{phase === "before" ? "Your next event" : "Your event"}</p>
      <h2 className="mt-1 text-2xl font-semibold leading-tight tabular-nums">{leadHeadline(event, phase)}</h2>
      <p className="mt-3 border-t border-ink-foreground/15 pt-2.5 text-sm text-ink-foreground/80">
        {[phase === "after" ? `Held ${formatPortalDate(event.eventDate)}` : formatPortalDate(event.eventDate), event.venue, `Client: ${event.clientName}`].filter(Boolean).join(" · ")}
      </p>
    </section>
  );
}

function ArriveButton({ form, onMore }: { form: CoordinatorAttendanceFormModel; onMore: () => void }) {
  return (
    <div className="grid gap-1.5">
      <Button className="min-h-14 text-base font-semibold" disabled={form.busy} onClick={() => form.mark("present")}>I&apos;m here · mark present</Button>
      <button type="button" onClick={onMore} className="justify-self-center py-1 text-sm text-muted-foreground">Late or absent?</button>
      {form.error ? <p role="alert" className="text-sm text-danger">{form.error}</p> : null}
    </div>
  );
}

function RecordedArrival({ form, recorded, onChange }: { form: CoordinatorAttendanceFormModel; recorded: string; onChange: () => void }) {
  return (
    <p role="status" className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm">
      <CircleCheck className="size-4 shrink-0 text-success" aria-hidden />
      <span className="min-w-0 flex-1">{coordinatorAttendanceRecordLine(recorded, form.markedAt)}</span>
      {form.windowOpen && form.canMark ? <button type="button" onClick={onChange} className="font-semibold text-primary">Change</button> : null}
    </p>
  );
}

/** Arriving takes one tap. Late and Absent sit behind "Late or absent?", and Absent still asks before it is recorded. */
function QuickAttendance({ form }: { form: CoordinatorAttendanceFormModel }) {
  const [more, setMore] = useState(false);
  const recorded = recordedAttendanceLabel(form.status);
  const mode = quickAttendanceMode(form, Boolean(recorded), more);
  if (mode === "hidden") return null;
  if (mode === "one-tap") return <ArriveButton form={form} onMore={() => setMore(true)} />;
  if (mode === "recorded" && recorded) return <RecordedArrival form={form} recorded={recorded} onChange={() => setMore(true)} />;
  return (
    <PrismSection id="coordinator-attendance-title" title="Your attendance">
      <CoordinatorAttendanceControl attendanceForm={form} />
    </PrismSection>
  );
}

/** The one task to do next, with its action: in progress first, then the soonest due. Nothing shows when none is open. */
function NextTaskCard({ roleView, taskActions }: { roleView: PrismCoordinatorRoleView; taskActions: CoordinatorTaskActionsModel }) {
  const groups = groupTasks(roleView.tasks);
  const task = groups.in_progress[0] ?? groups.open[0] ?? groups.blocked[0];
  if (!task) return null;
  return (
    <section aria-label="Your next task" className="grid max-w-3xl gap-2 rounded-xl border border-border bg-card px-4 py-3.5 sm:px-5">
      <p className="text-xs font-medium text-muted-foreground">Your next task</p>
      <CoordinatorTaskItem task={task} taskActions={taskActions} canUpdate={canCoordinatorUpdateTask(task, roleView)} />
    </section>
  );
}

const CHEVRON = <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />;

/** Call time, attire, script and the venue with directions. */
function BriefBody({ roleView, event }: { roleView: PrismCoordinatorRoleView; event: PrismEvent }) {
  const venue = roleView.briefing?.venue || event.venue;
  return (
    <div className="grid gap-4">
      <CoordinatorRoleBriefCard eventId={event.id} />
      {venue ? (
        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue)}`} target="_blank" rel="noreferrer" className="flex w-fit items-center gap-1.5 text-sm font-medium text-primary">
          <Navigation className="size-4" aria-hidden />Directions to {venue}
        </a>
      ) : null}
      <CoordinatorBriefing roleView={roleView} />
    </div>
  );
}

/**
 * The day at a glance, as one list: tasks and issues each open their page, and the brief unfolds in place. One surface
 * instead of a card, a row and a fold each drawn differently.
 */
function YourDay({ roleView, event, showBrief, gamesEnabled, onNavigate }: { roleView: PrismCoordinatorRoleView; event: PrismEvent; showBrief: boolean; gamesEnabled: boolean; onNavigate: (view: CoordinatorNowView) => void }) {
  const [briefOpen, setBriefOpen] = useState(false);
  const issues = openIssues(roleView.urgentIssues);
  const urgent = issues.some((issue) => issueTone(issue) === "urgent");
  return (
    <RowGroup label="Your day">
      <NavRow icon={ClipboardList} title="Tasks" detail={tasksSummary(roleView.tasks)} trailing={CHEVRON} onClick={() => onNavigate("tasks")} />
      <NavRow
        icon={Radio}
        title="Issues"
        tone={urgent ? "urgent" : issues.length ? "attention" : "neutral"}
        detail={issues.length ? `${issues.length} open ${issues.length === 1 ? "issue" : "issues"} · ${issues[0].title}` : "No open issues"}
        trailing={CHEVRON}
        onClick={() => onNavigate("issues")}
      />
      {gamesEnabled ? <NavRow icon={Gamepad2} title="Games" trailing={CHEVRON} onClick={() => onNavigate("games")} /> : null}
      {showBrief ? (
        <>
          <NavRow icon={FileText} title="Your brief" detail="Call time, script and venue" trailing={<ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", briefOpen && "rotate-180")} aria-hidden />} onClick={() => setBriefOpen((open) => !open)} />
          {briefOpen ? <div className="px-4 py-4 sm:px-5"><BriefBody roleView={roleView} event={event} /></div> : null}
        </>
      ) : null}
    </RowGroup>
  );
}

/** Call PMCM when the deployment has a number, and message them either way. */
function PmcmContact({ onNavigate }: { onNavigate: (view: CoordinatorNowView) => void }) {
  const { phone } = pmcmSupportContactFromEnvironment();
  return (
    <div className={cn("grid max-w-3xl gap-2", phone && "grid-cols-2")}>
      {phone ? <Button asChild variant="outline" className="min-h-11"><a href={`tel:${phone.replace(/\s+/g, "")}`}><Phone className="size-4" aria-hidden />Call PMCM</a></Button> : null}
      <Button type="button" variant="outline" className="min-h-11" onClick={() => onNavigate("messages")}><MessageSquare className="size-4" aria-hidden />Message PMCM</Button>
    </div>
  );
}

/** After the day: how it went, from the coordinator's side. */
function DaySummary({ roleView, attendance }: { roleView: PrismCoordinatorRoleView; attendance: string }) {
  const tasks = roleView.tasks.filter((task) => task.status !== "cancelled");
  const done = tasks.filter((task) => task.status === "done").length;
  const resolved = roleView.urgentIssues.filter((issue) => issue.status === "resolved").length;
  return (
    <PrismStatRow
      label="How the day went"
      stats={[
        { label: "Your attendance", value: recordedAttendanceLabel(attendance) ?? "Not recorded" },
        { label: "Tasks done", value: `${done} of ${tasks.length}`, empty: tasks.length === 0 },
        { label: "Issues resolved", value: resolved, empty: roleView.urgentIssues.length === 0 },
      ]}
    />
  );
}

type NowPageProps = {
  event: PrismEvent;
  assignment?: PrismCoordinatorAssignment;
  busy: boolean;
  roleView: PrismCoordinatorRoleView | null;
  roleViewLoading: boolean;
  roleViewError: string | null;
  attendanceForm: CoordinatorAttendanceFormModel;
  taskActions: CoordinatorTaskActionsModel;
  operatorActions: CoordinatorOperatorActionsModel;
  onAcknowledge: () => void;
  onDecline: (reason?: string) => void;
  onWithdraw: () => void;
  /** The event's games module is switched on, so Now links to the Games page. */
  gamesEnabled: boolean;
  onNavigate: (view: CoordinatorNowView) => void;
};

function NowWork({ phase, event, roleView, props }: { phase: EventPhase; event: PrismEvent; roleView: PrismCoordinatorRoleView; props: NowPageProps }) {
  if (phase === "before") return <PrismSection id="coordinator-brief" title="Your brief" className="max-w-3xl"><BriefBody roleView={roleView} event={event} /></PrismSection>;
  return (
    <>
      {phase === "after" ? <DaySummary roleView={roleView} attendance={props.attendanceForm.status} /> : null}
      <NextTaskCard roleView={roleView} taskActions={props.taskActions} />
      <YourDay roleView={roleView} event={event} showBrief={phase === "day"} gamesEnabled={props.gamesEnabled} onNavigate={props.onNavigate} />
      {phase === "day" && canCheckSuppliers(roleView) ? <CoordinatorSupplierChecks roleView={roleView} actions={props.operatorActions} /> : null}
    </>
  );
}

/**
 * Now: the coordinator's home, shaped by where they are. Before the event it is preparation (confirm, brief, venue);
 * on the day it is live (what is on, one-tap arrival, the next task, issues, supplier check-ins); after, how it went.
 * PMCM is a tap away throughout.
 */
export function CoordinatorNowPage(props: NowPageProps) {
  const { event } = props;
  const phase = eventPhase(event.eventDate, prismCalendarDateKey());
  return (
    <div className="grid w-full max-w-3xl gap-4">
      {phase === "day" ? <LiveNow event={event} roleView={props.roleView} onNavigate={props.onNavigate} /> : <EventCardLead event={event} phase={phase} />}
      <AnswerPrompt props={props} />
      <QuickAttendance form={props.attendanceForm} />
      <NowData phase={phase} props={props} />
      <PmcmContact onNavigate={props.onNavigate} />
    </div>
  );
}

/** PMCM is waiting until the coordinator confirms or declines; nothing shows once they have answered. */
function AnswerPrompt({ props }: { props: NowPageProps }) {
  const { assignment, event } = props;
  if (!assignment) return <PrismEmptyLine>No assignment on this event.</PrismEmptyLine>;
  if (assignment.status === "acknowledged" || assignment.status === "declined") return null;
  return (
    <PrismSection id="coordinator-answer" title="PMCM is waiting for your answer" description={`${assignment.role} · ${formatPortalDate(event.eventDate)}`}>
      <CoordinatorAssignmentActions status={assignment.status} busy={props.busy} onAcknowledge={props.onAcknowledge} onDecline={props.onDecline} onWithdraw={props.onWithdraw} />
    </PrismSection>
  );
}

/** The event's own data once it loads: its error, the work, or a loading line. */
function NowData({ phase, props }: { phase: EventPhase; props: NowPageProps }) {
  if (props.roleViewError) return <CoordinatorRoleError message={props.roleViewError} />;
  if (props.roleView) return <NowWork phase={phase} event={props.event} roleView={props.roleView} props={props} />;
  return props.roleViewLoading ? <CoordinatorRoleLoading /> : null;
}
