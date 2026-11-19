"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, FileCheck2, Handshake, Star } from "lucide-react";
import { formatPortalDate } from "@prism/ui/format-date";
import { Button } from "@prism/ui/components/button";
import { Checkbox } from "@prism/ui/components/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@prism/ui/components/dialog";
import { Field, FieldLabel } from "@prism/ui/components/field";
import { Input } from "@prism/ui/components/input";
import { LoadingState } from "@prism/ui/components/loading-state";
import { Textarea } from "@prism/ui/components/textarea";
import { PrismEmptyLine, PrismSection } from "@prism/ui/page-blocks";
import { cn } from "@/app/components/ui/utils";
import { useClientCloseout } from "../view-models/use-client-closeout";

const RATINGS = [1, 2, 3, 4, 5] as const;

type CloseoutVm = ReturnType<typeof useClientCloseout>;
type CloseoutWorkspace = NonNullable<CloseoutVm["workspace"]>;
/** What the acknowledgement dialog is confirming. */
type AckTarget = { kind: "wrap-up"; title: string } | { kind: "deliverable"; id: string; title: string };

/**
 * After the event: what PMCM handed over, each confirmed from its own row, then the client's feedback. Nothing is
 * pre-filled, so a rating is always the client's own choice.
 */
export function ClientCloseoutView({ eventId, archived }: { eventId: string; archived: boolean }) {
  const vm = useClientCloseout(eventId);
  const workspace = vm.workspace?.eventId === eventId ? vm.workspace : null;
  const readOnly = archived || !workspace?.actualEndedAt;
  const response = workspace?.response ?? null;
  const [rating, setRating] = useState<number | null>(response?.rating ?? null);
  const [feedback, setFeedback] = useState(response?.feedback ?? "");
  const [testimonial, setTestimonial] = useState(response?.testimonial ?? "");
  const [consent, setConsent] = useState(false);
  const [ack, setAck] = useState<AckTarget | null>(null);
  useEffect(() => {
    setRating(response?.rating ?? null);
    setFeedback(response?.feedback ?? "");
    setTestimonial(response?.testimonial ?? "");
    setConsent(response?.testimonialConsent ?? false);
    setAck(null);
  }, [eventId, response]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (readOnly || rating === null) return;
    void vm.submitResponse({ rating, feedback, testimonial, testimonialConsent: consent });
  };
  if (!workspace) {
    return vm.error ? <p role="alert" className="text-sm text-danger">{vm.error}</p> : <LoadingState label="Loading closeout…" />;
  }
  return (
    <div className="space-y-6">
      {vm.error ? <p role="alert" className="text-sm text-danger">{vm.error}</p> : null}
      {vm.notice ? <p role="status" className="text-sm text-success">{vm.notice}</p> : null}
      {archived ? <p className="text-sm text-muted-foreground">This event is archived. What you confirmed and wrote stays here to read.</p> : null}
      {!workspace.actualEndedAt ? <p role="status" className="text-sm text-muted-foreground">You can confirm deliverables and leave feedback once PMCM records the end of the event.</p> : null}
      <Deliverables workspace={workspace} busy={vm.busy} readOnly={readOnly} onAcknowledge={setAck} />
      <FeedbackForm response={response} rating={rating} feedback={feedback} testimonial={testimonial} consent={consent} busy={vm.busy} readOnly={readOnly} onRating={setRating} onFeedback={setFeedback} onTestimonial={setTestimonial} onConsent={setConsent} onSubmit={submit} onRevoke={vm.revokeConsent} />
      <AcknowledgeDialog
        target={ack}
        busy={vm.busy}
        onClose={() => setAck(null)}
        onConfirm={async (note) => {
          if (!ack) return;
          await (ack.kind === "wrap-up" ? vm.acknowledgeWrapUp(note) : vm.acknowledgeDeliverable(ack.id, note));
          setAck(null);
        }}
      />
    </div>
  );
}

function AckState({ at, recorded }: { at: string | null; recorded?: boolean }) {
  if (at) return <span className="flex items-center gap-1 text-sm text-success"><CheckCircle2 aria-hidden className="size-4" />Confirmed {formatPortalDate(at)}</span>;
  if (recorded) return <span className="text-sm text-muted-foreground">Confirmed by PMCM</span>;
  return null;
}

function deliverableState(status: string) {
  return status === "submitted" ? "Ready for you" : "PMCM is preparing it";
}

