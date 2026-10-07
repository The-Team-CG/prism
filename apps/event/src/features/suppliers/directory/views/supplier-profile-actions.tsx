"use client";

import { useEffect, useState } from "react";
import { createSupplierReliabilityNoteSchema, createSupplierReviewSchema, type PrismPmcmSupplierEngagement, type PrismPmcmSupplierProfile, type PrismSupplierCategory } from "@prism/types";
import { Button } from "@/app/components/ui/button";
import type { SupplierActionDraft } from "../use-cases/submit-supplier-action";
import type { SupplierActionResult } from "../use-cases/save-supplier-action";

type SubmitAction = (action: SupplierActionDraft) => Promise<SupplierActionResult>;

function eligibleEvents(engagements: PrismPmcmSupplierEngagement[], predicate: (engagement: PrismPmcmSupplierEngagement) => boolean) {
  return engagements.filter(predicate);
}

function EventChoice({ label, value, events, onChange }: { label: string; value: string; events: PrismPmcmSupplierEngagement[]; onChange: (eventId: string) => void }) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      <select required value={value} onChange={(event) => onChange(event.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground">
        <option value="">Choose an eligible event</option>
        {events.map((event) => <option key={event.eventId} value={event.eventId}>{event.event.name} · {event.event.date}</option>)}
      </select>
    </label>
  );
}

