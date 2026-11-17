"use client";

import { useId, useState, type ReactNode } from "react";
import { Ban, CheckCircle2, ChevronRight, CircleSlash, Download, FileText, PencilLine, Plus, ShieldCheck, Trash2, type LucideIcon } from "lucide-react";
import type { PrismOwnPrivacyRequest } from "@prism/types";
import { Button } from "./components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./components/ui/dialog";
import { Input } from "./components/ui/input";
import { LoadingState } from "./components/ui/loading-state";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "./components/ui/sheet";
import { Textarea } from "./components/ui/textarea";
import { eventCountdown } from "./event-cards/event-card-model";
import { formatPortalDate, manilaCalendarKey } from "./format-date";
import { cn } from "./utils";

export type PrivacyRequestChoice = "access" | "export" | "correction" | "deletion";

type ChoiceLook = { value: PrivacyRequestChoice; title: string; name: string; description: string; icon: LucideIcon; tile: string };

/** The four things a person can ask PMCM, in plain words, with the icon and colour each one keeps on every portal. */
export const PRIVACY_REQUEST_CHOICES: readonly ChoiceLook[] = [
  { value: "access", title: "Get a copy of my data", name: "Copy of my data", description: "Everything PMCM holds about you, checked by PMCM first.", icon: FileText, tile: "bg-info-soft text-info" },
  { value: "export", title: "Export my data", name: "Data export", description: "Your data as a file you can take to another service.", icon: Download, tile: "bg-primary-soft text-primary" },
  { value: "correction", title: "Correct something", name: "Correction", description: "A name, number or other detail that is wrong.", icon: PencilLine, tile: "bg-attention-soft text-attention" },
  { value: "deletion", title: "Delete my data", name: "Deletion", description: "PMCM removes what it does not have to keep.", icon: Trash2, tile: "bg-danger-soft text-danger" },
];

const choiceOf = (type: string) => PRIVACY_REQUEST_CHOICES.find((choice) => choice.value === type) ?? PRIVACY_REQUEST_CHOICES[0];

/** The four steps every request goes through, in the requester's words. */
export const PRIVACY_REQUEST_STEPS = ["Sent", "Identity check", "In progress", "Done"] as const;

/**
 * Where an open request is. Identity is checked first: a request the requester confirmed with their password has
 * passed it already, so it waits on PMCM; otherwise it waits on the identity check. Approved means PMCM is on it.
 */
export function privacyRequestStep(request: Pick<PrismOwnPrivacyRequest, "status" | "identityConfirmedAt">): number {
  if (request.status === "submitted") return request.identityConfirmedAt ? 2 : 1;
  if (request.status === "approved") return 2;
  return 3;
}

/** The step in words on a request's row: who it is waiting on. */
function stepWords(request: PrismOwnPrivacyRequest): string {
  if (request.status === "approved") return "In progress";
  return request.identityConfirmedAt ? "With PMCM" : "Identity check";
}

const isOpen = (request: PrismOwnPrivacyRequest) => request.status === "submitted" || request.status === "approved";
const dayOf = (iso: string) => manilaCalendarKey(iso);

/** Calm while the 30 days are far off, orange in the last week, red once late: the calendar's countdown tones. */
function DuePill({ dueAt, today }: { dueAt: string; today: string }) {
  const days = eventCountdown(dayOf(dueAt), today)?.days ?? 0;
  const when = days < 0 ? `${-days} ${days === -1 ? "day" : "days"} late` : eventCountdown(dayOf(dueAt), today)?.label;
  const tone = days < 0 ? "bg-danger-soft text-danger" : days <= 7 ? "bg-attention-soft text-attention" : "bg-muted text-muted-foreground";
  return <span className={cn("shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold", tone)}>Due {formatPortalDate(dayOf(dueAt))}{when ? ` · ${when}` : ""}</span>;
}

