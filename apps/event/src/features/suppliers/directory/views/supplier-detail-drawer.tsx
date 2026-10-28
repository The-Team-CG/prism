"use client";
import { formatPortalDate } from "@prism/ui/format-date";

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
          <ProfileErrorBanner error={profileError} onRetry={onRetry} />
          <ActionResultBanner result={actionResult} onRetry={onRetry} />
          <ProfileLoadingBanner loading={!profile && profileLoading} />
          {profile ? <SupplierProfileDetails
            profile={profile}
            categories={categories}
            engagements={engagements}
            engagementsLoading={engagementsLoading}
            engagementsError={engagementsError}
            reviews={reviews}
            reviewsLoading={reviewsLoading}
            certifications={certifications}
            certificationsLoading={certificationsLoading}
            records={records}
            recordsLoading={recordsLoading}
            recordsError={recordsError}
            profilePeriod={profilePeriod}
            recordsPeriod={recordsPeriod}
            engagementPage={engagementPage}
            actionSaving={actionSaving}
            actionResult={actionResult}
            onRetry={onRetry}
            onOpenEvent={onOpenEvent}
            onProfilePeriodChange={onProfilePeriodChange}
            onRecordsPeriodChange={onRecordsPeriodChange}
            onEngagementPageChange={onEngagementPageChange}
            onSubmitAction={onSubmitAction}
          /> : null}
          <span className="sr-only">Supplier ID {supplierId}</span>
        </div>
        <footer className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-t border-border px-5 py-2">
          <span className="flex items-center gap-1.5 text-3xs text-muted-foreground"><LockKeyhole className="size-3" />Private to PMCM</span>
          <div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={closeDialog}>Close</Button>{profile ? <Button type="button" size="sm" onClick={() => document.getElementById("supplier-actions-heading")?.scrollIntoView({ block: "start" })}>Supplier actions</Button> : null}</div>
        </footer>
      </div>
    </dialog>
  );
}

type SupplierProfileDetailsProps = {
  profile: PrismPmcmSupplierProfile;
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
  onRetry: () => void;
  onOpenEvent: (eventId: string) => void;
  onProfilePeriodChange: (period: PrismPmcmSupplierProfile["period"]) => void;
  onRecordsPeriodChange: (period: PrismPmcmSupplierRecordsPage["period"]) => void;
  onEngagementPageChange: (page: number) => void;
  onSubmitAction: (action: SupplierActionDraft) => Promise<SupplierActionResult>;
};

