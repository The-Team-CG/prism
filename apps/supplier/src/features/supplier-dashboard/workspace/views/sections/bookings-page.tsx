"use client";

import { type ReactNode, useState } from "react";
import { BadgeCheck, CheckCircle2, ChevronRight, Circle, FileText, LockKeyhole, PackageCheck, Truck } from "lucide-react";
import type { PrismAuthenticatedSession, PrismSupplierReadinessItem, PrismSupplierWorkflowWorkspace } from "@prism/types";
import { formatPortalDate, formatPortalDateTime } from "@prism/ui/format-date";
import { Button } from "@/app/components/ui/button";
import { EmptyState } from "@/app/components/ui/empty-state";
import { Input } from "@/app/components/ui/input";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { supplierNextStep } from "../../model/supplier-next-step";
import { EVENT_STATUS_ACTIONS, buildBookingSteps, canReportSupplierEventDayStatus, isEventStatusStepAllowed, statusLabel } from "../../model/supplier-workspace-rules";
import type { PrismSupplierQuoteRequest, PrismSupplierReadinessBoard } from "../../model/supplier-workspace-types";
import { useSupplierWorkTarget } from "../../view-models/use-supplier-work-target";
import { Card, CardBody } from "./shell-ui";

type PanelState = "current" | "done" | "locked";
type Contract = PrismSupplierWorkflowWorkspace["contracts"][number];
type Schedule = PrismSupplierWorkflowWorkspace["schedules"][number];
type CreativeTask = PrismSupplierWorkflowWorkspace["creativeTasks"][number];

type BookingHandlers = {
  onReadinessNoteChange: (id: string, v: string) => void;
  onStatusNoteChange: (id: string, v: string) => void;
  onConfirmAssignment: (req: PrismSupplierQuoteRequest) => void;
  onConfirmReadiness: (req: PrismSupplierQuoteRequest) => void;
  onSaveContract: (req: PrismSupplierQuoteRequest, file: File) => void;
  onUpdateStatus: (req: PrismSupplierQuoteRequest, status: string) => void;
  onAcknowledgeSchedule: (requestId: string, revision: number) => void;
  onRequestScheduleChange: (requestId: string, revision: number, reason: string) => void;
  onUpdateProgress: (taskId: string, note: string) => void;
  onSubmitCreativeTask: (requestId: string, taskId: string, note: string, file?: File) => void;
  onDownloadObject: (objectId: string) => void;
};

const ACTIVE_TASK_STATUSES = ["open", "in_progress", "changes_requested"];
const CONTRACT_ACTION_STATUSES = ["missing", "changes_requested", undefined];
const ASSIGNMENT_FIRST = "Confirm the assignment first.";

/** One booking step: the current step stays open, finished steps fold away, locked steps say why. */
function BookingStepPanel({ title, state, summary, children }: { title: string; state: PanelState; summary?: string; children?: ReactNode }) {
  const heading = (
    <span className="flex min-w-0 flex-1 items-start gap-2.5">
      {state === "done" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
        : state === "locked" ? <LockKeyhole className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          : <Circle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />}
      <span className="min-w-0">
        <span className={`block text-sm font-semibold ${state === "locked" ? "text-muted-foreground" : "text-foreground"}`}>{title}</span>
        {summary ? <span className="mt-0.5 block text-xs text-muted-foreground">{summary}</span> : null}
      </span>
    </span>
  );
  if (state === "locked" || !children) return <div className="rounded-lg border border-border px-4 py-3">{heading}</div>;
  return (
    <details open={state === "current"} className="group/step rounded-lg border border-border">
      <summary className="flex cursor-pointer list-none items-start gap-2 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
        {heading}
        <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open/step:rotate-90" aria-hidden="true" />
      </summary>
      <div className="border-t border-border px-4 py-4">{children}</div>
    </details>
  );
}

/** One scannable row per booking: the next step, which event, when, and how far preparation has got. */
function BookingSummary({ request, readiness }: { request: PrismSupplierQuoteRequest; readiness?: PrismSupplierReadinessItem }) {
  const title = readiness ? supplierNextStep(readiness, true).title : "Review booking preparation";
  const steps = buildBookingSteps(request);
  const done = steps.filter((step) => step.done).length;
  const when = readiness?.schedule?.ingressAt
    ? `Arrive ${formatPortalDateTime(readiness.schedule.ingressAt)}`
    : readiness?.eventDate
      ? `Event ${formatPortalDate(readiness.eventDate)}`
      : "Schedule not set yet";
  return (
    <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-5 [&::-webkit-details-marker]:hidden">
      <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden="true" />
      <span className="grid min-w-0 flex-1 gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-6">
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">{title}</span>
          <span className="block break-words text-sm text-muted-foreground">
            {request.category} · {readiness?.eventName || "Event details pending"}
          </span>
        </span>
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm sm:justify-end sm:text-right">
          <span className="text-muted-foreground">{when}</span>
          <span className={done === steps.length ? "font-medium text-success" : "text-foreground"}>{done} of {steps.length} steps done</span>
        </span>
      </span>
    </summary>
  );
}

