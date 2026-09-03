import type {
  OpsBriefing,
  OpsComplianceCheck,
  OpsComplianceRule,
  OpsDocument,
  OpsEvent,
  OpsEventInsight,
  OpsFloorPlanDraft,
  OpsInquiry,
  OpsNotificationLog,
  OpsPostEventDocument,
  OpsUser,
} from '@prisma/client';
import { mapAuditLog } from '@prism/contexts/platform-ops';
import { mapSupplierQuote, mapSupplierQuoteRequest } from '@prism/contexts/commercial';
import type { FinanceCommands } from '@prism/contexts/commercial';
import type { FloorplanReader } from '@prism/contexts/floorplan';
import type { GuestReader, RegistrationPlatformReader, StaffingReader } from '@prism/contexts/operations';
import { createPmcmDashboardMappers } from './event-read-model.mappers';

const COORDINATOR_ROLE_REQUIREMENTS = [
  { role: 'Floor Director', required: 1 },
  { role: 'Stage Director', required: 1 },
  { role: 'Registration Staff', required: 2 },
  { role: 'Ingress and Egress Assistant', required: 1 },
  { role: 'Event Day System Operator', required: 1 },
  { role: 'Usher', required: 2 },
  { role: 'General Coordinator', required: 1 },
];

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

export type EventReadModelMapperDependencies = {
  floorplanReader: FloorplanReader;
  guestReader: GuestReader;
};

export type PmcmReadModelMapperDependencies = EventReadModelMapperDependencies & {
  financeCommands: FinanceCommands;
  staffingReader: StaffingReader;
  registrationPlatformReader: RegistrationPlatformReader;
};

export function createPmcmReadModelMappers(dependencies: PmcmReadModelMapperDependencies) {
  return createPmcmDashboardMappers({
    coordinatorRoleRequirements: COORDINATOR_ROLE_REQUIREMENTS,
    mapUser,
    mapInquiry,
    mapEvent: (event) => mapEvent(event as EventWithDrafts, dependencies),
    mapDocument,
    mapBriefing,
    mapSupplierQuoteRequest,
    mapSupplierQuote,
    mapCoordinator: dependencies.staffingReader.mapCoordinator.bind(dependencies.staffingReader),
    mapCoordinatorAssignment: dependencies.staffingReader.mapCoordinatorAssignment.bind(dependencies.staffingReader),
    mapComplianceRule,
    mapComplianceCheck,
    mapBillingSource: dependencies.financeCommands.mapBillingSource.bind(dependencies.financeCommands),
    mapBillingStatement: dependencies.financeCommands.mapBillingStatement.bind(dependencies.financeCommands),
    mapPaymentMilestone: dependencies.financeCommands.mapPaymentMilestone.bind(dependencies.financeCommands),
    mapPaymentRecord: dependencies.financeCommands.mapPaymentRecord.bind(dependencies.financeCommands),
    mapPostEventDocument,
    mapEventInsight,
    mapFloorPlanDraft: dependencies.floorplanReader.mapFloorPlanDraft.bind(dependencies.floorplanReader),
    mapAuditLog,
    mapNotificationLog,
    mapRegistrationPlatform: dependencies.registrationPlatformReader.mapRegistrationPlatform.bind(dependencies.registrationPlatformReader),
  });
}

export function mapUser(user: OpsUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organization: user.organization,
    approvalStatus: user.approvalStatus,
    lastLoginAt: user.lastLoginAt ? timestamp(user.lastLoginAt) : null,
    lockedUntil: user.lockedUntil ? timestamp(user.lockedUntil) : null,
    permanentLockout: user.permanentLockout,
  };
}

export function mapInquiry(inquiry: OpsInquiry) {
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
  };
}

export function mapEvent(event: EventWithDrafts, dependencies: EventReadModelMapperDependencies) {
  const floorPlanDrafts = event.floorPlanDrafts ?? [];
  const activeDraft =
    floorPlanDrafts.find((draft) => draft.isActive) ??
    floorPlanDrafts.find((draft) => draft.floorPlanId === event.floorPlanId);

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
    guestAccessCode: dependencies.guestReader.guestAccessCode(event),
    activeFloorPlanDraftId: activeDraft?.id,
    floorPlanDrafts: floorPlanDrafts.map((draft) => dependencies.floorplanReader.mapFloorPlanDraft(draft)),
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

export function mapBriefing(briefing: OpsBriefing) {
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

export function mapComplianceRule(rule: OpsComplianceRule) {
  return {
    id: rule.id,
    eventId: rule.eventId ?? null,
    eventType: rule.eventType,
    phase: rule.phase,
    severity: rule.severity,
    layer: rule.layer,
    conditionKey: rule.conditionKey,
    title: rule.title,
    note: rule.note,
    active: rule.active,
    createdAt: timestamp(rule.createdAt),
    updatedAt: timestamp(rule.updatedAt),
  };
}

export function mapComplianceCheck(check: OpsComplianceCheck) {
  const expanded = check as OpsComplianceCheck & {
    ruleId?: string | null;
    severity?: string;
    phase?: string;
    conditionKey?: string;
    resolvedAt?: Date | null;
    resolvedBy?: string | null;
    overrideReason?: string | null;
    overrideAt?: Date | null;
    overrideBy?: string | null;
  };
  return {
    id: check.id,
    eventId: check.eventId,
    ruleId: expanded.ruleId ?? null,
    layer: check.layer as 'Must-Fix' | 'Should-Fix' | 'Advisory',
    severity: expanded.severity ?? 'must_fix',
    phase: expanded.phase ?? 'planning',
    conditionKey: expanded.conditionKey ?? '',
    title: check.title,
    status: check.status as 'open' | 'resolved' | 'overridden',
    note: check.note,
    resolvedAt: expanded.resolvedAt ? timestamp(expanded.resolvedAt) : null,
    resolvedBy: expanded.resolvedBy ?? null,
    overrideReason: expanded.overrideReason ?? null,
    overrideAt: expanded.overrideAt ? timestamp(expanded.overrideAt) : null,
    overrideBy: expanded.overrideBy ?? null,
  };
}

export function mapPostEventDocument(document: OpsPostEventDocument) {
  return {
    id: document.id,
    eventId: document.eventId,
    title: document.title,
    status: document.status,
  };
}

export function mapEventInsight(insight: OpsEventInsight) {
  return {
    id: insight.id,
    eventId: insight.eventId,
    summary: insight.summary,
    highlights: Array.isArray(insight.highlights) ? insight.highlights : [],
    risks: Array.isArray(insight.risks) ? insight.risks : [],
    supplierNotes: Array.isArray(insight.supplierNotes) ? insight.supplierNotes : [],
    financialSummary: insight.financialSummary ?? {},
    documentSummary: insight.documentSummary ?? {},
    feedbackSummary: insight.feedbackSummary ?? {},
    generatedAt: timestamp(insight.generatedAt),
  };
}

export function mapNotificationLog(log: OpsNotificationLog) {
  return {
    id: log.id,
    eventId: log.eventId,
    recipient: log.recipient,
    message: log.message,
    channel: log.channel,
    status: log.status,
    createdAt: timestamp(log.createdAt),
    acknowledgedAt: log.acknowledgedAt ? timestamp(log.acknowledgedAt) : null,
  };
}
