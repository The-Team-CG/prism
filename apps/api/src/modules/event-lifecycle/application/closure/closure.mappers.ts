import type { OpsEvent, OpsEventInsight, OpsFloorPlanDraft, OpsPostEventDocument, OpsEventWrapUp } from '@prisma/client';
import type { FloorplanReader } from '@prism/contexts/floorplan';
import type { GuestReader } from '@prism/contexts/operations';

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function timestamp(value: Date) {
  return value.toISOString();
}

type EventWithDrafts = OpsEvent & { floorPlanDrafts?: OpsFloorPlanDraft[] };

export function mapArchivedEventSearchHit(event: OpsEvent & {
  inquiry?: { eventType?: string } | null;
  briefings?: Array<{ venue?: string }>;
}) {
  return {
    id: event.id,
    eventName: event.eventName,
    clientName: event.clientName,
    eventDate: isoDate(event.eventDate),
    venue: event.briefings?.[0]?.venue ?? '',
    eventType: event.inquiry?.eventType ?? '',
    archivedAt: event.archivedAt ? timestamp(event.archivedAt) : null,
  };
}

export function mapClosureEvent(event: EventWithDrafts, dependencies: { guestReader: GuestReader; floorplanReader: FloorplanReader }) {
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
    actualEndedAt: event.actualEndedAt?.toISOString() ?? null,
    actualEndedBy: event.actualEndedBy,
    archived: event.archived,
    floorPlanStatus: event.floorPlanStatus,
    floorPlanId: event.floorPlanId,
    guestAccessCode: dependencies.guestReader.guestAccessCode(event),
    activeFloorPlanDraftId: activeDraft?.id,
    floorPlanDrafts: floorPlanDrafts.map((draft) => dependencies.floorplanReader.mapFloorPlanDraft(draft)),
  };
}

export function mapPostEventDocument(document: OpsPostEventDocument) {
  return {
    id: document.id,
    eventId: document.eventId,
    title: document.title,
    status: document.status,
    ...(document.required !== undefined ? { required: document.required } : {}),
    ...(document.clientAcknowledgedAt !== undefined ? { clientAcknowledgedAt: document.clientAcknowledgedAt?.toISOString() ?? null } : {}),
    ...(document.clientAcknowledgedBy !== undefined ? { clientAcknowledgedBy: document.clientAcknowledgedBy } : {}),
    ...(document.clientAcknowledgementNote !== undefined ? { clientAcknowledgementNote: document.clientAcknowledgementNote } : {}),
  };
}

export function mapEventWrapUp(record: OpsEventWrapUp) {
  return {
    id: record.id, eventId: record.eventId, mode: record.mode, status: record.status,
    activatedAt: record.activatedAt.toISOString(), deadlineAt: record.deadlineAt.toISOString(),
    twelveHourReminderAt: record.twelveHourReminderAt?.toISOString() ?? null,
    twentyFourHourReminderAt: record.twentyFourHourReminderAt?.toISOString() ?? null,
    requiredItems: record.requiredItems ?? {}, sections: record.sections ?? {},
    clientAcknowledgedAt: record.clientAcknowledgedAt?.toISOString() ?? null,
    clientAcknowledgedBy: record.clientAcknowledgedBy,
    clientAcknowledgementNote: record.clientAcknowledgementNote,
    completedAt: record.completedAt?.toISOString() ?? null, completedBy: record.completedBy,
  };
}

export function mapEventInsight(insight: OpsEventInsight) {
  const expanded = insight as OpsEventInsight & { updatedAt?: Date };
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
    dimensions: (insight as OpsEventInsight & { dimensions?: unknown }).dimensions ?? {},
    privateNotes: insight.privateNotes,
    generatedAt: timestamp(insight.generatedAt),
    updatedAt: expanded.updatedAt ? timestamp(expanded.updatedAt) : timestamp(insight.generatedAt),
  };
}

export function mapClientVisibleEventInsight(insight: OpsEventInsight) {
  const { privateNotes: _privateNotes, ...visible } = mapEventInsight(insight);
  return visible;
}
