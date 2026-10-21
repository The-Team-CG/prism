export interface PrismConformeSignature {
  id: string;
  actorRole: string;
  actorName: string;
  consentTextVersion: string;
  signedAt: string;
}

export interface PrismConformeExecution {
  id: string;
  inquiryId: string;
  eventId: string | null;
  templateVersion: number;
  templateSha256: string;
  documentContent: string;
  documentSha256: string;
  status: 'awaiting_client' | 'awaiting_pmcm' | 'completed' | 'superseded';
  createdAt: string;
  completedAt: string | null;
  signatures: PrismConformeSignature[];
}

export type PrismAddendumConformeStatus = 'awaiting_client' | 'awaiting_pmcm' | 'completed';

export interface PrismAddendumConformeSignature {
  id: string;
  actorRole: 'client' | 'pmcm';
  actorName: string;
  consentTextVersion: string;
  signedAt: string;
}

/**
 * Immutable addendum conforme: the document is snapshotted once per addendum version and bound to its SHA-256.
 * The client acknowledges first, then PMCM countersigns; a completed execution is never replaced.
 */
export interface PrismAddendumConformeExecution {
  id: string;
  addendumId: string;
  eventId: string;
  versionNumber: number;
  documentContent: string;
  documentSha256: string;
  status: PrismAddendumConformeStatus;
  createdAt: string;
  completedAt: string | null;
  signatures: PrismAddendumConformeSignature[];
}

/** Reference to the executed addendum conforme carried by the commercial billing record it changed. */
export interface PrismAddendumConformeTraceReference {
  executionId: string;
  addendumId: string;
  versionNumber: number;
  documentSha256: string;
  executedAt: string;
}
