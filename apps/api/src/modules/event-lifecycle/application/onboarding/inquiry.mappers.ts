import type { OpsDocument, OpsEvent, OpsFloorPlanDraft, OpsInquiry, OpsInquiryMerge } from '@prisma/client';
import { guestAccessCode } from '@prism/contexts/operations';
import { inquiryPendingFullDetails, type PrismInquiry } from '@prism/types';
import { isDeterministicHighFitInquiry } from '../../domain/inquiry-triage.policy';

type EventWithDrafts = OpsEvent & { floorPlanDrafts?: OpsFloorPlanDraft[] };

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function timestamp(value: Date) {
  return value.toISOString();
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function optionalTimestamp(value: Date | null | undefined) {
  return value ? timestamp(value) : null;
}

function inquiryReminderDueAt(inquiry: OpsInquiry) {
  const reminderBase = inquiry.lastConformeReminderAt ?? inquiry.conformeSentAt;
  if (inquiry.status === 'accepted' && !inquiry.conformeSignedAt && reminderBase) {
    return addDays(reminderBase, inquiry.followUpIntervalDays);
  }
  return null;
}

function inquiryInvitationStatus(inquiry: OpsInquiry) {
  const expired =
    inquiry.portalInvitationStatus === 'sent' &&
    inquiry.portalInvitationExpiresAt &&
    !inquiry.portalInvitationOpenedAt &&
    inquiry.portalInvitationExpiresAt < new Date();
  return expired ? 'expired' : inquiry.portalInvitationStatus;
}

function isReminderDue(reminderDueAt: Date | null) {
  return Boolean(reminderDueAt && reminderDueAt <= new Date());
}

type InquiryTriage = OpsInquiry & {
  channel?: string | null;
  normalizedEmail?: string;
  referralDetails?: string;
  loggedByRole?: string | null;
  loggedByName?: string | null;
  duplicateOfInquiryId?: string | null;
  previousDeclinedInquiryId?: string | null;
  previousDeclineReason?: string | null;
  privacyConsentAccepted?: boolean;
  privacyNoticeVersion?: string;
  marketingConsentAccepted?: boolean;
};

function inquiryTriageFields(inquiry: OpsInquiry) {
  const triage = inquiry as InquiryTriage;
  return {
    channel: triage.channel ?? null,
    normalizedEmail: triage.normalizedEmail ?? inquiry.email.trim().toLowerCase(),
    referralDetails: triage.referralDetails ?? '',
    loggedByRole: triage.loggedByRole ?? null,
    loggedByName: triage.loggedByName ?? null,
    duplicateOfInquiryId: triage.duplicateOfInquiryId ?? null,
    previousDeclinedInquiryId: triage.previousDeclinedInquiryId ?? null,
    previousDeclineReason: triage.previousDeclineReason ?? null,
    duplicate: Boolean(triage.duplicateOfInquiryId),
    previouslyDeclined: Boolean(triage.previousDeclinedInquiryId),
    privacyConsentAccepted: triage.privacyConsentAccepted ?? false,
    privacyNoticeVersion: triage.privacyNoticeVersion ?? '',
    marketingConsentAccepted: triage.marketingConsentAccepted ?? false,
  };
}

export type InquiryMergeRow = OpsInquiryMerge & { mergedInquiry?: Pick<OpsInquiry, 'clientName'> & { eventName?: string } };

export type InquiryCueRow = OpsInquiry & {
  statusHistory?: Array<{ id: string; fromStatus: string | null; toStatus: string; transition: string; actorId: string | null; actorRole: string | null; actorName: string | null; createdAt: Date }>;
  mergedInto?: OpsInquiryMerge | null;
  mergesAsPrimary?: InquiryMergeRow[];
};

/** Same-organization inquiries that are still open; computed by the list query, not stored. */
export interface InquiryListCues {
  parallelInquiryIds: string[];
}

export function mapInquiry(inquiry: InquiryCueRow, cues?: InquiryListCues) {
  const statusHistory = inquiry.statusHistory;
  return {
    ...mapInquirySummary(inquiry),
    statusHistory: statusHistory?.map((item) => ({ ...item, createdAt: timestamp(item.createdAt) })) ?? [],
    organizationKey: inquiry.organizationKey ?? null,
    mergedIntoInquiryId: inquiry.mergedInto?.primaryInquiryId ?? null,
    mergeHistory: (inquiry.mergesAsPrimary ?? []).map((merge) => ({
      id: merge.id,
      primaryInquiryId: merge.primaryInquiryId,
      mergedInquiryId: merge.mergedInquiryId,
      mergedInquiryName: merge.mergedInquiry?.clientName ?? '',
      matchBasis: merge.matchBasis === 'organization' ? 'organization' : 'email',
      reason: merge.reason,
      actorName: merge.actorName,
      actorRole: merge.actorRole,
      createdAt: timestamp(merge.createdAt),
    })),
    parallelInquiryIds: cues?.parallelInquiryIds ?? [],
    highFit: isDeterministicHighFitInquiry(
      { clientType: inquiry.clientType, companyName: inquiry.companyName, eventDate: inquiry.eventDate },
      new Date(),
    ),
  };
}

/**
 * Public inquiry response. Strips every PMCM triage field (duplicate and previous-decline flags,
 * logged-by, organization, merge and high-fit cues) so the public path never echoes PMCM state.
 */
export function mapPublicInquiryReceipt(inquiry: OpsInquiry) {
  const mapped = mapInquiry(inquiry);
  const {
    duplicateOfInquiryId: _duplicateOfInquiryId,
    previousDeclinedInquiryId: _previousDeclinedInquiryId,
    previousDeclineReason: _previousDeclineReason,
    duplicate: _duplicate,
    previouslyDeclined: _previouslyDeclined,
    loggedByRole: _loggedByRole,
    loggedByName: _loggedByName,
    organizationKey: _organizationKey,
    mergedIntoInquiryId: _mergedIntoInquiryId,
    mergeHistory: _mergeHistory,
    parallelInquiryIds: _parallelInquiryIds,
    highFit: _highFit,
    intakePath: _intakePath,
    bidStatus: _bidStatus,
    bidDueAt: _bidDueAt,
    ...publicFields
  } = mapped;
  return publicFields;
}

export function mapInquirySummary(inquiry: OpsInquiry) {
  const reminderDueAt = inquiryReminderDueAt(inquiry);
  return {
    id: inquiry.id,
    clientName: inquiry.clientName,
    companyName: inquiry.companyName,
    email: inquiry.email,
    eventName: inquiry.eventName,
    eventType: inquiry.eventType,
    eventDate: isoDate(inquiry.eventDate),
    clientType: inquiry.clientType,
    source: inquiry.source,
    ...inquiryTriageFields(inquiry),
    message: inquiry.message,
    pendingFullDetails: inquiry.loggedByRole != null && inquiryPendingFullDetails({ ...inquiry, eventDate: isoDate(inquiry.eventDate) }),
    seatingArrangement: inquiry.seatingArrangement,
    stagePosition: inquiry.stagePosition,
    setupNotes: inquiry.setupNotes,
    status: inquiry.status,
    declineReason: inquiry.declineReason,
    acceptedAt: optionalTimestamp(inquiry.acceptedAt),
    pendingAt: optionalTimestamp(inquiry.pendingAt),
    declinedAt: optionalTimestamp(inquiry.declinedAt),
    conformeSentAt: optionalTimestamp(inquiry.conformeSentAt),
    conformeSignedAt: optionalTimestamp(inquiry.conformeSignedAt),
    portalActivatedAt: optionalTimestamp(inquiry.portalActivatedAt),
    followUpIntervalDays: inquiry.followUpIntervalDays,
    lastConformeReminderAt: optionalTimestamp(inquiry.lastConformeReminderAt),
    reminderDueAt: optionalTimestamp(reminderDueAt),
    reminderDue: isReminderDue(reminderDueAt),
    portalInvitationStatus: inquiryInvitationStatus(inquiry),
    portalInvitationSentAt: optionalTimestamp(inquiry.portalInvitationSentAt),
    portalInvitationOpenedAt: optionalTimestamp(inquiry.portalInvitationOpenedAt),
    portalInvitationExpiresAt: optionalTimestamp(inquiry.portalInvitationExpiresAt),
    preferredLanguage: inquiry.preferredLanguage === 'fil' ? 'fil' : 'en',
    intakePath: inquiry.intakePath === 'bidding' ? 'bidding' : 'standard',
    bidStatus: (inquiry.bidStatus ?? null) as PrismInquiry['bidStatus'],
    bidDueAt: optionalTimestamp(inquiry.bidDueAt),
    createdAt: timestamp(inquiry.createdAt),
  };
}

export function mapDocument(document: OpsDocument) {
  const expanded = document as OpsDocument & {
    generatedFileName?: string | null;
    validationStatus?: string;
    rejectionReason?: string | null;
  };
  return {
    id: document.id,
    eventId: document.eventId,
    type: document.type,
    fileName: document.fileName,
    generatedFileName: expanded.generatedFileName ?? null,
    status: document.status,
    validationStatus: expanded.validationStatus ?? 'accepted',
    rejectionReason: expanded.rejectionReason ?? null,
    uploadedAt: timestamp(document.uploadedAt),
  };
}

export function mapOnboardingFloorPlanDraft(draft: OpsFloorPlanDraft) {
  const expanded = draft as OpsFloorPlanDraft & {
    submittedSnapshot?: unknown;
    approvedSnapshot?: unknown;
    submittedSnapshotAt?: Date | null;
    approvedSnapshotAt?: Date | null;
    revisionComment?: string;
  };
  return {
    id: draft.id,
    eventId: draft.eventId,
    floorPlanId: draft.floorPlanId,
    name: draft.name,
    status: draft.status,
    isActive: draft.isActive,
    sourceType: draft.sourceType,
    createdByRole: draft.createdByRole,
    clientPreference: draft.clientPreference ?? undefined,
    submittedSnapshot: expanded.submittedSnapshot ?? undefined,
    approvedSnapshot: expanded.approvedSnapshot ?? undefined,
    submittedAt: draft.submittedAt ? timestamp(draft.submittedAt) : undefined,
    reviewedAt: draft.reviewedAt ? timestamp(draft.reviewedAt) : undefined,
    approvedAt: draft.approvedAt ? timestamp(draft.approvedAt) : undefined,
    submittedSnapshotAt: expanded.submittedSnapshotAt ? timestamp(expanded.submittedSnapshotAt) : undefined,
    approvedSnapshotAt: expanded.approvedSnapshotAt ? timestamp(expanded.approvedSnapshotAt) : undefined,
    revisionComment: expanded.revisionComment ?? '',
    createdAt: timestamp(draft.createdAt),
    updatedAt: timestamp(draft.updatedAt),
  };
}

type EventWithProposalReview = EventWithDrafts & {
  proposalClientStatus?: string;
  proposalRevisionCount?: number;
  proposalReviewedAt?: Date | null;
  proposalReviewedBy?: string | null;
};

export function mapOnboardingEvent(event: EventWithDrafts) {
  const floorPlanDrafts = event.floorPlanDrafts ?? [];
  const activeDraft =
    floorPlanDrafts.find((draft) => draft.isActive) ??
    floorPlanDrafts.find((draft) => draft.floorPlanId === event.floorPlanId);
  const reviewed = event as EventWithProposalReview;
  const proposalClientStatus =
    reviewed.proposalClientStatus === 'approved' || reviewed.proposalClientStatus === 'revision_requested'
      ? reviewed.proposalClientStatus
      : 'pending';

  return {
    id: event.id,
    inquiryId: event.inquiryId,
    clientName: event.clientName,
    eventName: event.eventName,
    eventDate: isoDate(event.eventDate),
    status: event.status,
    clientPortalStatus: event.clientPortalStatus as 'locked' | 'unlocked',
    readiness: event.readiness,
    archived: event.archived,
    floorPlanStatus: event.floorPlanStatus,
    floorPlanId: event.floorPlanId,
    guestAccessCode: guestAccessCode(event),
    proposalClientStatus,
    proposalRevisionCount: reviewed.proposalRevisionCount ?? 0,
    proposalReviewedAt: optionalTimestamp(reviewed.proposalReviewedAt),
    proposalReviewedBy: reviewed.proposalReviewedBy ?? null,
    activeFloorPlanDraftId: activeDraft?.id,
    floorPlanDrafts: floorPlanDrafts.map(mapOnboardingFloorPlanDraft),
  };
}

export function mapBriefingSummary(briefing: { eventId: string; venue: string; guestCount: number; budgetRange: string; serviceRequirements: unknown; notes: string; submittedAt: Date }) {
  return {
    eventId: briefing.eventId,
    venue: briefing.venue,
    guestCount: briefing.guestCount,
    budgetRange: briefing.budgetRange,
    serviceRequirements: Array.isArray(briefing.serviceRequirements) ? (briefing.serviceRequirements as string[]) : [],
    notes: briefing.notes,
    submittedAt: timestamp(briefing.submittedAt),
  };
}

export function mapBriefing(briefing: Parameters<typeof mapBriefingSummary>[0] & {
  confirmedDate?: Date | null;
  confirmedStartTime?: string | null;
  confirmedEndTime?: string | null;
  program?: unknown;
  moodAndStyling?: string;
  stylingBudget?: number | null;
  venueType?: string | null;
}) {
  return {
    ...mapBriefingSummary(briefing),
    venueType: briefing.venueType ?? null,
    confirmedDate: briefing.confirmedDate?.toISOString() ?? null,
    confirmedStartTime: briefing.confirmedStartTime ?? null,
    confirmedEndTime: briefing.confirmedEndTime ?? null,
    program: Array.isArray(briefing.program) ? briefing.program : [],
    moodAndStyling: briefing.moodAndStyling ?? '',
    stylingBudget: briefing.stylingBudget ?? null,
  };
}
