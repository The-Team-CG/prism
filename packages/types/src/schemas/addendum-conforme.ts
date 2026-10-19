import { z } from "zod";

const sha256HexSchema = z.string().regex(/^[a-f0-9]{64}$/i, "A SHA-256 document hash is required");

/** PMCM issues one immutable addendum conforme document version; the server hashes the stored content. */
export const issueAddendumConformeSchema = z.object({
  documentVersion: z.number().int().positive(),
  documentContent: z.string().trim().min(20).max(50_000),
});
export type IssueAddendumConformeInput = z.infer<typeof issueAddendumConformeSchema>;

/**
 * Client acknowledgement and PMCM countersignature both bind to the version and hash the signer was shown,
 * so a replaced or tampered document cannot be signed by accident.
 */
export const signAddendumConformeSchema = z.object({
  executionId: z.string().trim().min(1).max(128),
  documentVersion: z.number().int().positive(),
  documentSha256: sha256HexSchema,
  consentAccepted: z.literal(true),
});
export type SignAddendumConformeInput = z.infer<typeof signAddendumConformeSchema>;

export type PrismAddendumConformeStatus = "awaiting_client" | "awaiting_pmcm" | "completed" | "superseded";

export interface PrismAddendumConformeSignature {
  id: string;
  actorRole: "client" | "pmcm";
  actorName: string;
  consentTextVersion: string;
  signedAt: string;
}

/** PMCM register view of one addendum conforme version, including who issued and signed it. */
export interface PrismAddendumConformeExecution {
  id: string;
  addendumId: string;
  eventId: string;
  addendumVersionNumber: number;
  documentVersion: number;
  documentContent: string;
  documentSha256: string;
  status: PrismAddendumConformeStatus;
  issuedBy: string;
  createdAt: string;
  completedAt: string | null;
  signatures: PrismAddendumConformeSignature[];
}

/**
 * Client projection: the document the client acknowledges and where it stands. PMCM actor identities, the
 * issuer, snapshots, comparison detail, and superseded versions are not part of this shape.
 */
export interface PrismClientAddendumConforme {
  id: string;
  addendumId: string;
  eventId: string;
  addendumVersionNumber: number;
  addendumTitle: string;
  addendumSummary: string;
  documentVersion: number;
  documentContent: string;
  documentSha256: string;
  status: Exclude<PrismAddendumConformeStatus, "superseded">;
  clientAcknowledgedAt: string | null;
  completedAt: string | null;
}
