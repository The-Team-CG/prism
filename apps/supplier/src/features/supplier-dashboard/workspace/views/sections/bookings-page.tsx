"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Circle,
  ClipboardList,
  Clock3,
  FileCheck2,
  FileText,
  HelpCircle,
  LockKeyhole,
  LogOut,
  MessageSquare,
  PackageCheck,
  RefreshCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Truck,
  User,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { PrismDashboardShell } from "@prism/ui";
import {
  EVENT_STATUS_ACTIONS,
  buildBookingSteps,
  buildCalendarEvents,
  canReportSupplierEventDayStatus,
  closedRequestReason,
  firstNameFrom,
  formatDate,
  formatMoney,
  fmt,
  greetingForHour,
  initialForm,
  isPastDate,
  isRequestClosed,
  readinessTone,
} from "../../model/supplier-workspace-rules";
import type { PrismAuthenticatedSession } from "@prism/types";
import type { PrismSupplierWorkflowWorkspace } from "@prism/types";
import type { PrismSupplier, PrismSupplierQuote, PrismSupplierQuoteRequest, PrismSupplierReadinessBoard, QuoteFormState, SupplierDashboardSection, SupplierWorkspace } from "../../model/supplier-workspace-types";
import { useSupplierWorkspaceViewModel } from "../../view-models/use-supplier-workspace-view-model";


import { Card, CardBody, CardHeader, SectionAccent, StatCell } from "./shell-ui";

