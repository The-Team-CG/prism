"use client";

import { useId, useState, type ReactNode } from "react";
import { Ban, CheckCircle2, CircleSlash, Download, FileText, PencilLine, ShieldCheck, Trash2, type LucideIcon } from "lucide-react";
import type { PrismOwnPrivacyRequest } from "@prism/types";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Textarea } from "./components/ui/textarea";
import { LoadingState } from "./components/ui/loading-state";
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
  { value: "deletion", title: "Delete my data", name: "Deletion", description: "PMCM removes what it does not have to keep. You confirm first.", icon: Trash2, tile: "bg-danger-soft text-danger" },
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

const isOpen = (request: PrismOwnPrivacyRequest) => request.status === "submitted" || request.status === "approved";
const dayOf = (iso: string) => manilaCalendarKey(iso);

/** "Due Dec 7 · in 20 days" while open, red once the 30 days have passed. */
function DuePill({ dueAt, today }: { dueAt: string; today: string }) {
  const countdown = eventCountdown(dayOf(dueAt), today);
  const late = (countdown?.days ?? 0) < 0;
  const when = late ? `${-(countdown?.days ?? 0)} days late` : countdown?.label;
  return (
    <span className={cn("shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold", late ? "bg-danger-soft text-danger" : "bg-attention-soft text-attention")}>
      Due {formatPortalDate(dayOf(dueAt))}{when ? ` · ${when}` : ""}
    </span>
  );
}

function StepTrack({ step }: { step: number }) {
  return (
    <div aria-label={`Step ${step + 1} of ${PRIVACY_REQUEST_STEPS.length}: ${PRIVACY_REQUEST_STEPS[step]}`} role="img" className="mt-2.5 space-y-1">
      <div className="grid grid-cols-4 gap-1">
        {PRIVACY_REQUEST_STEPS.map((name, index) => <span key={name} className={cn("h-1.5 rounded-full", index < step ? "bg-primary" : index === step ? "bg-primary/55" : "bg-muted")} />)}
      </div>
      <div className="grid grid-cols-4 gap-1 text-[11px] text-muted-foreground">
        {PRIVACY_REQUEST_STEPS.map((name, index) => <span key={name} className={cn(index === step && "font-semibold text-foreground")}>{name}</span>)}
      </div>
    </div>
  );
}

function Tile({ icon: Icon, className }: { icon: LucideIcon; className: string }) {
  return <span aria-hidden className={cn("grid size-8 shrink-0 place-items-center rounded-lg", className)}><Icon className="size-4" /></span>;
}

export type PrivacyCancel = { busyId: string | null; error: string | null; run: (requestId: string) => void };

/** Withdraw, with one confirming step, while PMCM has not started. */
function CancelControl({ request, cancel }: { request: PrismOwnPrivacyRequest; cancel: PrivacyCancel }) {
  const [confirming, setConfirming] = useState(false);
  if (!request.cancellable) return null;
  if (!confirming) {
    return <Button type="button" variant="link" size="sm" className="mt-1 h-auto px-0 text-primary" onClick={() => setConfirming(true)}>Cancel request</Button>;
  }
  return (
    <div role="group" aria-label="Cancel this request?" className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Withdraw this request? PMCM stops working on it.</span>
      <Button type="button" size="sm" variant="destructive" disabled={cancel.busyId === request.id} onClick={() => cancel.run(request.id)}>{cancel.busyId === request.id ? "Cancelling…" : "Withdraw"}</Button>
      <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(false)}>Keep it</Button>
    </div>
  );
}

function OpenRequest({ request, today, cancel }: { request: PrismOwnPrivacyRequest; today: string; cancel: PrivacyCancel }) {
  const choice = choiceOf(request.type);
  return (
    <li className="flex gap-3 py-3 first:pt-0">
      <Tile icon={choice.icon} className={choice.tile} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm"><span className="font-semibold text-foreground">{choice.name}</span> <span className="text-xs text-muted-foreground">· sent {formatPortalDate(dayOf(request.submittedAt))}</span></p>
          <DuePill dueAt={request.dueAt} today={today} />
        </div>
        <StepTrack step={privacyRequestStep(request)} />
        <p className="mt-2 text-xs text-muted-foreground">{request.outcomeMessage}</p>
        <CancelControl request={request} cancel={cancel} />
      </div>
    </li>
  );
}

