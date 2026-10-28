"use client";
import { formatPortalDate } from "@prism/ui/format-date";

import { useEffect, useState, type FormEvent } from "react";
import { useClientCloseout } from "../view-models/use-client-closeout";

export function ClientCloseoutView({ eventId, archived }: { eventId: string; archived: boolean }) {
  const vm = useClientCloseout(eventId);
  const workspace = vm.workspace?.eventId === eventId ? vm.workspace : null;
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
    if (archived) return;
    void vm.submitResponse({ rating, feedback, testimonial, testimonialConsent: consent });
  };
  if (!workspace) return <section className="rounded-xl border border-border bg-card p-5">{vm.error ?? "Loading closeout…"}</section>;
  return <section className="space-y-4 rounded-xl border border-border bg-card p-5">
    <div><p className="text-xs font-semibold text-muted-foreground">Event closeout</p><h2 className="mt-1 text-xl font-bold">Deliverables and feedback</h2><p className="mt-1 text-sm text-muted-foreground">Confirm receipt of the event documents and share feedback with the event team.</p></div>
    {vm.error && <p role="alert" className="text-sm text-danger">{vm.error}</p>}{vm.notice && <p role="status" className="text-sm text-success">{vm.notice}</p>}
    {archived && <p className="rounded-lg border border-border p-3 text-sm text-muted-foreground">This event is archived. Acknowledgements and feedback are read-only.</p>}
    <label className="block text-sm">Acknowledgement note (optional)<input disabled={archived} value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2" /></label>
    <WrapUpAcknowledgement wrapUp={workspace.wrapUp} busy={vm.busy} archived={archived} note={note} onAcknowledge={vm.acknowledgeWrapUp} />
    <DeliverablesAcknowledgement deliverables={workspace.deliverables} busy={vm.busy} archived={archived} note={note} onAcknowledge={vm.acknowledgeDeliverable} />
    <FeedbackForm response={response} rating={rating} feedback={feedback} testimonial={testimonial} consent={consent} busy={vm.busy} archived={archived} onRating={setRating} onFeedback={setFeedback} onTestimonial={setTestimonial} onConsent={setConsent} onSubmit={submit} />
    <TestimonialConsentStatus response={response} busy={vm.busy} onRevoke={vm.revokeConsent} />
  </section>;
}

type CloseoutWorkspace = NonNullable<ReturnType<typeof useClientCloseout>["workspace"]>;
function WrapUpAcknowledgement({ wrapUp, busy, archived, note, onAcknowledge }: { wrapUp: CloseoutWorkspace["wrapUp"]; busy: boolean; archived: boolean; note: string; onAcknowledge: (note: string) => Promise<void> }) {
  if (!wrapUp) return null;
  return <div className="rounded-lg border border-border p-4"><h3 className="font-semibold">Event team wrap-up</h3><p className="mt-1 text-sm text-muted-foreground">{wrapUp.status === "complete" ? "The team has completed its wrap-up." : "The team is preparing its wrap-up."}</p>{wrapUp.clientAcknowledgedAt ? <p className="mt-2 text-sm">Acknowledged {formatPortalDate(wrapUp.clientAcknowledgedAt)}</p> : <button type="button" disabled={archived || busy || wrapUp.status !== "complete"} onClick={() => void onAcknowledge(note)} className="mt-3 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Acknowledge wrap-up</button>}</div>;
}

function DeliverablesAcknowledgement({ deliverables, busy, archived, note, onAcknowledge }: { deliverables: CloseoutWorkspace["deliverables"]; busy: boolean; archived: boolean; note: string; onAcknowledge: (id: string, note: string) => Promise<void> }) {
  return <div className="space-y-2"><h3 className="font-semibold">Event deliverables</h3>{deliverables.length ? deliverables.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"><div><p className="text-sm font-medium">{item.title}</p><p className="text-xs text-muted-foreground">{item.status}{item.required ? " · required" : ""}</p></div>{item.acknowledgedAt ? <span className="text-xs text-muted-foreground">Acknowledged {formatPortalDate(item.acknowledgedAt)}</span> : <button type="button" disabled={archived || busy || item.status !== "submitted"} onClick={() => void onAcknowledge(item.id, note)} className="rounded-md border border-border px-3 py-2 text-xs font-semibold">Acknowledge receipt</button>}</div>) : <p className="text-sm text-muted-foreground">No deliverables have been issued yet.</p>}</div>;
}

function FeedbackForm({ response, rating, feedback, testimonial, consent, busy, archived, onRating, onFeedback, onTestimonial, onConsent, onSubmit }: { response: CloseoutWorkspace["response"]; rating: number; feedback: string; testimonial: string; consent: boolean; busy: boolean; archived: boolean; onRating: (value: number) => void; onFeedback: (value: string) => void; onTestimonial: (value: string) => void; onConsent: (value: boolean) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-border p-4"><h3 className="font-semibold">Your feedback</h3><label className="block text-sm">Rating<select disabled={archived} value={rating} onChange={(event) => onRating(Number(event.target.value))} className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2">{[5,4,3,2,1].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></label><label className="block text-sm">Feedback<textarea disabled={archived} value={feedback} onChange={(event) => onFeedback(event.target.value)} maxLength={4000} rows={4} className="mt-1 block w-full rounded-md border border-border bg-background p-3" /></label><label className="block text-sm">Optional testimonial<textarea disabled={archived} value={testimonial} onChange={(event) => onTestimonial(event.target.value)} maxLength={2000} rows={3} className="mt-1 block w-full rounded-md border border-border bg-background p-3" /></label><label className="flex items-start gap-2 text-sm"><input type="checkbox" disabled={archived} checked={consent} onChange={(event) => onConsent(event.target.checked)} className="mt-1" /><span>I explicitly consent to the event team considering this testimonial for publication. It will not be published automatically.</span></label><button type="submit" disabled={archived || busy} className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">{response ? "Update feedback" : "Submit feedback"}</button></form>;
}

function TestimonialConsentStatus({ response, busy, onRevoke }: { response: CloseoutWorkspace["response"]; busy: boolean; onRevoke: () => Promise<void> }) {
  if (!response?.testimonialConsent) return null;
  return <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"><p className="text-sm">Testimonial status: {response.moderationStatus}</p><button type="button" disabled={busy} onClick={() => void onRevoke()} className="rounded-md border border-border px-3 py-2 text-xs font-semibold">Withdraw testimonial consent</button></div>;
}
