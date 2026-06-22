import type { OpsDocument, OpsInquiry } from '@prisma/client';

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

export function mapInquiry(inquiry: OpsInquiry) {
  const triage = inquiry as OpsInquiry & {
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
  const reminderBase = inquiry.lastConformeReminderAt ?? inquiry.conformeSentAt;
  const reminderDueAt =
    inquiry.status === 'accepted' && !inquiry.conformeSignedAt && reminderBase
      ? addDays(reminderBase, inquiry.followUpIntervalDays)
      : null;
  const invitationStatus =
    inquiry.portalInvitationStatus === 'sent' &&
    inquiry.portalInvitationExpiresAt &&
    !inquiry.portalInvitationOpenedAt &&
    inquiry.portalInvitationExpiresAt < new Date()
      ? 'expired'
      : inquiry.portalInvitationStatus;

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
    message: inquiry.message,
    status: inquiry.status,
    declineReason: inquiry.declineReason,
    acceptedAt: inquiry.acceptedAt ? timestamp(inquiry.acceptedAt) : null,
    pendingAt: inquiry.pendingAt ? timestamp(inquiry.pendingAt) : null,
    declinedAt: inquiry.declinedAt ? timestamp(inquiry.declinedAt) : null,
    conformeSentAt: inquiry.conformeSentAt ? timestamp(inquiry.conformeSentAt) : null,
    conformeSignedAt: inquiry.conformeSignedAt ? timestamp(inquiry.conformeSignedAt) : null,
    portalActivatedAt: inquiry.portalActivatedAt ? timestamp(inquiry.portalActivatedAt) : null,
    followUpIntervalDays: inquiry.followUpIntervalDays,
    lastConformeReminderAt: inquiry.lastConformeReminderAt
      ? timestamp(inquiry.lastConformeReminderAt)
      : null,
    reminderDueAt: reminderDueAt ? timestamp(reminderDueAt) : null,
    reminderDue: Boolean(reminderDueAt && reminderDueAt <= new Date()),
    portalInvitationStatus: invitationStatus,
    portalInvitationSentAt: inquiry.portalInvitationSentAt
      ? timestamp(inquiry.portalInvitationSentAt)
      : null,
    portalInvitationOpenedAt: inquiry.portalInvitationOpenedAt
      ? timestamp(inquiry.portalInvitationOpenedAt)
      : null,
    portalInvitationExpiresAt: inquiry.portalInvitationExpiresAt
      ? timestamp(inquiry.portalInvitationExpiresAt)
      : null,
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
