"use client";

import type { PrismSupplierQuote, PrismSupplierQuoteRequest } from "@prism/types";
import { DatePicker } from "@prism/ui/components/date-picker";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { usePmcmSupplierWorkflows } from "../view-models/use-pmcm-supplier-workflows";
import { Card, CardBody, CardHeader } from "@/features/event-dashboard/shell/views/sections/shell-ui";

type WorkflowViewModel = ReturnType<typeof usePmcmSupplierWorkflows>;
type WorkflowRow = WorkflowViewModel["rows"][number];
type ContractRow = WorkflowRow["contracts"][number];
type CreativeTask = WorkflowRow["creativeTasks"][number];
type PayableMilestone = WorkflowRow["payables"][number];
type PayableRecord = PayableMilestone["history"][number];

function money(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);
}

export function PmcmSupplierWorkflowsPanel({ eventId, requests, quotes }: { eventId: string; requests: PrismSupplierQuoteRequest[]; quotes: PrismSupplierQuote[] }) {
  const vm = usePmcmSupplierWorkflows(eventId);
  return <Card>
    <CardHeader><h2 className="text-sm font-bold text-foreground">Supplier delivery, contracts and payables</h2><p className="mt-1 text-xs text-muted-foreground">Publish ingress and egress times, review contract evidence, assign deliverables, and record actual supplier payment releases.</p></CardHeader>
    <CardBody className="space-y-4">
      <WorkflowAlert error={vm.error} notice={vm.notice} busy={vm.busy} onReload={vm.load} />
      <SupplierScheduleList schedules={vm.schedules} />
      <WorkflowRows vm={vm} requests={requests} quotes={quotes} />
    </CardBody>
  </Card>;
}

function SupplierScheduleList({ schedules }: { schedules: WorkflowViewModel["schedules"] }) {
  return <section aria-label="Supplier schedule list" className="rounded-lg border border-border p-3">
    <h3 className="text-xs font-bold">Published supplier schedules</h3>
    {schedules.length ? <ul className="mt-2 divide-y divide-border">{schedules.map((schedule) => <li key={schedule.id} className="flex flex-wrap justify-between gap-2 py-2 text-xs">
      <span className="font-semibold">{schedule.supplierName} · {schedule.location || "Location pending"}</span>
      <span className="text-muted-foreground">{new Date(schedule.ingressAt).toLocaleString()} – {new Date(schedule.egressAt).toLocaleString()} · {schedule.status}</span>
    </li>)}</ul> : <p className="mt-2 text-xs text-muted-foreground">No supplier schedules published yet.</p>}
  </section>;
}

function WorkflowAlert({ error, notice, busy, onReload }: { error: string | null; notice: string | null; busy: boolean; onReload: () => Promise<unknown> }) {
  return <>{error ? <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><span>{error}</span><Button size="sm" variant="outline" disabled={busy} onClick={() => void onReload().catch(() => undefined)}>Reload workflows</Button></div> : null}{notice ? <p role="status" className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{notice}</p> : null}</>;
}

function WorkflowRows({ vm, requests, quotes }: { vm: WorkflowViewModel; requests: PrismSupplierQuoteRequest[]; quotes: PrismSupplierQuote[] }) {
  if (vm.isLoading) return <p className="text-sm text-muted-foreground">Loading supplier workflows…</p>;
  if (!vm.rows.length) return <p className="text-sm text-muted-foreground">No selected supplier assignments for this event.</p>;
  return <>{vm.rows.map((row) => <SupplierWorkflowRow key={row.requestId} row={row} vm={vm} request={requests.find((item) => item.id === row.requestId)} quote={quotes.find((item) => item.requestId === row.requestId && item.supplierId === row.supplierId && item.status === "selected")} />)}</>;
}