function StepDots({ step }: { step: number }) {
  return (
    <span aria-hidden className="mt-1.5 flex gap-1">
      {PRIVACY_REQUEST_STEPS.map((name, index) => <span key={name} className={cn("h-1 w-5 rounded-full", index < step ? "bg-primary" : index === step ? "bg-primary/55" : "bg-muted")} />)}
    </span>
  );
}

/** The full track with every step named, for the details panel. */
function StepTrack({ step }: { step: number }) {
  return (
    <div aria-label={`Step ${step + 1} of ${PRIVACY_REQUEST_STEPS.length}: ${PRIVACY_REQUEST_STEPS[step]}`} role="img" className="space-y-1">
      <div className="grid grid-cols-4 gap-1">
        {PRIVACY_REQUEST_STEPS.map((name, index) => <span key={name} className={cn("h-1.5 rounded-full", index < step ? "bg-primary" : index === step ? "bg-primary/55" : "bg-muted")} />)}
      </div>
      <div className="grid grid-cols-4 gap-1 text-[11px] text-muted-foreground">
        {PRIVACY_REQUEST_STEPS.map((name, index) => <span key={name} className={cn(index === step && "font-semibold text-foreground")}>{name}</span>)}
      </div>
    </div>
  );
}

/** A request's due date, calm until its last week; shared with PMCM's queue. */
export { DuePill as PrivacyDuePill };

export function Tile({ icon: Icon, className }: { icon: LucideIcon; className: string }) {
  return <span aria-hidden className={cn("grid size-8 shrink-0 place-items-center rounded-lg", className)}><Icon className="size-4" /></span>;
}