function ProfileErrorBanner({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  if (!error) return null;
  const notFound = error.toLowerCase().includes("not found") || error.includes("404");
  return (
    <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
      <p className="text-sm font-medium">{notFound ? "Supplier not found" : "Supplier details could not be loaded"}</p>
      <p className="mt-1 text-sm text-muted-foreground">{error}</p>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>Retry</Button>
    </div>
  );
}

function ActionResultBanner({ result, onRetry }: { result: SupplierActionResult | null; onRetry: () => void }) {
  if (!result) return null;
  const refreshFailed = result.saved && result.refreshFailed;
  const message = result.saved ? refreshFailed ? "Saved. Refresh failed." : "Saved." : result.message;
  const tone = result.saved ? "border-success/20 bg-success/5" : "border-destructive/20 bg-destructive/5";
  return (
    <div role={result.saved ? "status" : "alert"} className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm ${tone}`}>
      <span>{message}</span>
      {refreshFailed ? <Button type="button" variant="outline" size="sm" onClick={onRetry}>Retry refresh</Button> : null}
    </div>
  );
}

function ProfileLoadingBanner({ loading }: { loading: boolean }) {
  if (!loading) return null;
  return <div aria-live="polite" className="space-y-3"><p className="text-sm text-muted-foreground">Loading supplier details…</p><div className="h-24 animate-pulse rounded-lg bg-muted" /></div>;
}

function SupplierProfileDetails(props: SupplierProfileDetailsProps) {
  return (
    <>
      <SupplierIdentitySummary profile={props.profile} categories={props.categories} />
      <SupplierPerformanceSummary profile={props.profile} />
      <SupplierRecentRecords records={props.records} period={props.recordsPeriod} loading={props.recordsLoading} error={props.recordsError} onPeriodChange={props.onRecordsPeriodChange} onRetry={props.onRetry} />
      <SupplierPerformanceScorecards profile={props.profile} period={props.profilePeriod} onPeriodChange={props.onProfilePeriodChange} />
      <SupplierReviewHistory reviews={props.reviews} loading={props.reviewsLoading} fallbackCount={props.profile.rating.count} />
      <SupplierEngagementHistory engagements={props.engagements} loading={props.engagementsLoading} error={props.engagementsError} page={props.engagementPage} onPageChange={props.onEngagementPageChange} onRetry={props.onRetry} onOpenEvent={props.onOpenEvent} />
      <SupplierCertificationHistory certifications={props.certifications} loading={props.certificationsLoading} fallbackCount={certificationCount(props.profile)} />
      <SupplierRecordHistory records={props.records} />
      <SupplierPrivateNotes profile={props.profile} />
      <SupplierProfileActions profile={props.profile} categories={props.categories} engagements={props.engagements} actionSaving={props.actionSaving} actionResult={props.actionResult} onSubmit={props.onSubmitAction} />
    </>
  );
}

function SupplierIdentitySummary({ profile, categories }: { profile: PrismPmcmSupplierProfile; categories: PrismSupplierCategory[] }) {
  const categoryName = profile.supplier.categoryName ?? categories.find((category) => category.id === profile.supplier.categoryId)?.name;
  return (
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
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 text-2xs">
          <span className="flex items-center gap-1.5 font-medium"><SupplierAvatar name={profile.supplier.contactName} />{contactLine(profile.supplier.contactName)}</span>
          <span className="flex min-w-0 items-center gap-1.5"><Mail aria-hidden="true" className="size-3 text-muted-foreground" />{profile.supplier.email ? <a className="truncate hover:text-primary" href={`mailto:${profile.supplier.email}`}>{profile.supplier.email}</a> : "Email not on file"}</span>
          <span className="flex items-center gap-1.5"><Phone aria-hidden="true" className="size-3 text-muted-foreground" />{contactLine(profile.supplier.phone)}</span>
        </div>
      </section>
    </>
  );
}

function SupplierReviewHistory({ reviews, loading, fallbackCount }: { reviews: PrismPmcmSupplierReviewsPage | null; loading: boolean; fallbackCount: number }) {
  const reviewCount = reviews?.totalCount ?? fallbackCount;
  return (
    <section aria-labelledby="supplier-reviews-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-2"><h3 id="supplier-reviews-heading" className="text-xs font-semibold">Private review history</h3><span className="text-2xs text-muted-foreground">{reviewCount} {reviewCount === 1 ? "review" : "reviews"}</span></div>
      {loading && !reviews ? <p className="text-xs text-muted-foreground">Loading review history…</p> : null}
      {!loading && !reviews?.items.length ? <p className={styles.empty}>No private reviews recorded. Add a review after an eligible event engagement.</p> : null}
      <div className="space-y-2">{reviews?.items.map((review) => <ReviewCard key={review.id} review={review} />)}</div>
    </section>
  );
}

function ReviewCard({ review }: { review: PrismPmcmSupplierReviewsPage["items"][number] }) {
  return (
    <article className={styles.scorecard}>
      <div className="flex items-center justify-between gap-3"><h4 className="text-xs font-semibold">{review.eventName || "Supplier review"}</h4><span className="flex items-center gap-2 text-xs font-semibold">{review.rating}/5<RatingStars rating={review.rating} /></span></div>
      <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{review.notes || "No written feedback recorded."}</p>
      {review.dimensionRatings.length ? <div className="mt-3 space-y-1">{review.dimensionRatings.map((dimension) => <div key={dimension.dimensionId} className="flex justify-between gap-2 text-2xs"><span className="text-muted-foreground">{dimension.dimensionName}</span><span>{dimension.rating}/5</span></div>)}</div> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-3xs"><SupplierAvatar name={review.reviewedBy} /><span>{review.reviewedBy}</span><time className="text-muted-foreground" dateTime={review.createdAt}>{formatPortalDate(review.createdAt)}</time></div>
    </article>
  );
}

function SupplierEngagementHistory({ engagements, loading, error, page, onPageChange, onRetry, onOpenEvent }: {
  engagements: PrismPmcmSupplierPage<PrismPmcmSupplierEngagement> | null;
  loading: boolean;
  error: string | null;
  page: number;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  onOpenEvent: (eventId: string) => void;
}) {
  return (
    <section aria-labelledby="supplier-engagements-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="supplier-engagements-heading" className="text-sm font-semibold">Event engagements · {engagements?.totalCount ?? 0}</h3>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={page <= 0 || loading} onClick={() => onPageChange(page - 1)}>Previous</Button>
          <Button type="button" variant="outline" size="sm" disabled={!engagements?.hasNextPage || loading} onClick={() => onPageChange(page + 1)}>Next</Button>
        </div>
      </div>
      {error ? <div role="alert" className="flex items-center justify-between gap-2 rounded-md bg-destructive/5 p-3 text-sm"><span>{error}</span><button type="button" onClick={onRetry} className="font-medium text-primary">Retry</button></div> : null}
      {loading && !engagements ? <p className="text-sm text-muted-foreground">Loading event engagements…</p> : null}
      {!loading && !engagements?.items.length ? <p className="text-sm text-muted-foreground">No linked event requests are recorded.</p> : null}
      <div className="space-y-2">{engagements?.items.map((engagement) => <EngagementCard key={engagement.eventId} engagement={engagement} onOpenEvent={onOpenEvent} />)}</div>
    </section>
  );
}

function SupplierCertificationHistory({ certifications, loading, fallbackCount }: { certifications: PrismPmcmSupplierCertificationsPage | null; loading: boolean; fallbackCount: number }) {
  return (
    <section aria-labelledby="supplier-certifications-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-2"><h3 id="supplier-certifications-heading" className="text-sm font-semibold">Certifications</h3><span className="text-xs text-muted-foreground">{certifications?.totalCount ?? fallbackCount} records</span></div>
      {loading && !certifications ? <p className="text-sm text-muted-foreground">Loading certification records…</p> : null}
      {!loading && !certifications?.items.length ? <p className="text-sm text-muted-foreground">No certification metadata is recorded.</p> : null}
      <div className="space-y-2">{certifications?.items.map((certification) => <CertificationRecord key={certification.id} certification={certification} />)}</div>
    </section>
  );
}

function CertificationRecord({ certification }: { certification: PrismPmcmSupplierCertificationsPage["items"][number] }) {
  return (
    <article className="rounded-lg border border-border p-3">
      <p className="text-sm font-medium">{certification.fileName}</p>
      <p className="mt-1 text-xs text-muted-foreground">{certification.documentType || "Type not recorded"}{certification.issuer ? ` · ${certification.issuer}` : ""} · {certification.status || "Unknown status"}</p>
      {certification.expiresAt ? <p className="mt-1 text-xs text-muted-foreground">Expires {formatPortalDate(certification.expiresAt)}</p> : null}
    </article>
  );
}

function SupplierPrivateNotes({ profile }: { profile: PrismPmcmSupplierProfile }) {
  return (
    <section aria-labelledby="supplier-private-notes-heading" className="space-y-2">
      <h3 id="supplier-private-notes-heading" className="text-sm font-semibold">Private PMCM notes</h3>
      <p className="whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">{profile.supplier.performanceNotes || "No private notes recorded."}</p>
      {profile.supplier.serviceInclusions ? <p className="whitespace-pre-wrap rounded-lg border border-border p-3 text-xs leading-relaxed"><span className="mb-1 block text-muted-foreground">Service inclusions</span>{profile.supplier.serviceInclusions}</p> : null}
    </section>
  );
}

function certificationCount(profile: PrismPmcmSupplierProfile) {
  const certification = profile.certifications;
  return certification.verified + certification.submitted + certification.expired + certification.rejected + certification.unknown;
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
      {engagement.canReview ? <p className="mt-2 text-xs text-success">Eligible for review{engagement.canPromote ? " and tier promotion" : ""}.</p> : null}
    </article>
  );
}
