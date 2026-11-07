import type { OpsComplianceCheck, OpsComplianceRule, OpsEvent, OpsEventInsight, OpsFloorPlanDraft, OpsNotificationLog, OpsPostEventDocument, OpsUser } from '@prisma/client';
import { mapBriefingSummary, mapDocument, mapInquirySummary } from '@prism/contexts/event-lifecycle';
import { mapAuditLog } from '@prism/contexts/platform-ops';
import { mapBillingSource, mapBillingStatement, mapPaymentMilestone, mapPaymentRecord, mapSupplierQuote, mapSupplierQuoteRequest } from '@prism/contexts/commercial';
import type { FloorplanReader } from '@prism/contexts/floorplan';
import type { GuestReader, RegistrationPlatformReader, StaffingReader } from '@prism/contexts/operations';
import { createPmcmDashboardMappers } from './event-read-model.mappers';

type EventWithDrafts = OpsEvent & { floorPlanDrafts?: OpsFloorPlanDraft[] };

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function timestamp(value: Date) {
  return value.toISOString();
}

export type EventReadModelMapperDependencies = {
  floorplanReader: FloorplanReader;
  guestReader: GuestReader;
};

export type PmcmReadModelMapperDependencies = EventReadModelMapperDependencies & {
  staffingReader: StaffingReader;
  registrationPlatformReader: RegistrationPlatformReader;
};

export function createPmcmReadModelMappers(dependencies: PmcmReadModelMapperDependencies) {
  return createPmcmDashboardMappers({
    coordinatorRoleRequirements: [],
    mapUser,
    mapInquiry: mapInquirySummary,
    mapEvent: (event) => mapEvent(event as EventWithDrafts, dependencies),
    mapDocument,
    mapBriefing: mapBriefingSummary,
    mapSupplierQuoteRequest,
    mapSupplierQuote,
    mapCoordinator: dependencies.staffingReader.mapCoordinator.bind(dependencies.staffingReader),
    mapCoordinatorAssignment: dependencies.staffingReader.mapCoordinatorAssignment.bind(dependencies.staffingReader),
    mapComplianceRule,
    mapComplianceCheck,
    mapBillingSource,
    mapBillingStatement,
    mapPaymentMilestone,
    mapPaymentRecord,
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
    walkInPolicy: event.walkInPolicy as 'closed' | 'open' | 'threshold',
    walkInThreshold: event.walkInThreshold,
    status: event.status,
    clientPortalStatus: event.clientPortalStatus as 'locked' | 'unlocked',
    clientEventDayViewEnabled: event.clientEventDayViewEnabled,
    proposalClientStatus: event.proposalClientStatus,
    readiness: event.readiness,
    actualEndedAt: event.actualEndedAt?.toISOString() ?? null,
    archived: event.archived,
    floorPlanStatus: event.floorPlanStatus,
    floorPlanId: event.floorPlanId,
    guestAccessCode: dependencies.guestReader.guestAccessCode(event),
    activeFloorPlanDraftId: activeDraft?.id,
    floorPlanDrafts: floorPlanDrafts.map((draft) => dependencies.floorplanReader.mapFloorPlanDraft(draft)),
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
    runId?: string | null;
    evaluationStatus?: string;
    evidence?: unknown;
    definitionStatus?: string;
    remediation?: string;
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
    runId: expanded.runId ?? null,
    evaluationStatus: (expanded.evaluationStatus ?? 'not_satisfied') as 'satisfied' | 'not_satisfied' | 'not_applicable',
    evidence: Array.isArray(expanded.evidence) ? expanded.evidence.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [],
    definitionStatus: expanded.definitionStatus ?? 'PROVISIONAL',
    remediation: expanded.remediation ?? check.note,
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