export function BookingsPage({
  selectedRequests, session, readinessNotes, workflowWorkspace, statusNotes, busy,
  onReadinessNoteChange, onStatusNoteChange,
  onConfirmAssignment, onConfirmReadiness, onSaveContract, onUpdateStatus,
  onAcknowledgeSchedule, onRequestScheduleChange, onUpdateProgress, onSubmitCreativeTask, onDownloadObject,
}: {
  selectedRequests: PrismSupplierQuoteRequest[];
  session: PrismAuthenticatedSession;
  readinessNotes: Record<string, string>;
  workflowWorkspace: PrismSupplierWorkflowWorkspace | null;
  statusNotes: Record<string, string>;
  busy: string | null;
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
}) {
  const [contractUploads, setContractUploads] = useState<Record<string, File | null>>({});
  const [scheduleReasons, setScheduleReasons] = useState<Record<string, string>>({});
  const [taskNotes, setTaskNotes] = useState<Record<string, string>>({});
  const [taskFiles, setTaskFiles] = useState<Record<string, File | null>>({});
  if (!selectedRequests.length) {
    return (
      <Card><CardBody>
        <EmptyState icon={BadgeCheck} title="No active bookings." description="When PMCM selects your quote, the booking appears here for handoff." />
      </CardBody></Card>
    );
  }

  return (
    <div className="space-y-5">
      {selectedRequests.map((req) => {
        const steps = buildBookingSteps(req);
        const canReportEventDayStatus = canReportSupplierEventDayStatus(req);

        return (
          <Card key={req.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <SectionAccent>Selected booking</SectionAccent>
                  <h3 className="mt-1 text-sm font-bold text-foreground">{req.category}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{req.message}</p>
                </div>
                <Badge variant="outline" className="rounded-full border-(--prism-success)/25 bg-(--prism-success)/8 text-(--prism-success)">
                  <BadgeCheck className="size-3" /> Selected
                </Badge>
              </div>
            </CardHeader>

            {/* Progress */}
            <div className="grid grid-cols-2 gap-3 border-b border-border px-6 py-5 sm:grid-cols-4">
              {steps.map((step) => (
                <div key={step.label} className="flex items-start gap-2.5">
                  <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${step.done ? "bg-(--prism-success) text-white" : "border-2 border-border bg-background"}`}>
                    {step.done ? <CheckCircle2 className="size-3" /> : <Circle className="size-3 text-muted-foreground" />}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-xs font-bold ${step.done ? "text-(--prism-success)" : "text-muted-foreground"}`}>{step.label}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{step.meta}</p>
                  </div>
                </div>
              ))}
            </div>

            <CardBody className="space-y-4">
              {/* Step 1 */}
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-sm font-bold text-foreground">1. Confirm assignment</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Acknowledge that you accept this assignment from PMCM.</p>
                <Button type="button" size="sm" variant={req.assignmentStatus === "confirmed" ? "outline" : "default"}
                  disabled={req.assignmentStatus === "confirmed" || busy === `${req.id}:assignment`}
                  onClick={() => onConfirmAssignment(req)} className="mt-3 rounded-xl font-bold">
                  <CheckCircle2 className="size-4" />
                  {req.assignmentStatus === "confirmed" ? "Assignment confirmed" : "Confirm assignment"}
                </Button>
              </div>

              {/* Step 2 */}
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-sm font-bold text-foreground">2. Readiness &amp; contract</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Confirm readiness and upload the signed contract for PMCM review.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm font-bold text-foreground">
                    Readiness notes
                    <Input value={readinessNotes[req.id] ?? req.readinessNotes ?? ""} onChange={(e) => onReadinessNoteChange(req.id, e.target.value)} className="h-10 rounded-xl" placeholder="Setup constraints or no concerns" />
                  </label>
                  <label className="grid gap-1.5 text-sm font-bold text-foreground">
                    Signed contract file
                    <Input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => setContractUploads((current) => ({ ...current, [req.id]: e.target.files?.[0] ?? null }))} className="h-10 rounded-xl pt-2" />
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant={req.readinessStatus === "confirmed" ? "outline" : "default"}
                    disabled={req.readinessStatus === "confirmed" || busy === `${req.id}:readiness`}
                    onClick={() => onConfirmReadiness(req)} className="rounded-xl font-bold">
                    <PackageCheck className="size-4" />{req.readinessStatus === "confirmed" ? "Readiness confirmed" : "Confirm readiness"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={!contractUploads[req.id] || busy === `${req.id}:contract`} onClick={() => { const file = contractUploads[req.id]; if (file) onSaveContract(req, file); }} className="rounded-xl font-bold">
                    <FileText className="size-4" /> Upload contract
                  </Button>
                </div>
                {workflowWorkspace?.contracts.filter((contract) => contract.requestId === req.id).map((contract) => (
                  <div key={contract.id} className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs">
                    <span className="truncate font-semibold">v{contract.version} · {contract.fileName}</span>
                    <span>{contract.reviewStatus.replaceAll("_", " ")}{contract.reviewReason ? ` · ${contract.reviewReason}` : ""}</span>
                    <Button type="button" size="sm" variant="ghost" onClick={() => onDownloadObject(contract.storedObjectId)}>Download</Button>
                  </div>
                ))}
              </div>

              {workflowWorkspace?.schedules.filter((schedule) => schedule.requestId === req.id).map((schedule) => (
                <div key={schedule.id} className="rounded-xl border border-border bg-muted/30 p-4">
                  <p className="text-sm font-bold text-foreground">Supplier schedule · revision {schedule.revision}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Ingress {new Date(schedule.ingressAt).toLocaleString()} · Egress {new Date(schedule.egressAt).toLocaleString()} · {schedule.location}</p>
                  {schedule.notes ? <p className="mt-1 text-xs text-muted-foreground">{schedule.notes}</p> : null}
                  {schedule.acknowledgedRevision === schedule.revision ? <p className="mt-2 text-xs font-semibold text-(--prism-success)">You acknowledged this revision.</p> : (
                    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                      <Input value={scheduleReasons[schedule.id] ?? ""} onChange={(e) => setScheduleReasons((current) => ({ ...current, [schedule.id]: e.target.value }))} placeholder="Reason for requested change" className="h-9 rounded-lg" />
                      <Button type="button" size="sm" onClick={() => onAcknowledgeSchedule(req.id, schedule.revision)} className="rounded-lg">Acknowledge</Button>
                      <Button type="button" size="sm" variant="outline" disabled={!scheduleReasons[schedule.id]?.trim()} onClick={() => onRequestScheduleChange(req.id, schedule.revision, scheduleReasons[schedule.id]!.trim())} className="rounded-lg">Request change</Button>
                    </div>
                  )}
                  {schedule.changeRequestNote ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Change requested: {schedule.changeRequestNote}</p> : null}
                </div>
              ))}

              {workflowWorkspace?.creativeTasks.filter((task) => task.requestId === req.id).map((task) => (
                <div key={task.id} className="rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-bold">{task.title}</p><p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{task.brief}</p></div><StatusBadge status={task.status} /></div>
                  {task.dueAt ? <p className="mt-2 text-xs text-muted-foreground">Due {new Date(task.dueAt).toLocaleString()}</p> : null}
                  {["open", "in_progress", "changes_requested"].includes(task.status) ? <>
                    <Input className="mt-3 h-9 rounded-lg" value={taskNotes[task.id] ?? task.supplierProgressNote} disabled={busy === `creative:${task.id}`} onChange={(e) => setTaskNotes((current) => ({ ...current, [task.id]: e.target.value }))} placeholder="Progress note for PMCM" />
                    <div className="mt-2 flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" disabled={busy === `creative:${task.id}`} onClick={() => onUpdateProgress(task.id, taskNotes[task.id] ?? task.supplierProgressNote)} className="rounded-lg">Save progress</Button>
                    <Input type="file" disabled={busy === `creative:${task.id}`} onChange={(e) => setTaskFiles((current) => ({ ...current, [task.id]: e.target.files?.[0] ?? null }))} className="h-9 max-w-xs rounded-lg pt-1.5" />
                    <Button type="button" size="sm" disabled={busy === `creative:${task.id}` || (!taskNotes[task.id]?.trim() && !taskFiles[task.id])} onClick={() => onSubmitCreativeTask(req.id, task.id, taskNotes[task.id] ?? "", taskFiles[task.id] ?? undefined)} className="rounded-lg">Submit deliverable</Button></div>
                  </> : null}
                  {task.reviewNote ? <p className="mt-2 text-xs text-muted-foreground">PMCM review: {task.reviewNote}</p> : null}
                  {task.submissions.map((submission) => <div key={submission.id} className="mt-2 flex items-center justify-between gap-2 text-xs"><span>Submission v{submission.version} · {submission.note}</span>{submission.storedObjectId ? <Button type="button" size="sm" variant="ghost" onClick={() => onDownloadObject(submission.storedObjectId!)}>Download</Button> : null}</div>)}
                </div>
              ))}

              {/* Step 3 — event day */}
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-sm font-bold text-foreground">3. Event day status</p>
                <p className="mt-0.5 text-xs text-muted-foreground">After PMCM selects this booking, confirm your assignment and readiness above before reporting your onsite status.</p>
                {req.eventDayStatus === "late" ? (
                  <p role="status" className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
                    Late arrival — your planned ingress time has passed. Confirm your assignment and readiness above before reporting below.
                  </p>
                ) : null}
                <label className="mt-3 grid gap-1.5 text-sm font-bold text-foreground">
                  Status note
                  <Input value={statusNotes[req.id] ?? req.eventDayNotes ?? ""} onChange={(e) => onStatusNoteChange(req.id, e.target.value)} className="h-10 rounded-xl" placeholder="Optional note for PMCM" />
                </label>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {EVENT_STATUS_ACTIONS.map(({ status, label, helper }) => (
                    <button key={status} type="button" disabled={!canReportEventDayStatus || busy === `${req.id}:${status}`} onClick={() => onUpdateStatus(req, status)}
                      className={`flex h-20 w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 font-bold transition ${req.eventDayStatus === status ? "border-(--prism-signal) bg-(--prism-signal) text-white" : "border-border bg-card text-foreground hover:border-(--prism-signal)/40 hover:bg-muted/40"}`}>
                      <Truck className="size-5" />
                      <span className="text-sm">{label}</span>
                      <span className="text-[11px] font-semibold opacity-70">{helper}</span>
                    </button>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