const CLOSED_LOOK: Record<string, { label: string; icon: LucideIcon; tile: string }> = {
  executed: { label: "Done", icon: CheckCircle2, tile: "bg-success-soft text-success" },
  rejected: { label: "Closed", icon: CircleSlash, tile: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelled", icon: Ban, tile: "bg-muted text-muted-foreground" },
};

function ClosedRequest({ request }: { request: PrismOwnPrivacyRequest }) {
  const look = CLOSED_LOOK[request.status] ?? CLOSED_LOOK.rejected;
  const closed = request.completedAt ? ` · ${look.label.toLowerCase()} ${formatPortalDate(dayOf(request.completedAt))}` : "";
  return (
    <li className="flex items-center gap-3 py-3">
      <Tile icon={look.icon} className={look.tile} />
      <div className="min-w-0 flex-1 text-sm">
        <p><span className="font-semibold text-foreground">{choiceOf(request.type).name}</span> <span className="text-xs text-muted-foreground">· sent {formatPortalDate(dayOf(request.submittedAt))}{closed}</span></p>
        <p className="text-xs text-muted-foreground">{request.outcomeMessage}</p>
      </div>
      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", request.status === "executed" ? "bg-success-soft text-success" : "bg-muted text-muted-foreground")}>{look.label}</span>
    </li>
  );
}

function Panel({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section aria-label={title} className="rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5">
      <h2 className="mb-3 flex items-baseline gap-2 text-base font-semibold text-foreground">{title}{count !== undefined ? <span className="text-sm font-normal tabular-nums text-muted-foreground">{count}</span> : null}</h2>
      {children}
    </section>
  );
}

/** Open requests first, each with its steps and due date; finished ones under them. */
function RequestList({ requests, today, cancel }: { requests: PrismOwnPrivacyRequest[]; today: string; cancel: PrivacyCancel }) {
  const open = requests.filter(isOpen);
  const closed = requests.filter((request) => !isOpen(request));
  return (
    <Panel title="Your requests" count={requests.length}>
      {cancel.error ? <p role="alert" className="mb-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{cancel.error}</p> : null}
      {open.length ? <ul className="divide-y divide-border">{open.map((request) => <OpenRequest key={request.id} request={request} today={today} cancel={cancel} />)}</ul> : null}
      {closed.length ? (
        <div className={cn(open.length > 0 && "mt-1 border-t border-border pt-2")}>
          {open.length ? <p className="pt-1 text-xs font-medium text-muted-foreground">Earlier</p> : null}
          <ul className="divide-y divide-border">{closed.map((request) => <ClosedRequest key={request.id} request={request} />)}</ul>
        </div>
      ) : null}
    </Panel>
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
  submit: () => void;
};

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

/** What deleting does and does not remove, said before the request is sent. */
function DeletionConfirm({ draft, onBack }: { draft: PrivacyDraft; onBack: () => void }) {
  return (
    <div role="group" aria-label="Confirm deletion" className="mt-3 space-y-2 rounded-lg border border-danger/30 bg-danger-soft/60 p-3 text-sm">
      <p className="font-semibold text-foreground">Before you ask PMCM to delete your data</p>
      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
        <li>PMCM removes your name, contact details and messages from its records.</li>
        <li>Billing records, signed agreements and anything tied to an event that is still running stay for as long as the law requires.</li>
        <li>Once it is done you can no longer sign in.</li>
      </ul>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" variant="destructive" disabled={draft.busy} onClick={draft.submit}>{draft.busy ? "Sending…" : "Ask PMCM to delete my data"}</Button>
        <Button type="button" variant="outline" onClick={onBack}>Back</Button>
      </div>
    </div>
  );
}

/** The requester's own password, which stands in for an ID: it confirms who they are and is never stored. */
function PasswordField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <div className="max-w-sm space-y-1 text-sm">
      <label htmlFor={id} className="block font-medium text-foreground">Your password</label>
      <Input id={id} type="password" autoComplete="current-password" value={value} onChange={(event) => onChange(event.target.value)} required maxLength={200} aria-describedby={`${id}-hint`} />
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">Confirms it is you, so PMCM can start without asking for an ID. It is never stored.</p>
    </div>
  );
}

function RequestForm({ draft }: { draft: PrivacyDraft }) {
  const [confirmingDeletion, setConfirmingDeletion] = useState(false);
  const needsDetails = draft.type === "correction";
  const choose = (type: PrivacyRequestChoice) => { setConfirmingDeletion(false); draft.setType(type); };
  const send = () => (draft.type === "deletion" ? setConfirmingDeletion(true) : draft.submit());
  return (
    <Panel title="New request">
      <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); send(); }}>
        <ChoiceCards value={draft.type} onChange={choose} />
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-foreground">{needsDetails ? "What is wrong, and what should it say?" : "Anything PMCM should know (optional)"}</span>
          <Textarea value={draft.details} onChange={(event) => draft.setDetails(event.target.value)} maxLength={1000} rows={3} required={needsDetails} />
        </label>
        <PasswordField value={draft.password} onChange={draft.setPassword} />
        {draft.error ? <p role="alert" className="text-sm text-danger">{draft.error}</p> : null}
        {confirmingDeletion ? <DeletionConfirm draft={draft} onBack={() => setConfirmingDeletion(false)} /> : (
          <Button type="submit" disabled={draft.busy}>{draft.busy ? "Sending…" : draft.type === "deletion" ? "Continue" : "Send request"}</Button>
        )}
        <p className="text-xs text-muted-foreground">PMCM finishes each request within 30 days.</p>
      </form>
    </Panel>
  );
}

export type PrivacyNoticeRecord = { version: string | null; acknowledgedAt: string | null; href: string };

/** A notice version is its publication date (2026-10-25); anything else is shown as written. */
const noticeName = (version: string) => (/^\d{4}-\d{2}-\d{2}$/.test(version) ? `Privacy notice of ${formatPortalDate(version)}` : `Privacy notice ${version}`);

function NoticeLine({ notice }: { notice: PrivacyNoticeRecord }) {
  const accepted = notice.version && notice.acknowledgedAt ? `${noticeName(notice.version)} · you accepted it ${formatPortalDate(dayOf(notice.acknowledgedAt))}` : "PMCM's privacy notice";
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <ShieldCheck aria-hidden className="size-3.5" />{accepted} ·
      <a href={notice.href} className="font-semibold text-primary hover:underline">Read it again</a>
    </p>
  );
}

/**
 * A client's or supplier's privacy page: their requests with where each stands, then a new request in plain words,
 * then the notice they accepted. Role-neutral: portals pass their own data and actions.
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
  return (
    <div className="space-y-4">
      {loading ? <LoadingState label="Loading your privacy requests…" /> : null}
      {loadError ? <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{loadError}</p> : null}
      {requests.length ? <RequestList requests={requests} today={today} cancel={cancel} /> : null}
      <RequestForm draft={draft} />
      {notice ? <NoticeLine notice={notice} /> : null}
    </div>
  );
}
