"use client";

import { Card } from "@prism/ui/components/card";
import { useClientFloorplanReview } from "../view-models/use-client-floorplan-review";
import type { ReviewRoom } from "../model/floorplan-annotation-geometry";
import { FloorplanReviewCanvas } from "./floorplan-review-canvas";
import { LoadingState } from "@prism/ui/components/loading-state";

type ReviewViewModel = ReturnType<typeof useClientFloorplanReview>;
type ReviewAnnotation = NonNullable<ReviewViewModel["review"]>["annotations"][number];

export function ClientFloorplanReviewPanel({ eventId, draftId, onDecided }: { eventId: string; draftId: string; onDecided?: () => Promise<void> }) {
  const vm = useClientFloorplanReview(eventId, draftId, onDecided);
  return <Card className="gap-4 p-5">
    <div><p className="text-xs font-semibold text-muted-foreground">Official PMCM floorplan</p><h2 className="mt-1 text-lg font-semibold">Review this submitted version</h2><p className="mt-1 text-sm text-muted-foreground">The canvas is read-only. Approval and versioned annotations apply only to this exact submitted version.</p></div>
    {vm.error && <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3"><p role="alert" className="text-sm text-danger">{vm.error}</p><button type="button" onClick={() => void vm.load()} disabled={vm.loading} className="rounded-md border border-border px-3 py-2 text-sm font-semibold disabled:opacity-50">Retry loading floorplan</button></div>}
    {vm.loading ? <LoadingState label="Loading current floorplan…" /> : vm.review ? <>
      <p className="text-xs text-muted-foreground">Version fingerprint: {vm.review.snapshotHash.slice(0, 12)}… · {vm.objects.length} layout object{vm.objects.length === 1 ? "" : "s"}</p>
      <div><h3 className="text-sm font-semibold">Layout</h3>{vm.objects.length ? <div className="mt-2"><FloorplanReviewCanvas room={vm.room} annotations={vm.review.annotations} pending={vm.anchor} canPlace={!vm.decision} onPlace={vm.setAnchor} /></div> : <p className="mt-1 text-sm text-muted-foreground">The submitted layout contains no placed objects.</p>}</div>
      <AnnotationList annotations={vm.review.annotations} room={vm.room} />
      {!vm.decision && <ReviewActions vm={vm} />}
    </> : null}
  </Card>;
}

function AnnotationList({ annotations, room }: { annotations: ReviewAnnotation[]; room: ReviewRoom }) {
  if (annotations.length === 0) return null;
  const objectLabel = (objectId: string) => room.objects.find((object) => object.id === objectId)?.name || `Object ${objectId}`;
  return <div className="space-y-2"><h3 className="text-sm font-semibold">Annotations for this version</h3>{annotations.map((item, index) => <p key={item.id} className="rounded-md border border-border p-3 text-sm">{item.anchorX !== undefined ? `${index + 1}. ` : ""}{item.nonBinding ? "Non-binding note · " : ""}{item.objectId ? `${objectLabel(item.objectId)}: ` : ""}{item.comment}</p>)}</div>;
}

function pinStatus(vm: ReviewViewModel) {
  if (!vm.anchor) return "Click the plan to pin your note (optional).";
  return vm.pinnedObject ? `Pinned to ${vm.pinnedObject.name || "this element"}.` : "Pinned to a spot on the plan.";
}

function ReviewActions({ vm }: { vm: ReviewViewModel }) {
  return <><form onSubmit={(event) => { event.preventDefault(); void vm.annotate(); }} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]"><p role="status" className="self-center text-xs text-muted-foreground">{pinStatus(vm)}{vm.anchor ? <button type="button" onClick={() => vm.setAnchor(null)} className="ml-2 underline">Clear pin</button> : null}</p><input aria-label="Floorplan annotation" required value={vm.annotation} onChange={(event) => vm.setAnnotation(event.target.value)} placeholder="Comment on this version" className="rounded-md border border-border bg-background px-3 py-2 text-sm" /><button disabled={vm.busy} className="rounded-md border border-border px-3 py-2 text-sm font-semibold">Add annotation</button></form>
      <textarea aria-label="Revision comment" value={vm.comment} onChange={(event) => vm.setComment(event.target.value)} placeholder="Explain the change if requesting a revision" className="w-full rounded-md border border-border bg-background p-3 text-sm" /><div className="flex flex-wrap gap-2"><button type="button" disabled={vm.busy} onClick={() => void vm.decide("approve")} className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Approve this version</button><button type="button" disabled={vm.busy || !vm.comment.trim()} onClick={() => void vm.decide("request_revision")} className="rounded-md border border-border px-3 py-2 text-sm font-semibold">Request revision</button></div></>;
}
