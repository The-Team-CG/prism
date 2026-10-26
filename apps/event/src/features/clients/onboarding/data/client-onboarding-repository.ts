import type { PrismPortalInvitationResend } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const clientOnboardingRepository = {
  resendPortalInvitation: (inquiryId: string): Promise<PrismPortalInvitationResend> =>
    eventApi.inquiries.resendPortalInvitation(inquiryId),
};
