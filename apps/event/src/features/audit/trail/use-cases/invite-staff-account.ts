import {
  createAccountInvitationSchema,
  type CreateAccountInvitationInput,
  type PrismAccountInvitationOutcome,
} from "@prism/types";
import {
  invitationOutcomeCopy,
  type InvitationOutcomeFeedback,
} from "@/features/pmcm-kit/model/invitation-outcome-copy";

export type StaffInvitationDraft = {
  name: string;
  email: string;
  organization: string;
  role: string;
};

/** Invalid drafts never reach the API; the first schema issue is shown to the admin. */
export async function inviteStaffAccount(
  draft: StaffInvitationDraft,
  invite: (input: CreateAccountInvitationInput) => Promise<PrismAccountInvitationOutcome>,
): Promise<InvitationOutcomeFeedback> {
  const parsed = createAccountInvitationSchema.safeParse(draft);
  if (!parsed.success) {
    const [firstIssue] = parsed.error.issues;
    return { tone: "error", text: firstIssue.message };
  }
  const outcome = await invite(parsed.data);
  return invitationOutcomeCopy(outcome, parsed.data.email);
}
