"use client";
import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { DateTimePicker } from "@prism/ui/components/date-time-picker";
import { formatPortalDateTime } from "@prism/ui/format-date";
import { prismCalendarDateKey, type PrismSupplierQuote, type PrismSupplierQuoteRequest } from "@prism/types";
import { DatePicker } from "@prism/ui/components/date-picker";
import { Button } from "@prism/ui/components/button";
import { Input } from "@prism/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@prism/ui/components/sheet";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { LoadingState } from "@prism/ui/components/loading-state";
import { cx } from "@/features/pmcm-kit";
import { usePmcmSupplierWorkflows } from "../view-models/use-pmcm-supplier-workflows";
import { summarizeSupplierWorkflow, type SummaryCell } from "../model/supplier-workflow-summary";

type WorkflowViewModel = ReturnType<typeof usePmcmSupplierWorkflows>;
type WorkflowRow = WorkflowViewModel["rows"][number];
type ContractRow = WorkflowRow["contracts"][number];
type CreativeTask = WorkflowRow["creativeTasks"][number];
type PayableMilestone = WorkflowRow["payables"][number];
type PayableRecord = PayableMilestone["history"][number];

function money(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);
}

const CELL_TONE: Record<SummaryCell["tone"], string> = { attention: "font-medium text-attention", done: "text-foreground", idle: "text-muted-foreground" };
const ROW_GRID = "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-4 py-3 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_1rem] md:items-center";

/**
 * The event's booked suppliers, one row each: what they are booked for and at what price, then where the schedule,
 * contract, deliverables and payables stand, amber where PMCM must act. A row opens that supplier in a side panel,
 * where each part is a short list and its form opens only when asked for. It replaces a card per supplier holding
 * five open forms inside a card inside the section.
 */
