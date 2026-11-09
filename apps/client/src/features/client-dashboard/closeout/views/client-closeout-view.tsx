"use client";

import { useEffect, useState, type FormEvent } from "react";
import { formatPortalDate } from "@prism/ui/format-date";
import { Button } from "@prism/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@prism/ui/components/card";
import { Checkbox } from "@prism/ui/components/checkbox";
import { Field, FieldLabel } from "@prism/ui/components/field";
import { Input } from "@prism/ui/components/input";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@prism/ui/components/item";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { Textarea } from "@prism/ui/components/textarea";
import { useClientCloseout } from "../view-models/use-client-closeout";

const RATINGS = [5, 4, 3, 2, 1] as const;

export function ClientCloseoutView({ eventId, archived }: { eventId: string; archived: boolean }) {
  const vm = useClientCloseout(eventId);
  const workspace = vm.workspace?.eventId === eventId ? vm.workspace : null;
  const readOnly = archived || !workspace?.actualEndedAt;
  const response = workspace?.response ?? null;
  const [rating, setRating] = useState(response?.rating ?? 5);
  const [feedback, setFeedback] = useState(response?.feedback ?? "");
  const [testimonial, setTestimonial] = useState(response?.testimonial ?? "");
  const [consent, setConsent] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => {
    if (response) {
      setRating(response.rating);
      setFeedback(response.feedback);
      setTestimonial(response.testimonial);
      setConsent(response.testimonialConsent);
      return;
    }
    setRating(5);
    setFeedback("");
    setTestimonial("");
    setConsent(false);
    setNote("");
  }, [eventId, response]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (readOnly) return;
    void vm.submitResponse({ rating, feedback, testimonial, testimonialConsent: consent });
  };
  if (!workspace) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">{vm.error ?? "Loading closeout…"}</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Deliverables and feedback</CardTitle>
        <CardDescription>Confirm receipt of the event documents and share feedback with the event team.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {vm.error ? <p role="alert" className="text-sm text-danger">{vm.error}</p> : null}
        {vm.notice ? <p role="status" className="text-sm text-success">{vm.notice}</p> : null}
        {archived ? <p className="text-sm text-muted-foreground">This event is archived. Acknowledgements and feedback are read-only.</p> : null}
        {!workspace.actualEndedAt ? <p role="status" className="text-sm text-muted-foreground">Acknowledgements and feedback open after PMCM records the actual event end.</p> : null}
        <Field>
          <FieldLabel htmlFor="closeout-note">Acknowledgement note (optional)</FieldLabel>
          <Input id="closeout-note" disabled={readOnly} value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} />
        </Field>
        <WrapUpAcknowledgement wrapUp={workspace.wrapUp} busy={vm.busy} archived={readOnly} note={note} onAcknowledge={vm.acknowledgeWrapUp} />
        <DeliverablesAcknowledgement deliverables={workspace.deliverables} busy={vm.busy} archived={readOnly} note={note} onAcknowledge={vm.acknowledgeDeliverable} />
        <FeedbackForm response={response} rating={rating} feedback={feedback} testimonial={testimonial} consent={consent} busy={vm.busy} archived={readOnly} onRating={setRating} onFeedback={setFeedback} onTestimonial={setTestimonial} onConsent={setConsent} onSubmit={submit} />
        <TestimonialConsentStatus response={response} busy={vm.busy} onRevoke={vm.revokeConsent} />
      </CardContent>
    </Card>
  );
}

type CloseoutWorkspace = NonNullable<ReturnType<typeof useClientCloseout>["workspace"]>;

function WrapUpAcknowledgement({ wrapUp, busy, archived, note, onAcknowledge }: { wrapUp: CloseoutWorkspace["wrapUp"]; busy: boolean; archived: boolean; note: string; onAcknowledge: (note: string) => Promise<void> }) {
  if (!wrapUp) return null;
  return (
    <section aria-labelledby="closeout-wrap-up">
      <h3 id="closeout-wrap-up" className="mb-2 text-sm font-semibold text-foreground">Event team wrap-up</h3>
      <ItemGroup>
        <Item variant="outline">
          <ItemContent>
            <ItemDescription>{wrapUp.status === "complete" ? "The team has completed its wrap-up." : "The team is preparing its wrap-up. You can acknowledge this handoff while the remaining team checks are being completed."}</ItemDescription>
            {wrapUp.clientAcknowledgedAt ? <ItemTitle>Acknowledged {formatPortalDate(wrapUp.clientAcknowledgedAt)}</ItemTitle> : null}
            {!wrapUp.clientAcknowledgedAt && wrapUp.acknowledgementRecorded ? <ItemDescription>PMCM has already recorded an acknowledgement for this handoff.</ItemDescription> : null}
          </ItemContent>
          {!wrapUp.clientAcknowledgedAt && !wrapUp.acknowledgementRecorded ? (
            <ItemActions>
              <Button type="button" disabled={archived || busy} onClick={() => void onAcknowledge(note)}>Acknowledge wrap-up</Button>
            </ItemActions>
          ) : null}
        </Item>
      </ItemGroup>
    </section>
  );
}