const CLOSED_LOOK: Record<string, { label: string; icon: LucideIcon; tile: string; pill: string }> = {
  executed: { label: "Done", icon: CheckCircle2, tile: "bg-success-soft text-success", pill: "bg-success-soft text-success" },
  rejected: { label: "Closed", icon: CircleSlash, tile: "bg-muted text-muted-foreground", pill: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelled", icon: Ban, tile: "bg-muted text-muted-foreground", pill: "bg-muted text-muted-foreground" },
};
const closedLookOf = (request: PrismOwnPrivacyRequest) => CLOSED_LOOK[request.status] ?? CLOSED_LOOK.rejected;

function sentLine(request: PrismOwnPrivacyRequest) {
  const closed = !isOpen(request) && request.completedAt ? ` · ${closedLookOf(request).label.toLowerCase()} ${formatPortalDate(dayOf(request.completedAt))}` : "";
  return `sent ${formatPortalDate(dayOf(request.submittedAt))}${closed}`;
}

/** One request as a row: what it is, a small track or how it ended, and its due date. Opens its details. */
function RequestRow({ request, today, onOpen }: { request: PrismOwnPrivacyRequest; today: string; onOpen: () => void }) {
  const choice = choiceOf(request.type);
  const open = isOpen(request);
  const closed = closedLookOf(request);
  return (
    <li>
      <button type="button" onClick={onOpen} aria-haspopup="dialog" className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Tile icon={open ? choice.icon : closed.icon} className={open ? choice.tile : closed.tile} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm"><span className="font-semibold text-foreground">{choice.name}</span> <span className="text-xs text-muted-foreground">· {sentLine(request)}</span></span>
          {open ? <StepDots step={privacyRequestStep(request)} /> : <span className="block truncate text-xs text-muted-foreground">{request.outcomeMessage}</span>}
          {/* On a phone the step and due date sit under the name instead of in a squeezed column. */}
          {open ? <span className="mt-1.5 flex flex-wrap items-center gap-2 sm:hidden"><span className="text-xs font-semibold text-foreground">{stepWords(request)}</span><DuePill dueAt={request.dueAt} today={today} /></span> : null}
        </span>
        {open ? (
          <span className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
            <span className="text-xs font-semibold text-foreground">{stepWords(request)}</span>
            <DuePill dueAt={request.dueAt} today={today} />
          </span>
        ) : <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", closed.pill)}>{closed.label}</span>}
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </li>
  );
}

export type PrivacyCancel = { busyId: string | null; error: string | null; run: (requestId: string) => void };

/** Withdraw, with one confirming step, while PMCM has not started. */
function CancelControl({ request, cancel }: { request: PrismOwnPrivacyRequest; cancel: PrivacyCancel }) {
  const [confirming, setConfirming] = useState(false);
  if (!request.cancellable) return null;
  if (!confirming) return <Button type="button" variant="outline" onClick={() => setConfirming(true)}>Cancel request</Button>;
  return (
    <div role="group" aria-label="Cancel this request?" className="flex flex-wrap items-center gap-2 text-sm">
      <span className="w-full text-muted-foreground">Withdraw this request? PMCM stops working on it.</span>
      <Button type="button" variant="destructive" disabled={cancel.busyId === request.id} onClick={() => cancel.run(request.id)}>{cancel.busyId === request.id ? "Cancelling…" : "Withdraw"}</Button>
      <Button type="button" variant="outline" onClick={() => setConfirming(false)}>Keep it</Button>
    </div>
  );
}

/** A request's details: the full track, its dates, what PMCM says, and withdrawing it while PMCM has not started. */
function RequestPanel({ request, today, cancel, onClose }: { request: PrismOwnPrivacyRequest | null; today: string; cancel: PrivacyCancel; onClose: () => void }) {
  return (
    <Sheet open={request !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      {request ? (
        <SheetContent className="gap-0 sm:max-w-md">
          <SheetHeader className="border-b border-border pr-12">
            <SheetTitle className="text-lg">{choiceOf(request.type).name}</SheetTitle>
            <SheetDescription className="flex flex-wrap items-center gap-2">{sentLine(request)}{isOpen(request) ? <DuePill dueAt={request.dueAt} today={today} /> : null}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 p-4 text-sm">
            {isOpen(request) ? <StepTrack step={privacyRequestStep(request)} /> : null}
            <p className="text-foreground">{request.outcomeMessage}</p>
            {cancel.error ? <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-danger">{cancel.error}</p> : null}
          </div>
          <SheetFooter><CancelControl request={request} cancel={cancel} /></SheetFooter>
        </SheetContent>
      ) : null}
    </Sheet>
  );
}

export type PrivacyDraft = {
  type: PrivacyRequestChoice;
  details: string;
  /** The requester's own password, which confirms it is them; never stored. */
  password: string;
  busy: boolean;
  error: string | null;
  setType: (type: PrivacyRequestChoice) => void;
  setDetails: (details: string) => void;
  setPassword: (password: string) => void;
  /** Sends the request; true once PMCM has it. */
  submit: () => Promise<boolean>;
};

const SEND_STEPS = ["What", "Details", "Confirm"] as const;

function StepNames({ step }: { step: number }) {
  return (
    <ol aria-label="Steps" className="flex gap-2 text-xs text-muted-foreground">
      {SEND_STEPS.map((name, index) => <li key={name} aria-current={index === step ? "step" : undefined} className={cn(index === step && "font-semibold text-foreground")}>{index + 1} {name}</li>)}
    </ol>
  );
}

function ChoiceCards({ value, onChange }: { value: PrivacyRequestChoice; onChange: (type: PrivacyRequestChoice) => void }) {
  return (
    <div role="radiogroup" aria-label="What do you want PMCM to do?" className="grid gap-2 sm:grid-cols-2">
      {PRIVACY_REQUEST_CHOICES.map((choice) => (
        <button key={choice.value} type="button" role="radio" aria-checked={value === choice.value} onClick={() => onChange(choice.value)}
          className={cn("flex gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", value === choice.value ? "border-primary bg-primary-soft shadow-[inset_0_0_0_1px_var(--primary)]" : "border-border hover:bg-muted/40")}>
          <Tile icon={choice.icon} className={choice.tile} />
          <span className="min-w-0"><span className="block text-sm font-semibold text-foreground">{choice.title}</span><span className="block text-xs text-muted-foreground">{choice.description}</span></span>
        </button>
      ))}
    </div>
  );
}

function DetailsStep({ draft }: { draft: PrivacyDraft }) {
  const id = useId();
  const required = draft.type === "correction";
  return (
    <div className="space-y-1 text-sm">
      <label htmlFor={id} className="block font-medium text-foreground">{required ? "What is wrong, and what should it say?" : "Anything PMCM should know (optional)"}</label>
      <Textarea id={id} value={draft.details} onChange={(event) => draft.setDetails(event.target.value)} maxLength={1000} rows={4} />
    </div>
  );
}

/** What deleting does and does not remove, said where the person confirms. */
function DeletionWarning() {
  return (
    <div className="space-y-1 rounded-lg border border-danger/30 bg-danger-soft/60 p-3 text-sm">
      <p className="font-semibold text-foreground">What deleting does</p>
      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
        <li>PMCM removes your name, contact details and messages from its records.</li>
        <li>Billing records, signed agreements and anything tied to an event that is still running stay for as long as the law requires.</li>
        <li>Once it is done you can no longer sign in.</li>
      </ul>
    </div>
  );
}

/** The requester's own password, which stands in for an ID: it confirms who they are and is never stored. */
function PasswordField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <div className="space-y-1 text-sm">
      <label htmlFor={id} className="block font-medium text-foreground">Your password</label>
      <Input id={id} type="password" autoComplete="current-password" value={value} onChange={(event) => onChange(event.target.value)} maxLength={200} aria-describedby={`${id}-hint`} />
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">Confirms it is you, so PMCM can start without asking for an ID. It is never stored.</p>
    </div>
  );
}

function ConfirmStep({ draft }: { draft: PrivacyDraft }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">You are asking PMCM to: <span className="font-semibold text-foreground">{choiceOf(draft.type).title.toLowerCase()}</span>. PMCM finishes within 30 days.</p>
      {draft.type === "deletion" ? <DeletionWarning /> : null}
      <PasswordField value={draft.password} onChange={draft.setPassword} />
      {draft.error ? <p role="alert" className="text-sm text-danger">{draft.error}</p> : null}
    </div>
  );
}

/** Whether the step's one question is answered, so Next or Send can be pressed. */
function stepReady(step: number, draft: PrivacyDraft): boolean {
  if (step === 1) return draft.type !== "correction" || draft.details.trim().length > 0;
  if (step === 2) return draft.password.length > 0 && !draft.busy;
  return true;
}

function nextLabel(step: number, draft: PrivacyDraft): string {
  if (step === 1 && draft.type !== "correction" && !draft.details.trim()) return "Skip";
  if (step < 2) return "Next";
  if (draft.busy) return "Sending…";
  return draft.type === "deletion" ? "Delete my data" : "Send request";
}

/** Sending a request: what, then any details, then confirm with the password, one question at a time. */
function NewRequestDialog({ open, draft, onClose, onSent }: { open: boolean; draft: PrivacyDraft; onClose: () => void; onSent: () => void }) {
  const [step, setStep] = useState(0);
  const close = () => { setStep(0); onClose(); };
  const advance = async () => {
    if (step < 2) return setStep(step + 1);
    if (await draft.submit()) { setStep(0); onSent(); }
  };
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent className="max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none">
        <DialogHeader>
          <DialogTitle>{step === 0 ? "New request" : choiceOf(draft.type).title}</DialogTitle>
          <DialogDescription asChild><div><StepNames step={step} /></div></DialogDescription>
        </DialogHeader>
        <form id="privacy-new-request" className="min-w-0" onSubmit={(event) => { event.preventDefault(); if (stepReady(step, draft)) void advance(); }}>
          {step === 0 ? <ChoiceCards value={draft.type} onChange={draft.setType} /> : null}
          {step === 1 ? <DetailsStep draft={draft} /> : null}
          {step === 2 ? <ConfirmStep draft={draft} /> : null}
        </form>
        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          {step > 0 ? <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>Back</Button> : <span />}
          <Button type="submit" form="privacy-new-request" variant={step === 2 && draft.type === "deletion" ? "destructive" : "default"} disabled={!stepReady(step, draft)}>{nextLabel(step, draft)}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Panel({ title, count, action, children }: { title: string; count?: number; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className="rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="flex items-baseline gap-2 text-base font-semibold text-foreground">{title}{count !== undefined ? <span className="text-sm font-normal tabular-nums text-muted-foreground">{count}</span> : null}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export type PrivacyNoticeRecord = { version: string | null; acknowledgedAt: string | null; href: string };

/** A notice version is its publication date (2026-10-25); anything else is shown as written. */
const noticeName = (version: string) => (/^\d{4}-\d{2}-\d{2}$/.test(version) ? `Privacy notice of ${formatPortalDate(version)}` : `Privacy notice ${version}`);

function NoticeLine({ notice }: { notice: PrivacyNoticeRecord }) {
  const accepted = notice.version && notice.acknowledgedAt ? `${noticeName(notice.version)} · you accepted it ${formatPortalDate(dayOf(notice.acknowledgedAt))}` : "PMCM's privacy notice";
  return (
    <p className="text-xs text-muted-foreground">
      <ShieldCheck aria-hidden className="mr-1.5 inline size-3.5 align-[-2px]" />{accepted} ·{" "}
      <a href={notice.href} className="font-semibold text-primary hover:underline">Read it again</a>
    </p>
  );
}

/** Open requests first, then finished ones. */
const byOpenFirst = (requests: PrismOwnPrivacyRequest[]) => [...requests.filter(isOpen), ...requests.filter((request) => !isOpen(request))];

/**
 * A client's or supplier's privacy page. It is about where their requests stand: each is a row that opens its
 * details, and sending a new one is a short dialog (what, details, confirm with the password). Role-neutral: portals
 * pass their own data and actions.
 */
export function PrivacyRequestsScreen({ requests, loading, loadError, draft, cancel, notice, today }: {
  requests: PrismOwnPrivacyRequest[];
  loading: boolean;
  loadError: string | null;
  draft: PrivacyDraft;
  cancel: PrivacyCancel;
  notice: PrivacyNoticeRecord | null;
  today: string;
}) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const newRequest = <Button type="button" onClick={() => { setSent(false); setSending(true); }}><Plus aria-hidden className="size-4" />New request</Button>;
  return (
    <div className="space-y-4">
      {loading ? <LoadingState label="Loading your privacy requests…" /> : null}
      {loadError ? <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{loadError}</p> : null}
      <Panel title="Your requests" count={requests.length || undefined} action={newRequest}>
        {sent ? <p role="status" className="mb-2 rounded-md bg-success-soft px-3 py-2 text-sm text-success">Sent. PMCM finishes each request within 30 days, and you get a notification as it moves on.</p> : null}
        {requests.length ? (
          <ul className="divide-y divide-border">{byOpenFirst(requests).map((request) => <RequestRow key={request.id} request={request} today={today} onOpen={() => setOpenId(request.id)} />)}</ul>
        ) : <p className="py-2 text-sm text-muted-foreground">No requests yet. Ask PMCM for a copy of your data, a correction, an export or a deletion, and follow it here.</p>}
      </Panel>
      {notice ? <NoticeLine notice={notice} /> : null}
      <NewRequestDialog open={sending} draft={draft} onClose={() => setSending(false)} onSent={() => { setSending(false); setSent(true); }} />
      <RequestPanel request={requests.find((request) => request.id === openId) ?? null} today={today} cancel={cancel} onClose={() => setOpenId(null)} />
    </div>
  );
}
