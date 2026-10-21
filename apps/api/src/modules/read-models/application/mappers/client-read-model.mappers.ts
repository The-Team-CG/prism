import type { OpsBriefing, OpsDocument } from '@prisma/client';

function timestamp(value: Date) {
  return value.toISOString();
}

export function mapClientDocument(document: OpsDocument) {
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

export function mapClientBriefing(briefing: OpsBriefing) {
  return {
    eventId: briefing.eventId,
    venue: briefing.venue,
    guestCount: briefing.guestCount,
    budgetRange: briefing.budgetRange,
    serviceRequirements: Array.isArray(briefing.serviceRequirements)
      ? (briefing.serviceRequirements as string[])
      : [],
    notes: briefing.notes,
    submittedAt: timestamp(briefing.submittedAt),
  };
}
