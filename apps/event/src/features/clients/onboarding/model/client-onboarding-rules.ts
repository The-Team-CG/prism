import type { PrismInquiry, PrismUserRole } from "@prism/types";

/** Mirrors the inquiry workflow: PMCM admins may re-send the portal invitation until the client has opened it. */
export function canResendPortalInvitation(
  inquiry: Pick<PrismInquiry, "portalInvitationStatus">,
  viewerRole: PrismUserRole | null,
) {
  const status = inquiry.portalInvitationStatus;
  return viewerRole === "pmcm-admin" && (status === "not_sent" || status === "expired");
}

export type OnboardingTimelineStep = {
  title: string;
  done: boolean;
  meta?: string;
};

function invitationSent(inquiry: PrismInquiry) {
  const status = inquiry.portalInvitationStatus;
  return Boolean(inquiry.portalInvitationSentAt) || status === "sent" || status === "opened" || status === "expired";
}

function invitationOpened(inquiry: PrismInquiry) {
  return Boolean(inquiry.portalInvitationOpenedAt) || inquiry.portalInvitationStatus === "opened";
}

export function onboardingTimelineSteps(
  inquiry: PrismInquiry,
  formatTimestamp: (value?: string | null) => string,
): OnboardingTimelineStep[] {
  const expired = inquiry.portalInvitationStatus === "expired";
  return [
    { title: "Inquiry accepted", done: Boolean(inquiry.acceptedAt), meta: formatTimestamp(inquiry.acceptedAt) },
    { title: "Conforme sent", done: Boolean(inquiry.conformeSentAt), meta: formatTimestamp(inquiry.conformeSentAt) },
    { title: "Conforme signed", done: Boolean(inquiry.conformeSignedAt), meta: formatTimestamp(inquiry.conformeSignedAt) },
    { title: "Invitation sent", done: invitationSent(inquiry), meta: formatTimestamp(inquiry.portalInvitationSentAt) },
    {
      title: expired ? "Invitation expired" : "Invitation opened",
      done: expired || invitationOpened(inquiry),
      meta: formatTimestamp(expired ? inquiry.portalInvitationExpiresAt : inquiry.portalInvitationOpenedAt),
    },
    { title: "Portal activated", done: Boolean(inquiry.portalActivatedAt), meta: formatTimestamp(inquiry.portalActivatedAt) },
  ];
}

export function reminderEvidenceCopy(
  inquiry: PrismInquiry,
  formatTimestamp: (value?: string | null) => string,
) {
  if (inquiry.lastConformeReminderAt) {
    return `Last reminder: ${formatTimestamp(inquiry.lastConformeReminderAt)}`;
  }
  if (inquiry.reminderDueAt) {
    return `Next reminder due: ${formatTimestamp(inquiry.reminderDueAt)}`;
  }
  return "Reminder schedule starts after conforme is sent.";
}