function SupplierWorkflowRow({ row, vm, request, quote }: { row: WorkflowRow; vm: WorkflowViewModel; request?: PrismSupplierQuoteRequest; quote?: PrismSupplierQuote }) {
  return <section className="space-y-3 rounded-xl border border-border p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-bold">{row.supplierName} · {request?.category ?? "Supplier booking"}</p><p className="mt-1 text-xs text-muted-foreground">Assignment {row.assignmentStatus}</p></div>{quote ? <p className="text-sm font-bold">Selected quote {money(quote.amount)}</p> : null}</div>
    <ScheduleEditor row={row} vm={vm} />
    <StatusCorrection row={row} vm={vm} />
    <ContractVersions contracts={row.contracts} vm={vm} />
    <CreativeTasks row={row} vm={vm} />
    <PayableMilestones row={row} quote={quote} vm={vm} />
  </section>;
}

function ScheduleEditor({ row, vm }: { row: WorkflowRow; vm: WorkflowViewModel }) {
  const key = `schedule:${row.requestId}`;
  return <div className="rounded-lg bg-muted/30 p-3"><p className="mb-2 text-xs font-bold">Ingress / egress schedule {row.schedule ? `· revision ${row.schedule.revision}` : ""}</p>
    {row.schedule ? <p className="mb-2 text-xs text-muted-foreground">Current: {new Date(row.schedule.ingressAt).toLocaleString()} – {new Date(row.schedule.egressAt).toLocaleString()} · {row.schedule.location}</p> : null}
    {row.schedule?.changeRequestNote ? <p className="mb-2 text-xs text-attention dark:text-amber-300">Supplier requested a change: {row.schedule.changeRequestNote}</p> : null}
    <div className="grid gap-2 sm:grid-cols-2"><label className="grid gap-1 text-xs font-semibold">Ingress<Input type="datetime-local" value={vm.value(key, "ingressAt")} onChange={(e) => vm.setValue(key, "ingressAt", e.target.value)} /></label><label className="grid gap-1 text-xs font-semibold">Egress<Input type="datetime-local" value={vm.value(key, "egressAt")} onChange={(e) => vm.setValue(key, "egressAt", e.target.value)} /></label><Input aria-label="Schedule location" placeholder="Location" value={vm.value(key, "location")} onChange={(e) => vm.setValue(key, "location", e.target.value)} /><Input aria-label="Schedule notes" placeholder="Notes for supplier" value={vm.value(key, "notes")} onChange={(e) => vm.setValue(key, "notes", e.target.value)} /></div>
    <Button className="mt-2" size="sm" disabled={vm.busy || !vm.value(key, "ingressAt") || !vm.value(key, "egressAt")} onClick={() => void vm.publishSchedule(row.requestId)}>Publish schedule</Button>
  </div>;
}

const EVENT_DAY_STATUSES = [["not_started", "Not started"], ["arrived", "Arrived"], ["set_up_ready", "Set up and ready"], ["done_leaving", "Done and leaving"]] as const;

