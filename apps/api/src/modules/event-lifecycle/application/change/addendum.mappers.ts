import { addendumPlannedImpactsSchema, type PrismAddendum, type PrismAddendumStatus } from '@prism/types';
import { mapAddendumConformeExecution } from './addendum-conforme.mappers';

type AddendumRow = {
  id: string;
  eventId: string;
  versionNumber: number;
  title: string;
  summary: string;
  status: string;
  documentId: string | null;
  documentState: string;
  comparison: unknown;
  financialDelta: number;
  issuedAt: Date;
  effectiveAt: Date | null;
  withdrawnAt: Date | null;
  withdrawalReason: string | null;
  plannedImpacts: unknown;
  conformeExecution?: Parameters<typeof mapAddendumConformeExecution>[0] | null;
};

export function mapAddendum(value: AddendumRow): PrismAddendum {
  return {
    id: value.id,
    eventId: value.eventId,
    versionNumber: value.versionNumber,
    title: value.title,
    summary: value.summary,
    status: value.status as PrismAddendumStatus,
    documentId: value.documentId ?? '',
    documentState: value.documentState as 'pending' | 'available',
    signatureMethod: 'scanned_document',
    comparison: value.comparison as PrismAddendum['comparison'],
    financialDelta: value.financialDelta,
    issuedAt: value.issuedAt.toISOString(),
    effectiveAt: value.effectiveAt?.toISOString() ?? null,
    withdrawnAt: value.withdrawnAt?.toISOString() ?? null,
    withdrawalReason: value.withdrawalReason,
    plannedImpacts: value.plannedImpacts === null ? null : addendumPlannedImpactsSchema.parse(value.plannedImpacts),
    conforme: value.conformeExecution ? mapAddendumConformeExecution(value.conformeExecution) : null,
  };
}

/**
 * Supplier quote lines and the planned commercial effect are PMCM cost data. Every other reader gets the contract-level
 * comparison only. The withdrawal reason is client-visible by decision and stays in the response for everyone.
 */
export function presentAddendumFor(addendum: PrismAddendum, includeInternalCosts: boolean): PrismAddendum {
  if (includeInternalCosts) return addendum;
  return { ...addendum, comparison: { contract: addendum.comparison.contract, quotes: [] }, plannedImpacts: null };
}
