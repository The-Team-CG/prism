import { recordLogisticsCompletionSchema, type RecordLogisticsCompletionInput } from "@prism/types";

export type LogisticsCompletionDraft = {
  assetReturnsVerified: boolean;
  completionSummary: string;
  privateNotes: string;
  correctionReason: string;
};

export type LogisticsCompletionInputResult =
  | { ok: true; input: RecordLogisticsCompletionInput }
  | { ok: false; message: string };

/** Turns the PMCM form into the shared write contract. `replacing` is true once a record already exists. */
export function buildLogisticsCompletionInput(draft: LogisticsCompletionDraft, replacing: boolean): LogisticsCompletionInputResult {
  if (!draft.assetReturnsVerified) {
    return { ok: false, message: "Confirm asset returns before recording logistics completion." };
  }
  if (replacing && !draft.correctionReason.trim()) {
    return { ok: false, message: "Add a correction reason to replace the recorded logistics completion." };
  }
  const parsed = recordLogisticsCompletionSchema.safeParse({
    assetReturnsVerified: true,
    completionSummary: draft.completionSummary,
    privateNotes: draft.privateNotes,
    correctionReason: replacing ? draft.correctionReason : undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the logistics completion details." };
  }
  return { ok: true, input: parsed.data };
}
