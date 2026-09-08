import type { OpsDocument, OpsEvent, OpsFloorPlanDraft, OpsInquiry } from '@prisma/client';

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

export function mapInquiry(inquiry: OpsInquiry) {
  const reminderDueAt = inquiryReminderDueAt(inquiry);
  const statusHistory = (inquiry as OpsInquiry & { statusHistory?: Array<{ id: string; fromStatus: string | null; toStatus: string; transition: string; actorId: string | null; actorRole: string | null; actorName: string | null; createdAt: Date }> }).statusHistory;
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
    createdAt: timestamp(inquiry.createdAt),
    statusHistory: statusHistory?.map((item) => ({ ...item, createdAt: timestamp(item.createdAt) })) ?? [],
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

function guestAccessCode(event: Pick<OpsEvent, 'id' | 'eventName'>) {
  const namePart =
    event.eventName
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .split('-')
      .filter(Boolean)
      .slice(0, 2)
      .join('-') || 'PRISM';
  const idPart = event.id.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || 'EVNT';
  return `${namePart}-${idPart}`;
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

export function mapBriefing(briefing: {
  eventId: string;
  venue: string;
  guestCount: number;
  budgetRange: string;
  serviceRequirements: unknown;
  notes: string;
  submittedAt: Date;
}) {
  return {
    eventId: briefing.eventId,
    venue: briefing.venue,
    guestCount: briefing.guestCount,
    budgetRange: briefing.budgetRange,
    serviceRequirements: Array.isArray(briefing.serviceRequirements) ? (briefing.serviceRequirements as string[]) : [],
    notes: briefing.notes,
    submittedAt: briefing.submittedAt.toISOString(),
  };
}