function Deliverables({ workspace, busy, readOnly, onAcknowledge }: { workspace: CloseoutWorkspace; busy: boolean; readOnly: boolean; onAcknowledge: (target: AckTarget) => void }) {
  const { wrapUp, deliverables } = workspace;
  const rows = (wrapUp ? 1 : 0) + deliverables.length;
  const confirm = (target: AckTarget, enabled: boolean) => (
    <button type="button" disabled={readOnly || busy || !enabled} onClick={() => onAcknowledge(target)} className="text-sm font-medium text-primary hover:text-primary/80 disabled:text-muted-foreground">
      Confirm receipt
    </button>
  );
  return (
    <PrismSection id="closeout-deliverables" title="What PMCM handed over" count={rows || undefined} description="Confirm each one once you have it." headerOutside flush={rows > 0}>
      {rows === 0 ? <PrismEmptyLine icon={FileCheck2}>PMCM hasn&apos;t sent any deliverables yet.</PrismEmptyLine> : (
        <ul className="divide-y divide-border">
          {wrapUp ? (
            <li className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 px-4 py-3 sm:grid-cols-[2rem_minmax(0,1fr)_auto]">
              <span aria-hidden className="grid size-8 place-items-center rounded-md bg-muted text-muted-foreground"><Handshake className="size-4" /></span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">Event team wrap-up</span>
                <span className="block text-xs text-muted-foreground">{wrapUp.status === "complete" ? "The team has finished its wrap-up." : "The team is still finishing its checks."}</span>
              </span>
              <span className="col-start-2 sm:col-start-auto">
                <AckState at={wrapUp.clientAcknowledgedAt} recorded={wrapUp.acknowledgementRecorded} />
                {!wrapUp.clientAcknowledgedAt && !wrapUp.acknowledgementRecorded ? confirm({ kind: "wrap-up", title: "the event team wrap-up" }, true) : null}
              </span>
            </li>
          ) : null}
          {deliverables.map((item) => (
            <li key={item.id} className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 px-4 py-3 sm:grid-cols-[2rem_minmax(0,1fr)_auto]">
              <span aria-hidden className="grid size-8 place-items-center rounded-md bg-muted text-muted-foreground"><FileCheck2 className="size-4" /></span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">{item.title}</span>
                <span className="block text-xs text-muted-foreground">{deliverableState(item.status)}{item.required ? " · required" : ""}</span>
              </span>
              <span className="col-start-2 sm:col-start-auto">
                <AckState at={item.acknowledgedAt} recorded={item.acknowledgementRecorded} />
                {!item.acknowledgedAt && !item.acknowledgementRecorded ? confirm({ kind: "deliverable", id: item.id, title: item.title }, item.status === "submitted") : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </PrismSection>
  );
}

function AcknowledgeDialog({ target, busy, onClose, onConfirm }: { target: AckTarget | null; busy: boolean; onClose: () => void; onConfirm: (note: string) => Promise<void> }) {
  const [note, setNote] = useState("");
  useEffect(() => setNote(""), [target]);
  return (
    <Dialog open={target !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm you received {target?.title}?</DialogTitle>
          <DialogDescription>PMCM sees your confirmation and any note you add.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="closeout-note">Note for PMCM (optional)</FieldLabel>
          <Input id="closeout-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} />
        </Field>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="button" onClick={() => void onConfirm(note)} disabled={busy}>{busy ? "Confirming…" : "Confirm receipt"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FeedbackForm({ response, rating, feedback, testimonial, consent, busy, readOnly, onRating, onFeedback, onTestimonial, onConsent, onSubmit, onRevoke }: {
  response: CloseoutWorkspace["response"];
  rating: number | null;
  feedback: string;
  testimonial: string;
  consent: boolean;
  busy: boolean;
  readOnly: boolean;
  onRating: (value: number) => void;
  onFeedback: (value: string) => void;
  onTestimonial: (value: string) => void;
  onConsent: (value: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRevoke: () => Promise<void>;
}) {
  return (
    <PrismSection
      id="closeout-feedback-heading"
      title="Your feedback"
      description={response ? `Sent ${formatPortalDate(response.submittedAt)}. You can change it while the event is open.` : "How did PMCM do? Your answer goes to the event team."}
      headerOutside
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <fieldset disabled={readOnly}>
          <legend className="text-sm font-medium text-foreground">Rating</legend>
          <div role="radiogroup" aria-label="Rating" className="mt-2 flex gap-1">
            {RATINGS.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value} of 5`}
                onClick={() => onRating(value)}
                className="rounded-md p-1 text-muted-foreground/40 hover:text-attention disabled:hover:text-muted-foreground/40"
              >
                <Star aria-hidden className={cn("size-7", rating !== null && value <= rating && "fill-attention text-attention")} />
              </button>
            ))}
          </div>
        </fieldset>
        <Field>
          <FieldLabel htmlFor="closeout-feedback">Feedback</FieldLabel>
          <Textarea id="closeout-feedback" disabled={readOnly} value={feedback} onChange={(event) => onFeedback(event.target.value)} maxLength={4000} rows={4} />
        </Field>
        <Field>
          <FieldLabel htmlFor="closeout-testimonial">Optional testimonial</FieldLabel>
          <Textarea id="closeout-testimonial" disabled={readOnly} value={testimonial} onChange={(event) => onTestimonial(event.target.value)} maxLength={2000} rows={3} />
        </Field>
        <div className="flex items-start gap-3">
          <Checkbox id="closeout-consent" disabled={readOnly} checked={consent} onCheckedChange={(checked) => onConsent(checked === true)} className="mt-0.5" />
          <FieldLabel htmlFor="closeout-consent" className="font-normal leading-5 text-muted-foreground">
            PMCM may consider this testimonial for publication. Nothing is published without their review.
          </FieldLabel>
        </div>
        {response?.testimonialConsent ? (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            Testimonial review: {response.moderationStatus}
            <button type="button" disabled={busy} onClick={() => void onRevoke()} className="font-medium text-primary hover:text-primary/80">Withdraw testimonial consent</button>
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" disabled={readOnly || busy || rating === null}>{response ? "Update feedback" : "Send feedback"}</Button>
        </div>
      </form>
    </PrismSection>
  );
}
