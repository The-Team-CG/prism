"use client";

import { useEffect, useRef } from "react";
import { Handshake, LockKeyhole, Mail, Phone, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import type {
  PrismPmcmSupplierCertificationsPage,
  PrismPmcmSupplierEngagement,
  PrismPmcmSupplierPage,
  PrismPmcmSupplierProfile,
  PrismPmcmSupplierRecordsPage,
  PrismPmcmSupplierReviewsPage,
  PrismSupplierCategory,
} from "@prism/types";
import type { SupplierActionDraft } from "../use-cases/submit-supplier-action";
import type { SupplierActionResult } from "../use-cases/save-supplier-action";
import { SupplierPerformanceScorecards } from "./supplier-performance-scorecards";
import { SupplierRecentRecords, SupplierRecordHistory } from "./supplier-recent-records";
import { SupplierProfileActions } from "./supplier-profile-actions";
import { SupplierPerformanceSummary } from "./supplier-performance-summary";
import { RatingStars, SupplierAvatar, SupplierTags } from "./supplier-visuals";
import styles from "./supplier-workspace.module.css";

function contactLine(value: string) {
  return value.trim() || "Not on file";
}

export function SupplierDetailDrawer({
  supplierId,
  profile,
  profileLoading,
  profileError,
  categories,
  engagements,
  engagementsLoading,
  engagementsError,
  reviews,
  reviewsLoading,
  certifications,
  certificationsLoading,
  records,
  recordsLoading,
  recordsError,
  profilePeriod,
  recordsPeriod,
  engagementPage,
  actionSaving,
  actionResult,
  onClose,
  onRetry,
  onOpenEvent,
  onProfilePeriodChange,
  onRecordsPeriodChange,
  onEngagementPageChange,
  onSubmitAction,
}: {
  supplierId: string;
  profile: PrismPmcmSupplierProfile | null;
  profileLoading: boolean;
  profileError: string | null;
  categories: PrismSupplierCategory[];
  engagements: PrismPmcmSupplierPage<PrismPmcmSupplierEngagement> | null;
  engagementsLoading: boolean;
  engagementsError: string | null;
  reviews: PrismPmcmSupplierReviewsPage | null;
  reviewsLoading: boolean;
  certifications: PrismPmcmSupplierCertificationsPage | null;
  certificationsLoading: boolean;
  records: PrismPmcmSupplierRecordsPage | null;
  recordsLoading: boolean;
  recordsError: string | null;
  profilePeriod: PrismPmcmSupplierProfile["period"];
  recordsPeriod: PrismPmcmSupplierRecordsPage["period"];
  engagementPage: number;
  actionSaving: boolean;
  actionResult: SupplierActionResult | null;
  onClose: () => void;
  onRetry: () => void;
  onOpenEvent: (eventId: string) => void;
  onProfilePeriodChange: (period: PrismPmcmSupplierProfile["period"]) => void;
  onRecordsPeriodChange: (period: PrismPmcmSupplierRecordsPage["period"]) => void;
  onEngagementPageChange: (page: number) => void;
  onSubmitAction: (action: SupplierActionDraft) => Promise<SupplierActionResult>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const categoryName = profile?.supplier.categoryName ?? categories.find((category) => category.id === profile?.supplier.categoryId)?.name;

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
      document.documentElement.style.overflow = previousOverflow;
    };
  }, []);

  function closeDialog() {
    if (dialogRef.current?.open) dialogRef.current.close();
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="supplier-drawer-title"
      onCancel={(event) => { event.preventDefault(); closeDialog(); }}
      className={`${styles.drawer} fixed inset-y-0 right-0 left-auto m-0 ml-auto h-dvh max-h-dvh max-w-none p-0`}
    >
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-5">
          <p className="flex items-center gap-2 text-xs font-semibold"><Handshake className="size-3.5 text-muted-foreground" />Supplier details</p>
          <h2 id="supplier-drawer-title" className="sr-only">{profile?.supplier.name ?? "Supplier"}</h2>
          <Button type="button" variant="ghost" size="icon" className="size-7 rounded-full" aria-label="Close supplier details" onClick={closeDialog}><X className="size-4" /></Button>
        </header>

        <div className={`${styles.drawerBody} min-h-0 flex-1 overflow-y-auto`}>
          {profileError ? (
            <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <p className="text-sm font-medium">{profileError.toLowerCase().includes("not found") || profileError.includes("404") ? "Supplier not found" : "Supplier details could not be loaded"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{profileError}</p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>Retry</Button>
            </div>
          ) : null}
          {actionResult ? (
            <div role={actionResult.saved ? "status" : "alert"} className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm ${actionResult.saved ? "border-emerald-600/20 bg-emerald-600/5" : "border-destructive/20 bg-destructive/5"}`}>
              <span>{actionResult.saved ? actionResult.refreshFailed ? "Saved. Refresh failed." : "Saved." : actionResult.message}</span>
              {actionResult.saved && actionResult.refreshFailed ? <Button type="button" variant="outline" size="sm" onClick={onRetry}>Retry refresh</Button> : null}
            </div>
          ) : null}
          {!profile && profileLoading ? <div aria-live="polite" className="space-y-3"><p className="text-sm text-muted-foreground">Loading supplier details…</p><div className="h-24 animate-pulse rounded-lg bg-muted" /></div> : null}
          {profile ? (
            <>
              <section className="flex items-center gap-3">
                <SupplierAvatar name={profile.supplier.name} identity />
                <div className="min-w-0 flex-1">
                  <h3 className="mb-2 text-sm font-semibold">{profile.supplier.name}</h3>
                  <SupplierTags category={categoryName ?? "Category unavailable"} tier={profile.supplier.tier} bniMember={profile.supplier.bniMember} />
                </div>
              </section>

              <section aria-labelledby="supplier-account-heading" className="space-y-3">
                <h3 id="supplier-account-heading" className="text-xs font-semibold">Account summary</h3>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 text-[11px]">
                  <span className="flex items-center gap-1.5 font-medium"><SupplierAvatar name={profile.supplier.contactName} />{contactLine(profile.supplier.contactName)}</span>
                  <span className="flex min-w-0 items-center gap-1.5"><Mail aria-hidden="true" className="size-3 text-muted-foreground" />{profile.supplier.email ? <a className="truncate hover:text-primary" href={`mailto:${profile.supplier.email}`}>{profile.supplier.email}</a> : "Email not on file"}</span>
                  <span className="flex items-center gap-1.5"><Phone aria-hidden="true" className="size-3 text-muted-foreground" />{contactLine(profile.supplier.phone)}</span>
                </div>
              </section>

              <SupplierPerformanceSummary profile={profile} />

              <SupplierRecentRecords records={records} period={recordsPeriod} loading={recordsLoading} error={recordsError} onPeriodChange={onRecordsPeriodChange} onRetry={onRetry} />

              <SupplierPerformanceScorecards profile={profile} period={profilePeriod} onPeriodChange={onProfilePeriodChange} />

              <section aria-labelledby="supplier-reviews-heading" className="space-y-3">
                <div className="flex items-center justify-between gap-2"><h3 id="supplier-reviews-heading" className="text-xs font-semibold">Private review history</h3><span className="text-[11px] text-muted-foreground">{reviews?.totalCount ?? profile.rating.count} {(reviews?.totalCount ?? profile.rating.count) === 1 ? "review" : "reviews"}</span></div>
                {reviewsLoading && !reviews ? <p className="text-xs text-muted-foreground">Loading review history…</p> : null}
                {!reviewsLoading && !reviews?.items.length ? <p className={styles.empty}>No private reviews recorded. Add a review after an eligible event engagement.</p> : null}
                <div className="space-y-2">{reviews?.items.map((review) => <article key={review.id} className={styles.scorecard}>
                  <div className="flex items-center justify-between gap-3"><h4 className="text-xs font-semibold">{review.eventName || "Supplier review"}</h4><span className="flex items-center gap-2 text-xs font-semibold">{review.rating}/5<RatingStars rating={review.rating} /></span></div>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{review.notes || "No written feedback recorded."}</p>
                  {review.dimensionRatings.length ? <div className="mt-3 space-y-1">{review.dimensionRatings.map((dimension) => <div key={dimension.dimensionId} className="flex justify-between gap-2 text-[11px]"><span className="text-muted-foreground">{dimension.dimensionName}</span><span>{dimension.rating}/5</span></div>)}</div> : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]"><SupplierAvatar name={review.reviewedBy} /><span>{review.reviewedBy}</span><time className="text-muted-foreground" dateTime={review.createdAt}>{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(review.createdAt))}</time></div>
                </article>)}</div>
              </section>

              <section aria-labelledby="supplier-engagements-heading" className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 id="supplier-engagements-heading" className="text-sm font-semibold">Event engagements · {engagements?.totalCount ?? 0}</h3>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={engagementPage <= 0 || engagementsLoading} onClick={() => onEngagementPageChange(engagementPage - 1)}>Previous</Button>
                    <Button type="button" variant="outline" size="sm" disabled={!engagements?.hasNextPage || engagementsLoading} onClick={() => onEngagementPageChange(engagementPage + 1)}>Next</Button>
                  </div>
                </div>
                {engagementsError ? <div role="alert" className="flex items-center justify-between gap-2 rounded-md bg-destructive/5 p-3 text-sm"><span>{engagementsError}</span><button type="button" onClick={onRetry} className="font-medium text-primary">Retry</button></div> : null}
                {engagementsLoading && !engagements ? <p className="text-sm text-muted-foreground">Loading event engagements…</p> : null}
                {!engagementsLoading && !engagements?.items.length ? <p className="text-sm text-muted-foreground">No linked event requests are recorded.</p> : null}
                <div className="space-y-2">
                  {engagements?.items.map((engagement) => <EngagementCard key={engagement.eventId} engagement={engagement} onOpenEvent={onOpenEvent} />)}
                </div>
              </section>

              <section aria-labelledby="supplier-certifications-heading" className="space-y-3">
                <div className="flex items-center justify-between gap-2"><h3 id="supplier-certifications-heading" className="text-sm font-semibold">Certifications</h3><span className="text-xs text-muted-foreground">{certifications?.totalCount ?? profile.certifications.verified + profile.certifications.submitted + profile.certifications.expired + profile.certifications.rejected + profile.certifications.unknown} records</span></div>
                {certificationsLoading && !certifications ? <p className="text-sm text-muted-foreground">Loading certification records…</p> : null}
                {!certificationsLoading && !certifications?.items.length ? <p className="text-sm text-muted-foreground">No certification metadata is recorded.</p> : null}
                <div className="space-y-2">{certifications?.items.map((certification) => <article key={certification.id} className="rounded-lg border border-border p-3"><p className="text-sm font-medium">{certification.fileName}</p><p className="mt-1 text-xs text-muted-foreground">{certification.documentType || "Type not recorded"}{certification.issuer ? ` · ${certification.issuer}` : ""} · {certification.status || "Unknown status"}</p>{certification.expiresAt ? <p className="mt-1 text-xs text-muted-foreground">Expires {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(certification.expiresAt))}</p> : null}</article>)}</div>
              </section>

              <SupplierRecordHistory records={records} />

              <section aria-labelledby="supplier-private-notes-heading" className="space-y-2">
                <h3 id="supplier-private-notes-heading" className="text-sm font-semibold">Private PMCM notes</h3>
                <p className="whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">{profile.supplier.performanceNotes || "No private notes recorded."}</p>
                {profile.supplier.serviceInclusions ? <p className="whitespace-pre-wrap rounded-lg border border-border p-3 text-xs leading-relaxed"><span className="mb-1 block text-muted-foreground">Service inclusions</span>{profile.supplier.serviceInclusions}</p> : null}
              </section>

              <SupplierProfileActions
                profile={profile}
                categories={categories}
                engagements={engagements}
                actionSaving={actionSaving}
                actionResult={actionResult}
                onSubmit={onSubmitAction}
              />
            </>
          ) : null}
          <span className="sr-only">Supplier ID {supplierId}</span>
        </div>
        <footer className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-t border-border px-5 py-2">
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><LockKeyhole className="size-3" />Private to PMCM</span>
          <div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={closeDialog}>Close</Button>{profile ? <Button type="button" size="sm" onClick={() => document.getElementById("supplier-actions-heading")?.scrollIntoView({ block: "start" })}>Supplier actions</Button> : null}</div>
        </footer>
      </div>
    </dialog>
  );
}

function EngagementCard({ engagement, onOpenEvent }: { engagement: PrismPmcmSupplierEngagement; onOpenEvent: (eventId: string) => void }) {
  return (
    <article className="rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h4 className="truncate text-sm font-medium">{engagement.event.name}</h4><p className="mt-1 text-xs text-muted-foreground">{engagement.event.date} · {engagement.event.status.replaceAll("_", " ")}</p></div>
        <Button type="button" variant="outline" size="sm" onClick={() => onOpenEvent(engagement.eventId)}>Open event</Button>
      </div>
      <div className="mt-3 space-y-2">
        {engagement.requests.map((request) => <div key={request.id} className="rounded-md bg-muted/45 p-2 text-xs"><p className="font-medium">{request.category}</p><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground"><span>Request: {request.status.replaceAll("_", " ")}</span><span>Assignment: {request.assignmentStatus.replaceAll("_", " ")}</span><span>Readiness: {request.readinessStatus.replaceAll("_", " ")}</span><span>Event day: {request.eventDayStatus.replaceAll("_", " ")}</span></div></div>)}
      </div>
      {engagement.hasMoreRequests ? <p className="mt-2 text-xs text-muted-foreground">Showing {engagement.requests.length} of {engagement.requestCount} request records.</p> : null}
      {engagement.canReview ? <p className="mt-2 text-xs text-emerald-700">Eligible for review{engagement.canPromote ? " and tier promotion" : ""}.</p> : null}
    </article>
  );
}
