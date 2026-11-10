"use client";

import { Button } from "@prism/ui/components/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { usePmcmClientReviewPanel } from "../view-models/use-pmcm-client-review-panel";
import { ClientReviewHistory } from "./client-review-history";
import { MoodboardUploader } from "./moodboard-uploader";

export function PmcmClientReviewPanel({ eventId }: { eventId: string }) {
  const vm = usePmcmClientReviewPanel(eventId);
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">Client venue and styling reviews</h2>
      <p className="mt-1 text-sm text-muted-foreground">Issue a new version when a proposal changes. Each client decision is tied to the version shown.</p>
      {vm.error && <p role="alert" className="mt-3 text-sm text-destructive">{vm.error}</p>}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {vm.latestByKind.map((item) => item ? (
          <article key={item.id} className="rounded-md border border-border p-3">
            <p className="text-xs font-semibold capitalize text-muted-foreground">{item.kind} · version {item.version}</p>
            <h3 className="mt-1 font-semibold">{item.title}</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm">{item.summary}</p>
            {item.budgetRange && <p className="mt-2 text-xs text-muted-foreground">Budget: {item.budgetRange}</p>}
            <p className="mt-2 text-xs font-semibold">Client decision: {item.clientDecision?.action?.replaceAll("_", " ") ?? "Awaiting response"}{item.clientDecision?.comment ? ` · ${item.clientDecision.comment}` : ""}</p>
            {item.kind === "styling" ? <MoodboardUploader eventId={eventId} itemId={item.id} /> : null}
          </article>
        ) : null)}
      </div>
      <form onSubmit={vm.issue} className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="text-sm">
          <span id="client-review-kind-label">Type</span>
          <Select value={vm.kind} onValueChange={(next) => vm.setKind(next as "venue" | "styling")}>
            <SelectTrigger aria-labelledby="client-review-kind-label" className="mt-1 w-full min-w-0 bg-background text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="venue">Venue</SelectItem>
              <SelectItem value="styling">Styling</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="text-sm">Budget range<input value={vm.budgetRange} onChange={(event) => vm.setBudgetRange(event.target.value)} className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2" /></label>
        <label className="text-sm md:col-span-2">Proposal title<input required value={vm.title} onChange={(event) => vm.setTitle(event.target.value)} className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2" /></label>
        <label className="text-sm md:col-span-2">Proposal details<textarea required rows={3} value={vm.summary} onChange={(event) => vm.setSummary(event.target.value)} className="mt-1 block w-full rounded-md border border-border bg-background p-3" /></label>
        <div>
          <Button type="submit" disabled={vm.busy}>{vm.busy ? "Issuing…" : "Issue new version"}</Button>
        </div>
      </form>
      <ClientReviewHistory items={vm.items} />
    </section>
  );
}
