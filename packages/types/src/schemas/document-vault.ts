import { z } from "zod";
import { nonEmptyStringSchema, optionalTrimmedStringSchema } from "./common.js";

export const verifiedDocumentActorSchema = z.object({
  actorId: nonEmptyStringSchema,
  actorRole: z.enum(["pmcm-admin", "client", "coordinator", "supplier", "guest", "system", "unknown"]),
  actorEmail: z.string().trim().email(),
  actorName: nonEmptyStringSchema,
  eventId: optionalTrimmedStringSchema,
  supplierId: optionalTrimmedStringSchema,
  expiresAt: z.string().min(1),
});
export type VerifiedDocumentActor = z.infer<typeof verifiedDocumentActorSchema>;

export const documentKindSchema = z.enum([
  "signed_conforme",
  "proposal",
  "ce_proposal",
  "briefing_proposal",
  "supplier_contract",
  "billing_statement",
]);
export type DocumentKind = z.infer<typeof documentKindSchema>;

export const lifecycleDocumentRegistrationKindSchema = z.enum([
  "supplier_contract",
  "billing_statement",
]);
export type LifecycleDocumentRegistrationKind = z.infer<typeof lifecycleDocumentRegistrationKindSchema>;

export const documentLogicalTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("supplier_quote_request"), id: nonEmptyStringSchema }),
  z.object({ kind: z.literal("billing_statement"), id: nonEmptyStringSchema }),
]);
export type DocumentLogicalTarget = z.infer<typeof documentLogicalTargetSchema>;

export const registerLifecycleDocumentSchema = z.object({
  eventId: nonEmptyStringSchema,
  documentKind: lifecycleDocumentRegistrationKindSchema,
  logicalTarget: documentLogicalTargetSchema,
  fileName: nonEmptyStringSchema,
  generatedFileName: optionalTrimmedStringSchema,
  mimeType: optionalTrimmedStringSchema,
  sizeBytes: z.number().int().positive().optional(),
  validationStatus: z.literal("accepted").optional(),
  storageBucket: optionalTrimmedStringSchema,
  storageKey: optionalTrimmedStringSchema,
  status: z.enum(["submitted", "stored", "pending_storage"]),
  verifiedActor: verifiedDocumentActorSchema,
  idempotencyKey: optionalTrimmedStringSchema,
}).superRefine((value, ctx) => {
  const expectedTarget = value.documentKind === "supplier_contract"
    ? "supplier_quote_request"
    : value.documentKind === "billing_statement"
      ? "billing_statement"
      : null;
  if (expectedTarget && value.logicalTarget.kind !== expectedTarget) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["logicalTarget", "kind"],
      message: `${value.documentKind} documents require a ${expectedTarget} logical target`,
    });
  }
});
export type RegisterLifecycleDocumentInput = z.infer<typeof registerLifecycleDocumentSchema>;

export const documentReferencePurposeSchema = z.enum([
  "billing_source_evidence",
  "client_proposal_review",
]);
export type DocumentReferencePurpose = z.infer<typeof documentReferencePurposeSchema>;

export const documentReferenceLookupSchema = z.object({
  eventId: nonEmptyStringSchema,
  purpose: documentReferencePurposeSchema,
  documentId: optionalTrimmedStringSchema,
});
export type DocumentReferenceLookup = z.infer<typeof documentReferenceLookupSchema>;

export const prismDocumentReferenceSchema = z.object({
  id: nonEmptyStringSchema,
  eventId: nonEmptyStringSchema,
  kind: documentKindSchema,
  status: nonEmptyStringSchema,
  fileName: nonEmptyStringSchema,
});
export type PrismDocumentReference = z.infer<typeof prismDocumentReferenceSchema>;

export const documentRetentionPolicySchema = z.object({
  status: z.literal("pending_pmcm_policy"),
  retentionPeriod: nonEmptyStringSchema,
  deletionBehavior: nonEmptyStringSchema,
  redactionEnabled: z.literal(false),
});
export type DocumentRetentionPolicy = z.infer<typeof documentRetentionPolicySchema>;
