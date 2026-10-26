import type { PrismAccountInvitationOutcome } from "@prism/types";

export type InvitationOutcomeFeedback = { tone: "success" | "error"; text: string };

/** One plain sentence per provisioning outcome. Only `invited` means the activation email was accepted. */
export function invitationOutcomeCopy(
  outcome: PrismAccountInvitationOutcome,
  recipientEmail: string,
): InvitationOutcomeFeedback {
  switch (outcome.outcome) {
    case "invited":
      return { tone: "success", text: `Invitation sent to ${recipientEmail}.` };
    case "existing_account":
      return { tone: "error", text: "This email already has an active account, so no invitation was sent." };
    case "account_not_active":
      return { tone: "error", text: "This email has an account that is not approved, so no invitation was sent." };
    case "role_conflict":
      return { tone: "error", text: "This email already belongs to an account with a different role." };
    case "delivery_failed":
      return { tone: "error", text: "The invitation email could not be delivered. Try again shortly." };
  }
}
