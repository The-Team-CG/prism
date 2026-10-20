import type { PrismAddendumConformeExecution } from '@prism/types';

type ExecutionRow = {
  id: string;
  addendumId: string;
  eventId: string;
  versionNumber: number;
  documentContent: string;
  documentSha256: string;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
  signatures: Array<{ id: string; actorRole: string; actorName: string; consentTextVersion: string; signedAt: Date }>;
};

/** Explicit fields only: signer email, IP hash, and user-agent hash stay in the evidence record. */
export function mapAddendumConformeExecution(row: ExecutionRow): PrismAddendumConformeExecution {
  return {
    id: row.id,
    addendumId: row.addendumId,
    eventId: row.eventId,
    versionNumber: row.versionNumber,
    documentContent: row.documentContent,
    documentSha256: row.documentSha256,
    status: row.status as PrismAddendumConformeExecution['status'],
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    signatures: [...row.signatures]
      .sort((a, b) => a.signedAt.getTime() - b.signedAt.getTime())
      .map((signature) => ({
        id: signature.id,
        actorRole: signature.actorRole as 'client' | 'pmcm',
        actorName: signature.actorName,
        consentTextVersion: signature.consentTextVersion,
        signedAt: signature.signedAt.toISOString(),
      })),
  };
}
