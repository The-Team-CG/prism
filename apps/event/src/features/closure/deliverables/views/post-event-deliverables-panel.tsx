"use client";
import type { PrismPostEventDocument } from "@prism/types";
import { Button } from "@/app/components/ui/button";
import { usePostEventDeliverablesViewModel } from "../view-models/use-post-event-deliverables-view-model";

export function PostEventDeliverablesPanel({ eventId, documents, archived = false }: { eventId: string; documents: PrismPostEventDocument[]; archived?: boolean }) {
  const vm = usePostEventDeliverablesViewModel(eventId, documents);
  return <section aria-label="Post-event deliverables" className="space-y-3 rounded-lg border border-border bg-card p-5">
    <h2 className="text-lg font-bold">Post-event deliverables</h2>
    <p className="text-sm text-muted-foreground">Confirm completion after reviewing each deliverable. The saved status feeds the closure gates.</p>
    {vm.error ? <p role="alert" className="text-sm text-destructive">{vm.error}</p> : null}
    {vm.documents.length ? vm.documents.map((document) => {
      const done = document.status === "submitted" || vm.completed.includes(document.id);
      return <div key={document.id} className="flex items-center justify-between gap-3 border-t border-border pt-3"><p className="text-sm font-medium">{document.title}</p>{done ? <p role="status" className="text-sm text-success">Complete</p> : <Button type="button" variant="outline" disabled={archived || Boolean(vm.busy)} onClick={() => void vm.complete(document.id)}>{vm.busy === document.id ? "Saving..." : "Mark complete"}</Button>}</div>;
    }) : <p className="text-sm text-muted-foreground">No post-event deliverables have been recorded for this event.</p>}
  </section>;
}