function BookingProgress({ req }: { req: PrismSupplierQuoteRequest }) {
  return (
    <div className="grid grid-cols-2 gap-3 px-4 py-4 sm:grid-cols-4 sm:px-6">
      {buildBookingSteps(req).map((step) => (
        <div key={step.label} className="flex items-start gap-2">
          {step.done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
          <div className="min-w-0">
            <p className={`text-xs font-semibold ${step.done ? "text-success" : "text-muted-foreground"}`}>{step.label}</p>
            <p className="mt-0.5 text-3xs text-muted-foreground">{step.meta}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function AssignmentStep({ req, busy, onConfirmAssignment }: { req: PrismSupplierQuoteRequest; busy: string | null; onConfirmAssignment: BookingHandlers["onConfirmAssignment"] }) {
  const confirmed = req.assignmentStatus === "confirmed";
  return (
    <BookingStepPanel title="Confirm assignment" state={confirmed ? "done" : "current"} summary={confirmed ? `Confirmed ${buildBookingSteps(req)[0].meta}` : "Acknowledge that you accept this assignment from PMCM."}>
      {confirmed ? null : (
        <Button type="button" size="sm" disabled={busy === `${req.id}:assignment`} onClick={() => onConfirmAssignment(req)} className="rounded-md font-semibold">
          <CheckCircle2 className="size-4" /> Confirm assignment
        </Button>
      )}
    </BookingStepPanel>
  );
}

function ContractStep({ req, contracts, busy, onSaveContract, onDownloadObject }: { req: PrismSupplierQuoteRequest; contracts: Contract[]; busy: string | null } & Pick<BookingHandlers, "onSaveContract" | "onDownloadObject">) {
  const [file, setFile] = useState<File | null>(null);
  const assignmentConfirmed = req.assignmentStatus === "confirmed";
  const state: PanelState = !assignmentConfirmed ? "locked" : CONTRACT_ACTION_STATUSES.includes(req.contractReviewStatus) ? "current" : "done";
  return (
    <BookingStepPanel title="Signed contract" state={state} summary={assignmentConfirmed ? buildBookingSteps(req)[2].meta : ASSIGNMENT_FIRST}>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="grid gap-1.5 text-sm font-medium text-foreground">
          Signed contract file
          <Input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="h-11 rounded-md py-2" />
        </label>
        <Button type="button" size="sm" variant="outline" disabled={!file || busy === `${req.id}:contract`} onClick={() => { if (file) onSaveContract(req, file); }} className="h-11 rounded-md font-semibold">
          <FileText className="size-4" /> Upload contract
        </Button>
      </div>
      {contracts.map((contract) => (
        <div key={contract.id} className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs">
          <span className="truncate font-semibold">v{contract.version} · {contract.fileName}</span>
          <span>{statusLabel(contract.reviewStatus)}{contract.reviewReason ? ` · ${contract.reviewReason}` : ""}</span>
          <Button type="button" size="sm" variant="ghost" onClick={() => onDownloadObject(contract.storedObjectId)}>Download</Button>
        </div>
      ))}
    </BookingStepPanel>
  );
}

function ScheduleStep({ requestId, schedule, onAcknowledgeSchedule, onRequestScheduleChange }: { requestId: string; schedule: Schedule } & Pick<BookingHandlers, "onAcknowledgeSchedule" | "onRequestScheduleChange">) {
  const [reason, setReason] = useState("");
  const acknowledged = schedule.acknowledgedRevision === schedule.revision;
  return (
    <BookingStepPanel title={`Schedule · revision ${schedule.revision}`} state={acknowledged ? "done" : "current"} summary={acknowledged ? "You acknowledged this revision." : "Acknowledge these times or ask PMCM to change them."}>
      <p className="text-xs text-muted-foreground">Arrive {formatPortalDateTime(schedule.ingressAt)} · Leave {formatPortalDateTime(schedule.egressAt)} · {schedule.location}</p>
      {schedule.notes ? <p className="mt-1 text-xs text-muted-foreground">{schedule.notes}</p> : null}
      {acknowledged ? null : (
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for requested change" className="h-9 rounded-md" />
          <Button type="button" size="sm" onClick={() => onAcknowledgeSchedule(requestId, schedule.revision)} className="rounded-md">Acknowledge</Button>
          <Button type="button" size="sm" variant="outline" disabled={!reason.trim()} onClick={() => onRequestScheduleChange(requestId, schedule.revision, reason.trim())} className="rounded-md">Request change</Button>
        </div>
      )}
      {schedule.changeRequestNote ? <p className="mt-2 text-xs text-attention dark:text-amber-300">Change requested: {schedule.changeRequestNote}</p> : null}
    </BookingStepPanel>
  );
}

function CreativeTaskStep({ requestId, task, busy, onUpdateProgress, onSubmitCreativeTask, onDownloadObject }: { requestId: string; task: CreativeTask; busy: string | null } & Pick<BookingHandlers, "onUpdateProgress" | "onSubmitCreativeTask" | "onDownloadObject">) {
  const [draft, setDraft] = useState<string>();
  const [file, setFile] = useState<File | null>(null);
  const note = draft ?? task.supplierProgressNote;
  const active = ACTIVE_TASK_STATUSES.includes(task.status);
  const working = busy === `creative:${task.id}`;
  return (
    <BookingStepPanel title={task.title} state={active ? "current" : "done"} summary={task.dueAt ? `Due ${formatPortalDateTime(task.dueAt)}` : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-2"><p className="min-w-0 whitespace-pre-wrap text-xs text-muted-foreground">{task.brief}</p><StatusBadge status={task.status} /></div>
      {active ? <>
        <Input className="mt-3 h-9 rounded-md" value={note} disabled={working} onChange={(e) => setDraft(e.target.value)} placeholder="Progress note for PMCM" />
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={working} onClick={() => onUpdateProgress(task.id, note)} className="rounded-md">Save progress</Button>
          <Input type="file" disabled={working} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="h-9 max-w-xs rounded-md pt-1.5" />
          <Button type="button" size="sm" disabled={working || (!note.trim() && !file)} onClick={() => onSubmitCreativeTask(requestId, task.id, note, file ?? undefined)} className="rounded-md">Submit deliverable</Button>
        </div>
      </> : null}
      {task.reviewNote ? <p className="mt-2 text-xs text-muted-foreground">PMCM review: {task.reviewNote}</p> : null}
      {task.submissions.map((submission) => <div key={submission.id} className="mt-2 flex items-center justify-between gap-2 text-xs"><span>Submission v{submission.version} · {submission.note}</span>{submission.storedObjectId ? <Button type="button" size="sm" variant="ghost" onClick={() => onDownloadObject(submission.storedObjectId!)}>Download</Button> : null}</div>)}
    </BookingStepPanel>
  );
}

function readinessStepView(req: PrismSupplierQuoteRequest): { state: PanelState; summary: string } {
  if (req.assignmentStatus !== "confirmed") return { state: "locked", summary: ASSIGNMENT_FIRST };
  if (req.readinessStatus === "confirmed") return { state: "done", summary: `Confirmed ${buildBookingSteps(req)[1].meta}` };
  return { state: "current", summary: "Tell PMCM when your preparation is complete." };
}

function ReadinessStep({ req, note, busy, onReadinessNoteChange, onConfirmReadiness }: { req: PrismSupplierQuoteRequest; note?: string; busy: string | null } & Pick<BookingHandlers, "onReadinessNoteChange" | "onConfirmReadiness">) {
  const { state, summary } = readinessStepView(req);
  return (
    <BookingStepPanel title="Confirm readiness" state={state} summary={summary}>
      {state === "done" ? null : (
        <div className="grid gap-3">
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Readiness notes
            <Input value={note ?? req.readinessNotes ?? ""} onChange={(e) => onReadinessNoteChange(req.id, e.target.value)} className="h-11 rounded-md" placeholder="Setup constraints or no concerns" />
          </label>
          <div>
            <Button type="button" size="sm" disabled={busy === `${req.id}:readiness`} onClick={() => onConfirmReadiness(req)} className="rounded-md font-semibold">
              <PackageCheck className="size-4" /> Confirm readiness
            </Button>
          </div>
        </div>
      )}
    </BookingStepPanel>
  );
}

function EventDayStep({ req, note, busy, onStatusNoteChange, onUpdateStatus }: { req: PrismSupplierQuoteRequest; note?: string; busy: string | null } & Pick<BookingHandlers, "onStatusNoteChange" | "onUpdateStatus">) {
  const canReport = canReportSupplierEventDayStatus(req);
  return (
    <>
      {req.eventDayStatus === "late" ? (
        <p role="status" className="rounded-md border border-attention/30 bg-attention/10 px-3 py-2 text-sm font-semibold text-attention dark:text-amber-200">
          Late arrival: your planned arrival time has passed.{canReport ? " Report your status below." : " Confirm your assignment and readiness to report your status."}
        </p>
      ) : null}
      <BookingStepPanel title="Event day status" state={canReport ? "current" : "locked"} summary={canReport ? "Report each stage as it happens onsite." : "Confirm your assignment and readiness first."}>
        <label className="grid gap-1.5 text-sm font-medium text-foreground">
          Status note
          <Input value={note ?? req.eventDayNotes ?? ""} onChange={(e) => onStatusNoteChange(req.id, e.target.value)} className="h-11 rounded-md" placeholder="Optional note for PMCM" />
        </label>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {EVENT_STATUS_ACTIONS.map(({ status, label, helper }) => (
            <button key={status} type="button" disabled={!isEventStatusStepAllowed(req.eventDayStatus, status) || busy === `${req.id}:${status}`} onClick={() => onUpdateStatus(req, status)}
              className={`flex h-20 w-full flex-col items-center justify-center gap-1 rounded-lg border font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${req.eventDayStatus === status ? "border-primary bg-primary text-white disabled:opacity-100" : "border-border bg-card text-foreground enabled:hover:border-primary/40 enabled:hover:bg-muted/40"}`}>
              <Truck className="size-5" aria-hidden="true" />
              <span className="text-sm">{label}</span>
              <span className="text-2xs font-semibold opacity-70">{helper}</span>
            </button>
          ))}
        </div>
      </BookingStepPanel>
    </>
  );
}

function BookingDetail({ req, workflowWorkspace, readinessNote, statusNote, busy, handlers }: {
  req: PrismSupplierQuoteRequest;
  workflowWorkspace: PrismSupplierWorkflowWorkspace | null;
  readinessNote?: string;
  statusNote?: string;
  busy: string | null;
  handlers: BookingHandlers;
}) {
  const forRequest = <Item extends { requestId: string }>(items: Item[] = []) => items.filter((item) => item.requestId === req.id);
  return (
    <div className="border-t border-border">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-6">
        {req.message ? <p className="min-w-0 max-w-3xl text-sm leading-6 text-foreground">{req.message}</p> : null}
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
          <BadgeCheck className="size-3.5" aria-hidden /> Selected by PMCM
        </span>
      </div>
      <BookingProgress req={req} />
      <div className="space-y-3 px-4 pb-5 sm:px-6">
        <AssignmentStep req={req} busy={busy} onConfirmAssignment={handlers.onConfirmAssignment} />
        <ContractStep req={req} contracts={forRequest(workflowWorkspace?.contracts)} busy={busy} onSaveContract={handlers.onSaveContract} onDownloadObject={handlers.onDownloadObject} />
        {forRequest(workflowWorkspace?.schedules).map((schedule) => (
          <ScheduleStep key={schedule.id} requestId={req.id} schedule={schedule} onAcknowledgeSchedule={handlers.onAcknowledgeSchedule} onRequestScheduleChange={handlers.onRequestScheduleChange} />
        ))}
        {forRequest(workflowWorkspace?.creativeTasks).map((task) => (
          <CreativeTaskStep key={task.id} requestId={req.id} task={task} busy={busy} onUpdateProgress={handlers.onUpdateProgress} onSubmitCreativeTask={handlers.onSubmitCreativeTask} onDownloadObject={handlers.onDownloadObject} />
        ))}
        <ReadinessStep req={req} note={readinessNote} busy={busy} onReadinessNoteChange={handlers.onReadinessNoteChange} onConfirmReadiness={handlers.onConfirmReadiness} />
        <EventDayStep req={req} note={statusNote} busy={busy} onStatusNoteChange={handlers.onStatusNoteChange} onUpdateStatus={handlers.onUpdateStatus} />
      </div>
    </div>
  );
}

export function BookingsPage({ selectedRequests, readinessBoard, readinessNotes, workflowWorkspace, statusNotes, busy, ...handlers }: {
  selectedRequests: PrismSupplierQuoteRequest[];
  readinessBoard: PrismSupplierReadinessBoard | null;
  session: PrismAuthenticatedSession;
  readinessNotes: Record<string, string>;
  workflowWorkspace: PrismSupplierWorkflowWorkspace | null;
  statusNotes: Record<string, string>;
  busy: string | null;
} & BookingHandlers) {
  useSupplierWorkTarget();
  if (!selectedRequests.length) {
    return (
      <Card><CardBody>
        <EmptyState icon={BadgeCheck} title="No active bookings." description="When PMCM selects your quote, the booking appears here for handoff." />
      </CardBody></Card>
    );
  }

  return (
    <div className="space-y-5">
      {selectedRequests.map((req) => (
        <details key={req.id} id={`supplier-work-${encodeURIComponent(req.id)}`} className="group scroll-mt-6 rounded-lg border border-border bg-card" open={selectedRequests.length === 1 ? true : undefined}>
          <BookingSummary request={req} readiness={readinessBoard?.items.find((item) => item.requestId === req.id)} />
          <BookingDetail req={req} workflowWorkspace={workflowWorkspace} readinessNote={readinessNotes[req.id]} statusNote={statusNotes[req.id]} busy={busy} handlers={handlers} />
        </details>
      ))}
    </div>
  );
}
