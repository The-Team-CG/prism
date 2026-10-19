import { privacyCorrectionPatchSchema, type PrivacyCorrectionPatch } from "@prism/types";

export type PrivacyCorrectionDraft = { name: string; email: string };

/** Turns the operator's raw form values into the shared, strict correction patch. Blank fields are left out. */
export function parsePrivacyCorrectionDraft(
  draft: PrivacyCorrectionDraft,
): { ok: true; patch: PrivacyCorrectionPatch } | { ok: false; message: string } {
  const candidate = {
    ...(draft.name.trim() ? { name: draft.name } : {}),
    ...(draft.email.trim() ? { email: draft.email } : {}),
  };
  const parsed = privacyCorrectionPatchSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Enter a corrected name or email" };
  }
  return { ok: true, patch: parsed.data };
}