export function SupplierProfileActions({
  profile,
  categories,
  engagements,
  actionSaving,
  actionResult,
  onSubmit,
}: {
  profile: PrismPmcmSupplierProfile;
  categories: PrismSupplierCategory[];
  engagements: { items: PrismPmcmSupplierEngagement[] } | null;
  actionSaving: boolean;
  actionResult: SupplierActionResult | null;
  onSubmit: SubmitAction;
}) {
  const supplier = profile.supplier;
  const [editForm, setEditForm] = useState({ name: supplier.name, categoryId: supplier.categoryId, contactName: supplier.contactName, email: supplier.email, phone: supplier.phone, serviceInclusions: supplier.serviceInclusions, performanceNotes: supplier.performanceNotes });
  const [tierForm, setTierForm] = useState(() => ({ tier: "tier_1" as "tier_1" | "tier_2" | "pending_first_event", reason: "", eventId: "", idempotencyKey: crypto.randomUUID() }));
  const [reviewForm, setReviewForm] = useState(() => ({ eventId: "", rating: "4", notes: "", dimensionRatings: {} as Record<string, string>, idempotencyKey: crypto.randomUUID() }));
  const [noteForm, setNoteForm] = useState(() => ({ eventId: "", note: "", idempotencyKey: crypto.randomUUID() }));
  const [certificationForm, setCertificationForm] = useState({ fileName: "", documentType: "", issuer: "", expiresAt: "", status: "submitted", notes: "" });
  const engagementItems = engagements?.items ?? [];
  const reviewEvents = eligibleEvents(engagementItems, (engagement) => engagement.canReview);
  const promotionEvents = eligibleEvents(engagementItems, (engagement) => engagement.canPromote);
  const activeDimensions = profile.reviewDimensions.filter((dimension) => dimension.active);

  useEffect(() => {
    setEditForm({ name: supplier.name, categoryId: supplier.categoryId, contactName: supplier.contactName, email: supplier.email, phone: supplier.phone, serviceInclusions: supplier.serviceInclusions, performanceNotes: supplier.performanceNotes });
    setTierForm({ tier: supplier.tier === "tier_2" ? "tier_1" : "tier_2", reason: "", eventId: "", idempotencyKey: crypto.randomUUID() });
    setReviewForm({ eventId: "", rating: "4", notes: "", dimensionRatings: {}, idempotencyKey: crypto.randomUUID() });
    setNoteForm({ eventId: "", note: "", idempotencyKey: crypto.randomUUID() });
    setCertificationForm({ fileName: "", documentType: "", issuer: "", expiresAt: "", status: "submitted", notes: "" });
  }, [supplier.id]);

  useEffect(() => {
    const activeIds = new Set(profile.reviewDimensions.filter((dimension) => dimension.active).map((dimension) => dimension.id));
    setReviewForm((current) => {
      const dimensionRatings = Object.fromEntries(Object.entries(current.dimensionRatings).filter(([dimensionId]) => activeIds.has(dimensionId)));
      return Object.keys(dimensionRatings).length === Object.keys(current.dimensionRatings).length ? current : { ...current, dimensionRatings };
    });
  }, [profile.supplier.categoryId, profile.reviewDimensions]);

  async function saveProfile() {
    await onSubmit({ kind: "update", supplierId: supplier.id, input: editForm });
  }

  async function saveTier() {
    if (supplier.tier === "pending_first_event") {
      const result = await onSubmit({ kind: "promote", supplierId: supplier.id, input: { eventId: tierForm.eventId, tier: tierForm.tier, reason: tierForm.reason, idempotencyKey: tierForm.idempotencyKey } });
      if (result.saved) setTierForm((current) => ({ ...current, reason: "", eventId: "", idempotencyKey: crypto.randomUUID() }));
      return;
    }
    const result = await onSubmit({ kind: "tier", supplierId: supplier.id, input: { tier: tierForm.tier, reason: tierForm.reason } });
    if (result.saved) setTierForm((current) => ({ ...current, reason: "" }));
  }

  async function saveReview() {
    const dimensionRatings = Object.entries(reviewForm.dimensionRatings).filter(([, value]) => value).map(([dimensionId, rating]) => ({ dimensionId, rating: Number(rating) }));
    const input = { eventId: reviewForm.eventId, rating: Number(reviewForm.rating), notes: reviewForm.notes, dimensionRatings: dimensionRatings.length ? dimensionRatings : undefined, idempotencyKey: reviewForm.idempotencyKey };
    if (!createSupplierReviewSchema.safeParse(input).success) return;
    const result = await onSubmit({ kind: "review", supplierId: supplier.id, input });
    if (result.saved) setReviewForm({ eventId: "", rating: "4", notes: "", dimensionRatings: {}, idempotencyKey: crypto.randomUUID() });
  }

  async function saveReliabilityNote() {
    const input = { eventId: noteForm.eventId, note: noteForm.note, idempotencyKey: noteForm.idempotencyKey };
    if (!createSupplierReliabilityNoteSchema.safeParse(input).success) return;
    const result = await onSubmit({ kind: "reliability-note", supplierId: supplier.id, input });
    if (result.saved) setNoteForm({ eventId: "", note: "", idempotencyKey: crypto.randomUUID() });
  }

  async function saveCertification() {
    const result = await onSubmit({ kind: "certification", supplierId: supplier.id, input: certificationForm });
    if (result.saved) setCertificationForm({ fileName: "", documentType: "", issuer: "", expiresAt: "", status: "submitted", notes: "" });
  }

  const pendingPromotion = supplier.tier === "pending_first_event";

  return (
    <section aria-labelledby="supplier-actions-heading" className="space-y-3">
      <h3 id="supplier-actions-heading" className="text-sm font-semibold">Supplier actions</h3>
      <fieldset disabled={actionSaving || Boolean(actionResult?.saved && actionResult.refreshFailed)} className="min-w-0 space-y-2 disabled:opacity-70">
        <details className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">Edit supplier profile</summary>
          <div className="mt-3 grid gap-2">
            <label className="grid gap-1 text-xs text-muted-foreground">Supplier name<input value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" /></label>
            <label className="grid gap-1 text-xs text-muted-foreground">Category<select value={editForm.categoryId} onChange={(event) => setEditForm({ ...editForm, categoryId: event.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground">{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label className="grid gap-1 text-xs text-muted-foreground">Contact name<input value={editForm.contactName} onChange={(event) => setEditForm({ ...editForm, contactName: event.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" /></label>
            <label className="grid gap-1 text-xs text-muted-foreground">Email<input type="email" value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" /></label>
            <label className="grid gap-1 text-xs text-muted-foreground">Phone<input value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" /></label>
            <label className="grid gap-1 text-xs text-muted-foreground">Service inclusions<textarea value={editForm.serviceInclusions} onChange={(event) => setEditForm({ ...editForm, serviceInclusions: event.target.value })} className="min-h-16 rounded-md border border-input bg-background p-2 text-sm text-foreground" /></label>
            <label className="grid gap-1 text-xs text-muted-foreground">Private PMCM notes<textarea value={editForm.performanceNotes} onChange={(event) => setEditForm({ ...editForm, performanceNotes: event.target.value })} className="min-h-16 rounded-md border border-input bg-background p-2 text-sm text-foreground" /></label>
            <div className="flex flex-wrap items-center gap-2"><Button type="button" size="sm" disabled={actionSaving || !editForm.name.trim()} onClick={() => void saveProfile()}>Save profile</Button><Button type="button" variant="outline" size="sm" disabled={actionSaving} onClick={() => void onSubmit({ kind: "update", supplierId: supplier.id, input: { bniMember: !supplier.bniMember } })}>{supplier.bniMember ? "Remove BNI member" : "Mark BNI member"}</Button></div>
          </div>
        </details>

        <details className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">{pendingPromotion ? "Promote pending supplier" : "Change supplier tier"}</summary>
          <div className="mt-3 grid gap-2">
            <label className="grid gap-1 text-xs text-muted-foreground">New tier<select value={tierForm.tier} onChange={(event) => setTierForm({ ...tierForm, tier: event.target.value as typeof tierForm.tier })} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"><option value="tier_1">Tier 1</option><option value="tier_2">Tier 2</option>{!pendingPromotion ? <option value="pending_first_event">Pending first event</option> : null}</select></label>
            {pendingPromotion ? <EventChoice label="Assessed completed event" value={tierForm.eventId} events={promotionEvents} onChange={(eventId) => setTierForm({ ...tierForm, eventId })} /> : null}
            <label className="grid gap-1 text-xs text-muted-foreground">Reason<textarea required value={tierForm.reason} onChange={(event) => setTierForm({ ...tierForm, reason: event.target.value })} className="min-h-16 rounded-md border border-input bg-background p-2 text-sm text-foreground" /></label>
            <Button type="button" size="sm" disabled={actionSaving || !tierForm.reason.trim() || (pendingPromotion && !tierForm.eventId)} onClick={() => void saveTier()}>{pendingPromotion ? "Promote" : "Change tier"}</Button>
          </div>
        </details>

        <details className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">Add private review</summary>
          <div className="mt-3 grid gap-2">
            <EventChoice label="Completed event" value={reviewForm.eventId} events={reviewEvents} onChange={(eventId) => setReviewForm({ ...reviewForm, eventId })} />
            <label className="grid gap-1 text-xs text-muted-foreground">Rating<select value={reviewForm.rating} onChange={(event) => setReviewForm({ ...reviewForm, rating: event.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground">{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} out of 5</option>)}</select></label>
            <label className="grid gap-1 text-xs text-muted-foreground">Review notes<textarea required value={reviewForm.notes} onChange={(event) => setReviewForm({ ...reviewForm, notes: event.target.value })} className="min-h-16 rounded-md border border-input bg-background p-2 text-sm text-foreground" /></label>
            {activeDimensions.map((dimension) => <label key={dimension.id} className="grid grid-cols-[1fr_100px] items-center gap-2 text-xs text-muted-foreground">{dimension.name}<select value={reviewForm.dimensionRatings[dimension.id] ?? ""} onChange={(event) => setReviewForm({ ...reviewForm, dimensionRatings: { ...reviewForm.dimensionRatings, [dimension.id]: event.target.value } })} className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"><option value="">Not rated</option>{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating}</option>)}</select></label>)}
            <Button type="button" size="sm" disabled={actionSaving || !reviewForm.eventId || !reviewForm.notes.trim()} onClick={() => void saveReview()}>Save review</Button>
          </div>
        </details>

        <details className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">Add reliability note</summary>
          <div className="mt-3 grid gap-2">
            <EventChoice label="Completed event" value={noteForm.eventId} events={reviewEvents} onChange={(eventId) => setNoteForm({ ...noteForm, eventId })} />
            <label className="grid gap-1 text-xs text-muted-foreground">Note<textarea required value={noteForm.note} onChange={(event) => setNoteForm({ ...noteForm, note: event.target.value })} className="min-h-16 rounded-md border border-input bg-background p-2 text-sm text-foreground" /></label>
            <Button type="button" size="sm" disabled={actionSaving || !noteForm.eventId || !noteForm.note.trim()} onClick={() => void saveReliabilityNote()}>Save note</Button>
          </div>
        </details>

        <details className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">Add certification metadata</summary>
          <div className="mt-3 grid gap-2">
            <label className="grid gap-1 text-xs text-muted-foreground">File name<input value={certificationForm.fileName} onChange={(event) => setCertificationForm({ ...certificationForm, fileName: event.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" /></label>
            <label className="grid gap-1 text-xs text-muted-foreground">Document type<input value={certificationForm.documentType} onChange={(event) => setCertificationForm({ ...certificationForm, documentType: event.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" /></label>
            <label className="grid gap-1 text-xs text-muted-foreground">Issuer<input value={certificationForm.issuer} onChange={(event) => setCertificationForm({ ...certificationForm, issuer: event.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" /></label>
            <label className="grid gap-1 text-xs text-muted-foreground">Expiry date<input type="date" value={certificationForm.expiresAt} onChange={(event) => setCertificationForm({ ...certificationForm, expiresAt: event.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" /></label>
            <label className="grid gap-1 text-xs text-muted-foreground">Status<select value={certificationForm.status} onChange={(event) => setCertificationForm({ ...certificationForm, status: event.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"><option value="submitted">Submitted</option><option value="verified">Verified</option><option value="expired">Expired</option><option value="rejected">Rejected</option></select></label>
            <label className="grid gap-1 text-xs text-muted-foreground">Notes<textarea value={certificationForm.notes} onChange={(event) => setCertificationForm({ ...certificationForm, notes: event.target.value })} className="min-h-16 rounded-md border border-input bg-background p-2 text-sm text-foreground" /></label>
            <Button type="button" size="sm" disabled={actionSaving || !certificationForm.fileName.trim() || !certificationForm.documentType.trim()} onClick={() => void saveCertification()}>Save certification</Button>
          </div>
        </details>

      </fieldset>
    </section>
  );
}