export function PmcmSupplierWorkflowsPanel({ eventId, eventDate, requests, quotes }: { eventId: string; eventDate?: string; requests: PrismSupplierQuoteRequest[]; quotes: PrismSupplierQuote[] }) {
  const vm = usePmcmSupplierWorkflows(eventId);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = vm.rows.find((row) => row.requestId === openId);
  const quoteFor = (row: WorkflowRow) => quotes.find((item) => item.requestId === row.requestId && item.supplierId === row.supplierId && item.status === "selected");
  const categoryFor = (row: WorkflowRow) => requests.find((item) => item.id === row.requestId)?.category ?? "Supplier booking";
  const eventDayReached = !eventDate || eventDate.slice(0, 10) <= prismCalendarDateKey();
  const rows = [...vm.rows].sort((a, b) => Number(summarizeSupplierWorkflow(b).needsPmcm) - Number(summarizeSupplierWorkflow(a).needsPmcm));
  return (
    <div className="space-y-3">
      <WorkflowAlert error={vm.error} notice={vm.notice} busy={vm.busy} onReload={vm.load} />
      {vm.isLoading ? <LoadingState label="Loading supplier bookings…" /> : null}
      {!vm.isLoading && rows.length === 0 ? <p className="text-sm text-muted-foreground">No supplier is booked yet. Select a quote above and the booking appears here.</p> : null}
      {!vm.isLoading && rows.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div aria-hidden className={cx(ROW_GRID, "hidden border-b border-border py-2 text-xs text-muted-foreground md:grid")}>
            <span>Supplier</span><span>Schedule</span><span>Contract</span><span>Deliverables</span><span>Payables</span><span />
          </div>
          <ul className="divide-y divide-border">
            {rows.map((row) => {
              const summary = summarizeSupplierWorkflow(row);
              const quote = quoteFor(row);
              return (
                <li key={row.requestId} className={cx("relative transition-colors hover:bg-surface-raised has-[button:focus-visible]:bg-surface-raised", ROW_GRID, summary.needsPmcm && "bg-primary/5")}>
                  <span className="min-w-0">
                    <button type="button" onClick={() => setOpenId(row.requestId)} className="block max-w-full truncate text-left text-sm font-semibold text-foreground outline-none after:absolute after:inset-0">
                      {row.supplierName}
                    </button>
                    <span className="block truncate text-xs text-muted-foreground">{[categoryFor(row), quote ? money(quote.amount) : null].filter(Boolean).join(" · ")}</span>
                  </span>
                  {(["schedule", "contract", "deliverables", "payables"] as const).map((part) => (
                    <span key={part} className={cx("col-start-1 text-xs md:col-start-auto md:text-sm", CELL_TONE[summary[part].tone])}>
                      <span className="text-muted-foreground md:hidden">{part[0].toUpperCase() + part.slice(1)}: </span>{summary[part].text}
                    </span>
                  ))}
                  <ChevronRight aria-hidden className="col-start-2 row-start-1 size-4 self-center text-muted-foreground md:col-start-auto md:row-start-auto" />
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      <Sheet open={Boolean(open)} onOpenChange={(next) => { if (!next) setOpenId(null); }}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {open ? (
            <>
              <SheetHeader>
                <SheetTitle>{open.supplierName}</SheetTitle>
                <SheetDescription>{[categoryFor(open), `assignment ${open.assignmentStatus}`, quoteFor(open) ? money(quoteFor(open)!.amount) : null].filter(Boolean).join(" · ")}</SheetDescription>
              </SheetHeader>
              <div className="divide-y divide-border px-4 pb-6">
                <ScheduleSection row={open} vm={vm} />
                <ContractSection contracts={open.contracts} vm={vm} />
                <DeliverablesSection row={open} vm={vm} />
                <PayablesSection row={open} quote={quoteFor(open)} vm={vm} />
                {eventDayReached ? <StatusCorrection row={open} vm={vm} /> : <p className="py-4 text-xs text-muted-foreground">Onsite status corrections open on the event day.</p>}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** One part of the supplier panel: a heading with what it holds, and an action that opens its form in place. */
function Part({ title, summary, action, children }: { title: string; summary?: ReactNode; action?: ReactNode; children?: ReactNode }) {
  return (
    <section className="grid gap-2 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {summary ? <div className="text-xs text-muted-foreground">{summary}</div> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Toggle({ open, onToggle, label }: { open: boolean; onToggle: () => void; label: string }) {
  return <Button type="button" size="sm" variant="outline" aria-expanded={open} onClick={onToggle}>{open ? "Cancel" : label}</Button>;
}

function WorkflowAlert({ error, notice, busy, onReload }: { error: string | null; notice: string | null; busy: boolean; onReload: () => Promise<unknown> }) {
  return <>{error ? <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><span>{error}</span><Button size="sm" variant="outline" disabled={busy} onClick={() => void onReload().catch(() => undefined)}>Reload bookings</Button></div> : null}{notice ? <p role="status" className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{notice}</p> : null}</>;
}

function ScheduleSection({ row, vm }: { row: WorkflowRow; vm: WorkflowViewModel }) {
  const [editing, setEditing] = useState(false);
  const key = `schedule:${row.requestId}`;
  const summary = row.schedule
    ? <>{formatPortalDateTime(row.schedule.ingressAt)} – {formatPortalDateTime(row.schedule.egressAt)} · {row.schedule.location || "Location pending"} · revision {row.schedule.revision}</>
    : "Ingress and egress are not set.";
  return (
    <Part title="Schedule" summary={summary} action={<Toggle open={editing} onToggle={() => setEditing((value) => !value)} label={row.schedule ? "Change schedule" : "Set schedule"} />}>
      {row.schedule?.changeRequestNote ? <p className="text-xs text-attention">The supplier asked for a change: {row.schedule.changeRequestNote}</p> : null}
      {editing ? (
        <div className="grid gap-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-semibold">Ingress<DateTimePicker value={vm.value(key, "ingressAt")} onValueChange={(next) => vm.setValue(key, "ingressAt", next)} /></label>
            <label className="grid gap-1 text-xs font-semibold">Egress<DateTimePicker value={vm.value(key, "egressAt")} onValueChange={(next) => vm.setValue(key, "egressAt", next)} /></label>
            <Input aria-label="Schedule location" placeholder="Location" value={vm.value(key, "location")} onChange={(e) => vm.setValue(key, "location", e.target.value)} />
            <Input aria-label="Schedule notes" placeholder="Notes for supplier" value={vm.value(key, "notes")} onChange={(e) => vm.setValue(key, "notes", e.target.value)} />
          </div>
          <Button className="justify-self-start" size="sm" disabled={vm.busy || !vm.value(key, "ingressAt") || !vm.value(key, "egressAt")} onClick={() => void vm.publishSchedule(row.requestId).then(() => setEditing(false))}>Publish schedule</Button>
        </div>
      ) : null}
    </Part>
  );
}

const EVENT_DAY_STATUSES = [["not_started", "Not started"], ["arrived", "Arrived"], ["set_up_ready", "Set up and ready"], ["done_leaving", "Done and leaving"]] as const;
/** Radix Select cannot hold an empty-string item, so "none" stands for "no status chosen yet". */
const NO_STATUS = "none";

function StatusCorrection({ row, vm }: { row: WorkflowRow; vm: WorkflowViewModel }) {
  const key = `status:${row.requestId}`;
  const status = vm.value(key, "status");
  const reason = vm.value(key, "reason");
  return (
    <Part title="Correct onsite status" summary="When the supplier's own status on the day is wrong.">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={status || NO_STATUS} onValueChange={(next) => vm.setValue(key, "status", next === NO_STATUS ? "" : next)}><SelectTrigger aria-label="Corrected onsite status" className="h-8 w-44 min-w-0 rounded-lg bg-background text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NO_STATUS}>Choose status</SelectItem>{EVENT_DAY_STATUSES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
        <Input className="h-8 max-w-xs" aria-label="Status correction reason" placeholder="Reason for correction" value={reason} onChange={(e) => vm.setValue(key, "reason", e.target.value)} />
        <Button size="sm" variant="outline" disabled={vm.busy || !status || !reason.trim()} onClick={() => void vm.correctStatus(row.requestId)}>Correct status</Button>
      </div>
    </Part>
  );
}

function ContractSection({ contracts, vm }: { contracts: ContractRow[]; vm: WorkflowViewModel }) {
  const ordered = [...contracts].sort((a, b) => b.version - a.version);
  return (
    <Part title="Contract" summary={ordered.length ? `${ordered.length} ${ordered.length === 1 ? "version" : "versions"}, newest first` : "The supplier has not sent a contract yet."}>
      {ordered.map((contract) => <ContractVersionRow key={contract.id} contract={contract} vm={vm} />)}
    </Part>
  );
}

function ContractVersionRow({ contract, vm }: { contract: ContractRow; vm: WorkflowViewModel }) {
  const reason = vm.value(contract.id, "reason");
  return (
    <div className="grid gap-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="min-w-0">v{contract.version} · {contract.fileName}</span>
        <span className="flex items-center gap-2"><StatusBadge status={contract.reviewStatus} /><Button size="sm" variant="ghost" onClick={() => void vm.download(contract.storedObjectId)}>Download</Button></span>
      </div>
      {contract.quoteMismatch ? <p className="text-xs font-semibold text-destructive">Contract PHP {contract.contractTotal?.toLocaleString("en-PH")} differs from the selected quote of PHP {contract.quotedTotal?.toLocaleString("en-PH")}</p> : null}
      {contract.reviewStatus === "submitted" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input className="h-8 max-w-xs" value={reason} onChange={(e) => vm.setValue(contract.id, "reason", e.target.value)} placeholder="Note for a correction" />
          <Button size="sm" disabled={vm.busy} onClick={() => void vm.decideContract(contract.id, "accepted")}>Accept</Button>
          <Button size="sm" variant="outline" disabled={vm.busy || !reason.trim()} onClick={() => void vm.decideContract(contract.id, "changes_requested")}>Request correction</Button>
        </div>
      ) : null}
    </div>
  );
}

function DeliverablesSection({ row, vm }: { row: WorkflowRow; vm: WorkflowViewModel }) {
  const [adding, setAdding] = useState(false);
  const key = `task:${row.requestId}`;
  const title = vm.value(key, "title");
  const brief = vm.value(key, "brief");
  return (
    <Part title="Deliverables" summary={row.creativeTasks.length ? `${row.creativeTasks.length} assigned` : "None assigned."} action={<Toggle open={adding} onToggle={() => setAdding((value) => !value)} label="Add deliverable" />}>
      {adding ? (
        <div className="grid gap-2">
          <div className="grid gap-2 sm:grid-cols-2"><Input placeholder="Deliverable title" value={title} onChange={(e) => vm.setValue(key, "title", e.target.value)} /><DateTimePicker value={vm.value(key, "dueAt")} onValueChange={(next) => vm.setValue(key, "dueAt", next)} aria-label="Deliverable due date" /></div>
          <textarea className="min-h-20 w-full rounded-lg border border-border bg-background p-2 text-sm" placeholder="Brief and acceptance criteria for this supplier" value={brief} onChange={(e) => vm.setValue(key, "brief", e.target.value)} />
          <Button className="justify-self-start" size="sm" disabled={vm.busy || !title.trim() || !brief.trim()} onClick={() => void vm.assignTask(row.requestId).then(() => setAdding(false))}>Assign deliverable</Button>
        </div>
      ) : null}
      {row.creativeTasks.map((task) => <CreativeTaskCard key={task.id} task={task} vm={vm} />)}
    </Part>
  );
}

function CreativeTaskCard({ task, vm }: { task: CreativeTask; vm: WorkflowViewModel }) {
  const reviewNote = vm.value(task.id, "reviewNote");
  return <div className="rounded-lg border border-border p-3"><div className="flex flex-wrap justify-between gap-2"><p className="text-xs font-semibold">{task.title}</p><StatusBadge status={task.status} /></div><p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{task.brief}</p>{task.supplierProgressNote ? <p className="mt-1 text-xs">Supplier progress: {task.supplierProgressNote}</p> : null}<TaskSubmissions task={task} vm={vm} />{task.status === "submitted" ? <div className="mt-2 flex flex-wrap gap-2"><Input className="h-8 max-w-xs" placeholder="Review note" value={reviewNote} onChange={(e) => vm.setValue(task.id, "reviewNote", e.target.value)} /><Button size="sm" disabled={vm.busy || !reviewNote.trim()} onClick={() => void vm.decideTask(task.id, "accepted")}>Accept</Button><Button size="sm" variant="outline" disabled={vm.busy || !reviewNote.trim()} onClick={() => void vm.decideTask(task.id, "changes_requested")}>Request revision</Button></div> : null}</div>;
}

function TaskSubmissions({ task, vm }: { task: CreativeTask; vm: WorkflowViewModel }) {
  return <>{task.submissions.map((submission) => <div key={submission.id} className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>Submitted v{submission.version}: {submission.note}</span>{submission.storedObjectId ? <Button size="sm" variant="ghost" onClick={() => void vm.download(submission.storedObjectId!)}>Download submission</Button> : null}</div>)}</>;
}

function PayablesSection({ row, quote, vm }: { row: WorkflowRow; quote?: PrismSupplierQuote; vm: WorkflowViewModel }) {
  const [adding, setAdding] = useState(false);
  const key = `payable:${row.requestId}`;
  const total = row.payables.reduce((sum, milestone) => sum + milestone.amount, 0);
  const released = row.payables.reduce((sum, milestone) => sum + milestone.amountReleased, 0);
  return (
    <Part
      title="Payables"
      summary={row.payables.length ? `${money(released)} released of ${money(total)}` : quote ? "No milestones yet." : "A selected quote is needed before adding a milestone."}
      action={quote ? <Toggle open={adding} onToggle={() => setAdding((value) => !value)} label="Add milestone" /> : undefined}
    >
      {adding && quote ? (
        <div className="grid gap-2">
          <div className="grid gap-2 sm:grid-cols-3"><Input placeholder="Milestone name" value={vm.value(key, "label")} onChange={(e) => vm.setValue(key, "label", e.target.value)} /><Input type="number" min="1" step="1" placeholder="Amount" value={vm.value(key, "amount")} onChange={(e) => vm.setValue(key, "amount", e.target.value)} /><DatePicker aria-label="Payable due date" value={vm.value(key, "dueDate")} onValueChange={(value) => vm.setValue(key, "dueDate", value)} /></div>
          <Button className="justify-self-start" size="sm" disabled={vm.busy || !vm.value(key, "label").trim() || !Number.isInteger(Number(vm.value(key, "amount"))) || Number(vm.value(key, "amount")) <= 0} onClick={() => void vm.addPayable(row.requestId, quote).then(() => setAdding(false))}>Add milestone</Button>
        </div>
      ) : null}
      {row.payables.map((milestone) => <PayableMilestoneCard key={milestone.id} milestone={milestone} vm={vm} />)}
    </Part>
  );
}

function PayableMilestoneCard({ milestone, vm }: { milestone: PayableMilestone; vm: WorkflowViewModel }) {
  const [releasing, setReleasing] = useState(false);
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><strong>{milestone.label} · {money(milestone.amount)}</strong><StatusBadge status={milestone.status} /></div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Released {money(milestone.amountReleased)} · Remaining {money(milestone.remainingBalance)}</p>
        {milestone.remainingBalance > 0 ? <Toggle open={releasing} onToggle={() => setReleasing((value) => !value)} label="Record release" /> : null}
      </div>
      {releasing && milestone.remainingBalance > 0 ? <PayoutReleaseForm milestone={milestone} vm={vm} /> : null}
      {milestone.history.length ? <div className="mt-2 divide-y divide-border">{milestone.history.map((record) => <PayableHistoryRow key={record.id} record={record} milestone={milestone} vm={vm} />)}</div> : null}
    </div>
  );
}

function PayoutReleaseForm({ milestone, vm }: { milestone: PayableMilestone; vm: WorkflowViewModel }) {
  const amount = vm.value(milestone.id, "amount");
  const paymentDate = vm.value(milestone.id, "paymentDate");
  const method = vm.value(milestone.id, "method");
  const canSubmit = Number.isInteger(Number(amount)) && Number(amount) > 0 && Boolean(paymentDate) && Boolean(method.trim());
  return <div className="mt-2 grid gap-2 sm:grid-cols-2"><Input type="number" min="1" step="1" placeholder="Release amount" value={amount} onChange={(e) => vm.setValue(milestone.id, "amount", e.target.value)} /><DatePicker aria-label="Payment date" value={paymentDate} onValueChange={(value) => vm.setValue(milestone.id, "paymentDate", value)} /><Input placeholder="Method" value={method} onChange={(e) => vm.setValue(milestone.id, "method", e.target.value)} /><Input placeholder="Reference number" value={vm.value(milestone.id, "referenceNumber")} onChange={(e) => vm.setValue(milestone.id, "referenceNumber", e.target.value)} /><Button className="justify-self-start" size="sm" disabled={vm.busy || !canSubmit} onClick={() => void vm.releasePayout(milestone.id)}>Save release</Button></div>;
}

/** Whether the supplier confirmed the money arrived, and their official receipt when they sent one. */
function SupplierConfirmation({ record, vm }: { record: PayableRecord; vm: WorkflowViewModel }) {
  if (!record.receivedAt) return record.kind === "release" ? <span className="text-muted-foreground">Supplier has not confirmed it yet</span> : null;
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-success">
      Supplier confirmed {formatPortalDateTime(record.receivedAt)}
      {record.officialReceipt ? <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => void vm.download(record.officialReceipt!.objectId)}>Official receipt</Button> : null}
    </span>
  );
}

function PayableHistoryRow({ record, milestone, vm }: { record: PayableRecord; milestone: PayableMilestone; vm: WorkflowViewModel }) {
  const canReverse = record.kind === "release" && !milestone.history.some((entry) => entry.reversesRecordId === record.id);
  const reason = vm.value(record.id, "reverseReason");
  return <div className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs"><span className="flex flex-wrap items-center gap-x-3 gap-y-1"><span>{record.kind} · {money(record.amount)} · {record.method} {record.referenceNumber}{record.notes ? ` · ${record.notes}` : ""}</span><SupplierConfirmation record={record} vm={vm} /></span>{canReverse ? <div className="flex items-center gap-2"><Input className="h-8 w-52" aria-label="Reversal reason" placeholder="Reason for reversal" value={reason} onChange={(e) => vm.setValue(record.id, "reverseReason", e.target.value)} /><Button size="sm" variant="ghost" disabled={vm.busy || !reason.trim()} onClick={() => void vm.reversePayout(record.id)}>Reverse</Button></div> : null}</div>;
}
