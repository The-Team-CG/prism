"use client";
import { useEffect, useState } from "react";
import type { PrismPostEventDocument } from "@prism/types";
import { Button } from "@/app/components/ui/button";
import { wrapUpDeadlineCountdown } from "../model/wrap-up-deadline";
import { usePostEventDeliverablesViewModel } from "../view-models/use-post-event-deliverables-view-model";

const COUNTDOWN_TONE: Record<string, string> = { open: "text-muted-foreground", soon: "text-attention", overdue: "text-destructive" };

/** Re-reads the clock every minute so the countdown stays honest while the panel is open. */
function useMinuteClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function PostEventDeliverablesPanel({ eventId, documents, archived = false, actualEndedAt = null }: { eventId: string; documents: PrismPostEventDocument[]; archived?: boolean; actualEndedAt?: string | null }) {
  const vm = usePostEventDeliverablesViewModel(eventId, documents);
  const now = useMinuteClock();
  const anyOpen = vm.documents.some((document) => document.status !== "submitted" && !vm.completed.includes(document.id));
  const countdown = !archived && anyOpen ? wrapUpDeadlineCountdown(actualEndedAt, now) : null;
  return <section aria-label="Post-event deliverables" className="space-y-3 rounded-lg border border-border bg-card p-5">
    <h2 className="text-lg font-bold">Post-event deliverables</h2>
    <p className="text-sm text-muted-foreground">Confirm completion after reviewing each deliverable. The saved status feeds the closure gates.</p>
    {countdown ? <p role="timer" className={"text-sm font-semibold " + COUNTDOWN_TONE[countdown.tone]}>{countdown.label} · the wrap-up window closes 24 hours after the event ended.</p> : null}
    {vm.error ? <p role="alert" className="text-sm text-destructive">{vm.error}</p> : null}
    {vm.documents.length ? vm.documents.map((document) => {
      const done = document.status === "submitted" || vm.completed.includes(document.id);
      return <div key={document.id} className="flex items-center justify-between gap-3 border-t border-border pt-3"><p className="text-sm font-medium">{document.title}</p>{done ? <p role="status" className="text-sm text-success">Complete</p> : <Button type="button" variant="outline" disabled={archived || Boolean(vm.busy)} onClick={() => void vm.complete(document.id)}>{vm.busy === document.id ? "Saving..." : "Mark complete"}</Button>}</div>;
    }) : <p className="text-sm text-muted-foreground">No post-event deliverables have been recorded for this event.</p>}
  </section>;
}