function DeliverablesAcknowledgement({ deliverables, busy, archived, note, onAcknowledge }: { deliverables: CloseoutWorkspace["deliverables"]; busy: boolean; archived: boolean; note: string; onAcknowledge: (id: string, note: string) => Promise<void> }) {
  return (
    <section aria-labelledby="closeout-deliverables" className="space-y-2">
      <h3 id="closeout-deliverables" className="text-sm font-semibold text-foreground">Event deliverables</h3>
      {deliverables.length ? (
        <ItemGroup>
          {deliverables.map((item) => (
            <Item key={item.id} variant="outline" size="sm">
              <ItemContent>
                <ItemTitle>{item.title}</ItemTitle>
                <ItemDescription>{item.status}{item.required ? " · required" : ""}</ItemDescription>
              </ItemContent>
              <ItemActions>
                {item.acknowledgedAt ? (
                  <span className="text-xs text-muted-foreground">Acknowledged {formatPortalDate(item.acknowledgedAt)}</span>
                ) : item.acknowledgementRecorded ? (
                  <span className="text-xs text-muted-foreground">Acknowledgement recorded by PMCM</span>
                ) : (
                  <Button type="button" variant="outline" size="sm" disabled={archived || busy || item.status !== "submitted"} onClick={() => void onAcknowledge(item.id, note)}>
                    Acknowledge receipt
                  </Button>
                )}
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      ) : (
        <p className="text-sm text-muted-foreground">No deliverables have been issued yet.</p>
      )}
    </section>
  );
}

function FeedbackForm({ response, rating, feedback, testimonial, consent, busy, archived, onRating, onFeedback, onTestimonial, onConsent, onSubmit }: { response: CloseoutWorkspace["response"]; rating: number; feedback: string; testimonial: string; consent: boolean; busy: boolean; archived: boolean; onRating: (value: number) => void; onFeedback: (value: string) => void; onTestimonial: (value: string) => void; onConsent: (value: boolean) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4 border-t border-border pt-5">
      <h3 className="text-sm font-semibold text-foreground">Your feedback</h3>
      <Field>
        <FieldLabel htmlFor="closeout-rating">Rating</FieldLabel>
        <Select disabled={archived} value={String(rating)} onValueChange={(value) => onRating(Number(value))}>
          <SelectTrigger id="closeout-rating" className="w-full min-w-0 sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RATINGS.map((value) => <SelectItem key={value} value={String(value)}>{value} / 5</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="closeout-feedback">Feedback</FieldLabel>
        <Textarea id="closeout-feedback" disabled={archived} value={feedback} onChange={(event) => onFeedback(event.target.value)} maxLength={4000} rows={4} />
      </Field>
      <Field>
        <FieldLabel htmlFor="closeout-testimonial">Optional testimonial</FieldLabel>
        <Textarea id="closeout-testimonial" disabled={archived} value={testimonial} onChange={(event) => onTestimonial(event.target.value)} maxLength={2000} rows={3} />
      </Field>
      <div className="flex items-start gap-3">
        <Checkbox id="closeout-consent" disabled={archived} checked={consent} onCheckedChange={(checked) => onConsent(checked === true)} className="mt-0.5" />
        <FieldLabel htmlFor="closeout-consent" className="font-normal leading-5 text-muted-foreground">
          I explicitly consent to the event team considering this testimonial for publication. It will not be published automatically.
        </FieldLabel>
      </div>
      <Button type="submit" disabled={archived || busy}>{response ? "Update feedback" : "Submit feedback"}</Button>
    </form>
  );
}

function TestimonialConsentStatus({ response, busy, onRevoke }: { response: CloseoutWorkspace["response"]; busy: boolean; onRevoke: () => Promise<void> }) {
  if (!response?.testimonialConsent) return null;
  return (
    <ItemGroup>
      <Item variant="outline" size="sm">
        <ItemContent>
          <ItemTitle>Testimonial status: {response.moderationStatus}</ItemTitle>
        </ItemContent>
        <ItemActions>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void onRevoke()}>Withdraw testimonial consent</Button>
        </ItemActions>
      </Item>
    </ItemGroup>
  );
}