function StatusCorrection({ row, vm }: { row: WorkflowRow; vm: WorkflowViewModel }) {
  const key = `status:${row.requestId}`;
  const status = vm.value(key, "status");
  const reason = vm.value(key, "reason");
  return <div className="rounded-lg bg-muted/30 p-3"><p className="mb-2 text-xs font-bold">Correct event-day status</p><div className="flex flex-wrap items-center gap-2">
    <select aria-label="Corrected event-day status" className="h-8 rounded-lg border border-border bg-background px-2 text-xs" value={status} onChange={(e) => vm.setValue(key, "status", e.target.value)}><option value="">Choose status</option>{EVENT_DAY_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
    <Input className="h-8 max-w-xs" aria-label="Status correction reason" placeholder="Reason for correction" value={reason} onChange={(e) => vm.setValue(key, "reason", e.target.value)} />
    <Button size="sm" variant="outline" disabled={vm.busy || !status || !reason.trim()} onClick={() => void vm.correctStatus(row.requestId)}>Correct status</Button></div></div>;
}

function ContractVersions({ contracts, vm }: { contracts: ContractRow[]; vm: WorkflowViewModel }) {
  return <div className="rounded-lg bg-muted/30 p-3"><p className="mb-2 text-xs font-bold">Contract versions</p>{contracts.length ? contracts.map((contract) => <ContractVersionRow key={contract.id} contract={contract} vm={vm} />) : <p className="text-xs text-muted-foreground">No contract submitted yet.</p>}</div>;
}

function ContractVersionRow({ contract, vm }: { contract: ContractRow; vm: WorkflowViewModel }) {
  const reason = vm.value(contract.id, "reason");
  return <div className="flex flex-wrap items-center gap-2 border-b border-border py-2 last:border-0"><span className="mr-auto text-xs">v{contract.version} · {contract.fileName}</span><Button size="sm" variant="ghost" onClick={() => void vm.download(contract.storedObjectId)}>Download</Button><StatusBadge status={contract.reviewStatus} /><Input className="h-8 max-w-xs" value={reason} onChange={(e) => vm.setValue(contract.id, "reason", e.target.value)} placeholder="Review note / correction reason" />{contract.reviewStatus === "submitted" ? <><Button size="sm" variant="outline" disabled={vm.busy} onClick={() => void vm.decideContract(contract.id, "accepted")}>Accept</Button><Button size="sm" variant="outline" disabled={vm.busy || !reason.trim()} onClick={() => void vm.decideContract(contract.id, "changes_requested")}>Request correction</Button></> : null}</div>;
}

function CreativeTasks({ row, vm }: { row: WorkflowRow; vm: WorkflowViewModel }) {
  const key = `task:${row.requestId}`;
  const title = vm.value(key, "title");
  const brief = vm.value(key, "brief");
  return <div className="rounded-lg bg-muted/30 p-3"><p className="mb-2 text-xs font-bold">Creative / production subtasks</p><div className="grid gap-2 sm:grid-cols-2"><Input placeholder="Deliverable title" value={title} onChange={(e) => vm.setValue(key, "title", e.target.value)} /><Input type="datetime-local" aria-label="Deliverable due date" value={vm.value(key, "dueAt")} onChange={(e) => vm.setValue(key, "dueAt", e.target.value)} /></div><textarea className="mt-2 min-h-20 w-full rounded-lg border border-border bg-background p-2 text-sm" placeholder="Brief and acceptance criteria for this supplier" value={brief} onChange={(e) => vm.setValue(key, "brief", e.target.value)} /><Button className="mt-2" size="sm" disabled={vm.busy || !title.trim() || !brief.trim()} onClick={() => void vm.assignTask(row.requestId)}>Assign deliverable</Button><div className="mt-3 space-y-2">{row.creativeTasks.map((task) => <CreativeTaskCard key={task.id} task={task} vm={vm} />)}</div></div>;
}

function CreativeTaskCard({ task, vm }: { task: CreativeTask; vm: WorkflowViewModel }) {
  const reviewNote = vm.value(task.id, "reviewNote");
  return <div className="rounded-lg border border-border bg-background p-3"><div className="flex flex-wrap justify-between gap-2"><p className="text-xs font-bold">{task.title}</p><StatusBadge status={task.status} /></div><p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{task.brief}</p>{task.supplierProgressNote ? <p className="mt-1 text-xs">Supplier progress: {task.supplierProgressNote}</p> : null}<TaskSubmissions task={task} vm={vm} />{task.status === "submitted" ? <div className="mt-2 flex flex-wrap gap-2"><Input className="h-8 max-w-xs" placeholder="Review note" value={reviewNote} onChange={(e) => vm.setValue(task.id, "reviewNote", e.target.value)} /><Button size="sm" disabled={vm.busy || !reviewNote.trim()} onClick={() => void vm.decideTask(task.id, "accepted")}>Accept</Button><Button size="sm" variant="outline" disabled={vm.busy || !reviewNote.trim()} onClick={() => void vm.decideTask(task.id, "changes_requested")}>Request revision</Button></div> : null}</div>;
}

function TaskSubmissions({ task, vm }: { task: CreativeTask; vm: WorkflowViewModel }) {
  return <>{task.submissions.map((submission) => <div key={submission.id} className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>Submitted v{submission.version}: {submission.note}</span>{submission.storedObjectId ? <Button size="sm" variant="ghost" onClick={() => void vm.download(submission.storedObjectId!)}>Download submission</Button> : null}</div>)}</>;
}

function PayableMilestones({ row, quote, vm }: { row: WorkflowRow; quote?: PrismSupplierQuote; vm: WorkflowViewModel }) {
  const key = `payable:${row.requestId}`;
  return <div className="rounded-lg bg-muted/30 p-3"><p className="mb-2 text-xs font-bold">Supplier payable milestones</p>{quote ? <><div className="grid gap-2 sm:grid-cols-3"><Input placeholder="Milestone name" value={vm.value(key, "label")} onChange={(e) => vm.setValue(key, "label", e.target.value)} /><Input type="number" min="1" step="1" placeholder="Amount" value={vm.value(key, "amount")} onChange={(e) => vm.setValue(key, "amount", e.target.value)} /><DatePicker aria-label="Payable due date" value={vm.value(key, "dueDate")} onValueChange={(value) => vm.setValue(key, "dueDate", value)} /></div><Button className="mt-2" size="sm" disabled={vm.busy || !vm.value(key, "label").trim() || !Number.isInteger(Number(vm.value(key, "amount"))) || Number(vm.value(key, "amount")) <= 0} onClick={() => void vm.addPayable(row.requestId, quote)}>Add milestone</Button></> : <p className="text-xs text-muted-foreground">A selected quote is required before adding a payable.</p>}<div className="mt-3 space-y-2">{row.payables.map((milestone) => <PayableMilestoneCard key={milestone.id} milestone={milestone} vm={vm} />)}</div></div>;
}

function PayableMilestoneCard({ milestone, vm }: { milestone: PayableMilestone; vm: WorkflowViewModel }) {
  return <div className="rounded-lg border border-border bg-background p-3"><div className="flex flex-wrap justify-between gap-2 text-xs"><strong>{milestone.label} · {money(milestone.amount)}</strong><StatusBadge status={milestone.status} /></div><p className="mt-1 text-xs text-muted-foreground">Released {money(milestone.amountReleased)} · Remaining {money(milestone.remainingBalance)}</p>{milestone.remainingBalance > 0 ? <PayoutReleaseForm milestone={milestone} vm={vm} /> : null}<div className="mt-2 divide-y divide-border">{milestone.history.map((record) => <PayableHistoryRow key={record.id} record={record} milestone={milestone} vm={vm} />)}</div></div>;
}

function PayoutReleaseForm({ milestone, vm }: { milestone: PayableMilestone; vm: WorkflowViewModel }) {
  const amount = vm.value(milestone.id, "amount");
  const paymentDate = vm.value(milestone.id, "paymentDate");
  const method = vm.value(milestone.id, "method");
  const canSubmit = Number.isInteger(Number(amount)) && Number(amount) > 0 && Boolean(paymentDate) && Boolean(method.trim());
  return <div className="mt-2 grid gap-2 sm:grid-cols-4"><Input type="number" min="1" step="1" placeholder="Release amount" value={amount} onChange={(e) => vm.setValue(milestone.id, "amount", e.target.value)} /><DatePicker aria-label="Payment date" value={paymentDate} onValueChange={(value) => vm.setValue(milestone.id, "paymentDate", value)} /><Input placeholder="Method" value={method} onChange={(e) => vm.setValue(milestone.id, "method", e.target.value)} /><Input placeholder="Reference number" value={vm.value(milestone.id, "referenceNumber")} onChange={(e) => vm.setValue(milestone.id, "referenceNumber", e.target.value)} /><Button size="sm" disabled={vm.busy || !canSubmit} onClick={() => void vm.releasePayout(milestone.id)}>Record release</Button></div>;
}

function PayableHistoryRow({ record, milestone, vm }: { record: PayableRecord; milestone: PayableMilestone; vm: WorkflowViewModel }) {
  const canReverse = record.kind === "release" && !milestone.history.some((entry) => entry.reversesRecordId === record.id);
  const reason = vm.value(record.id, "reverseReason");
  return <div className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs"><span>{record.kind} · {money(record.amount)} · {record.method} {record.referenceNumber}{record.notes ? ` · ${record.notes}` : ""}</span>{canReverse ? <div className="flex items-center gap-2"><Input className="h-8 w-52" aria-label="Reversal reason" placeholder="Reason for reversal" value={reason} onChange={(e) => vm.setValue(record.id, "reverseReason", e.target.value)} /><Button size="sm" variant="ghost" disabled={vm.busy || !reason.trim()} onClick={() => void vm.reversePayout(record.id)}>Reverse</Button></div> : null}</div>;
}
