"use client";

import { useMemo, useState } from "react";
import { Check, MessageSquareText } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { Card, CardBody, CardHeader } from "../../shared/tab-ui";
import type { PrismClientReviewItem } from "@prism/types";
import { useClientReviewItems } from "../view-models/use-client-review-items";

export function ClientVenueStylingReview({ eventId }: { eventId: string }) {
  const { items, loading, busyItemId, error, decide } = useClientReviewItems(eventId);
  const latestVersions = useMemo(() => {
    const versions = new Map<string, number>();
    for (const item of items) versions.set(item.kind, Math.max(versions.get(item.kind) ?? 0, item.version));
    return versions;
  }, [items]);
  const venues = items.filter((item) => item.kind === "venue");
  const styling = items.filter((item) => item.kind === "styling");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquareText className="size-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Venue and styling review</h2>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">Review the options issued by PMCM. Your decision applies to that version only; a revised option will have its own review.</p>
      </CardHeader>
      <CardBody>
        {loading ? <p className="text-sm text-muted-foreground">Loading client review items…</p> : null}
        {error ? <p role="alert" className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
        {!loading && items.length === 0 ? <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">PMCM has not issued venue or styling options for review yet.</p> : null}
        <div className="space-y-5">
          {venues.length ? <ReviewGroup title="Venue options" items={venues} latestVersion={latestVersions.get("venue") ?? 0} busyItemId={busyItemId} onDecide={decide} /> : null}
          {styling.length ? <ReviewGroup title="Styling options" items={styling} latestVersion={latestVersions.get("styling") ?? 0} busyItemId={busyItemId} onDecide={decide} /> : null}
        </div>
      </CardBody>
    </Card>
  );
}

function ReviewGroup({
  title,
  items,
  latestVersion,
  busyItemId,
  onDecide,
}: {
  title: string;
  items: PrismClientReviewItem[];
  latestVersion: number;
  busyItemId: string | null;
  onDecide: (item: PrismClientReviewItem, action: "approve" | "request_revision", comment: string) => Promise<void>;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
      {items.map((item) => <ReviewItemCard key={item.id} item={item} isLatest={item.version === latestVersion} busy={busyItemId === item.id} onDecide={onDecide} />)}
    </section>
  );
}

function ReviewItemCard({
  item,
  isLatest,
  busy,
  onDecide,
}: {
  item: PrismClientReviewItem;
  isLatest: boolean;
  busy: boolean;
  onDecide: (item: PrismClientReviewItem, action: "approve" | "request_revision", comment: string) => Promise<void>;
}) {
  const [comment, setComment] = useState("");
  const decision = item.clientDecision;
  return (
    <article className="rounded-xl border border-border bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold text-foreground">{item.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Version {item.version}{item.budgetRange ? ` · ${item.budgetRange}` : ""}</p>
        </div>
        {decision ? <StatusBadge status={decision.action === "approve" ? "approved" : "attention"} label={decision.action === "approve" ? "Approved by you" : "Revision requested"} /> : isLatest ? <StatusBadge status="ready" label="Your review needed" /> : <StatusBadge status="pending" label="Earlier version" />}
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.summary}</p>
      {decision?.comment ? <p className="mt-3 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">Your note: {decision.comment}</p> : null}
      {!decision && isLatest ? (
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-semibold text-muted-foreground">Note for PMCM (required to request a revision)
            <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={4000} className="mt-1.5 min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-foreground" placeholder="Add a comment or explain what should change." />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void onDecide(item, "approve", comment)} className="rounded-lg font-bold"><Check className="size-4" /> Approve option</Button>
            <Button disabled={busy || !comment.trim()} variant="outline" onClick={() => void onDecide(item, "request_revision", comment)} className="rounded-lg font-semibold">Request revision</Button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
