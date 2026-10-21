"use client";

import { useCallback, useEffect, useState } from "react";
import type { PrismClientCloseoutResponse } from "@prism/types";
import { clientTestimonialRepository } from "../data/client-testimonial-repository";

export function ClientTestimonialModerationPanel({ eventId }: { eventId: string }) {
  const [response, setResponse] = useState<(PrismClientCloseoutResponse & { actorEmail?: string | null }) | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setResponse(await clientTestimonialRepository.get(eventId)); setError(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load client feedback."); }
  }, [eventId]);
  useEffect(() => { void load(); }, [load]);
  const decide = async (action: "approve" | "reject") => {
    setBusy(true); setError(null);
    try { setResponse(await clientTestimonialRepository.moderate(eventId, { action, reason })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save moderation decision."); }
    finally { setBusy(false); }
  };
  return <section className="rounded-lg border border-border bg-card p-5"><h2 className="text-lg font-bold">Client feedback and testimonial</h2><p className="mt-1 text-sm text-muted-foreground">Client feedback remains private. A testimonial can only be approved when the client gave explicit consent.</p>{error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}<ModerationFeedback response={response} reason={reason} busy={busy} onReasonChange={setReason} onDecide={decide} /></section>;
}

function ModerationFeedback({ response, reason, busy, onReasonChange, onDecide }: { response: (PrismClientCloseoutResponse & { actorEmail?: string | null }) | null; reason: string; busy: boolean; onReasonChange: (value: string) => void; onDecide: (action: "approve" | "reject") => Promise<void> }) {
  if (!response) return <p className="mt-4 text-sm text-muted-foreground">No client feedback has been submitted yet.</p>;
  return <div className="mt-4 rounded-md border border-border p-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">Rating {response.rating}/5 {response.actorEmail ? `· ${response.actorEmail}` : ""}</p><p className="text-xs text-muted-foreground">{response.moderationStatus}</p></div><p className="mt-3 whitespace-pre-wrap text-sm">{response.feedback || "No written feedback."}</p><h3 className="mt-4 text-sm font-semibold">Testimonial</h3><p className="mt-1 whitespace-pre-wrap text-sm">{response.testimonial || "No testimonial submitted."}</p><p className="mt-2 text-xs text-muted-foreground">Consent: {response.testimonialConsent ? "Given" : "Not given"}</p>{response.moderationStatus === "pending" ? <ModerationActions response={response} reason={reason} busy={busy} onReasonChange={onReasonChange} onDecide={onDecide} /> : null}</div>;
}

function ModerationActions({ response, reason, busy, onReasonChange, onDecide }: { response: PrismClientCloseoutResponse; reason: string; busy: boolean; onReasonChange: (value: string) => void; onDecide: (action: "approve" | "reject") => Promise<void> }) {
  return <div className="mt-4 flex flex-wrap gap-2"><input value={reason} onChange={(event) => onReasonChange(event.target.value)} placeholder="Reason if rejecting" className="min-w-56 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm" /><button type="button" disabled={busy || !response.testimonialConsent || !response.testimonial.trim()} onClick={() => void onDecide("approve")} className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Approve testimonial</button><button type="button" disabled={busy || !reason.trim()} onClick={() => void onDecide("reject")} className="rounded-md border border-border px-3 py-2 text-sm font-semibold">Reject</button></div>;
}
