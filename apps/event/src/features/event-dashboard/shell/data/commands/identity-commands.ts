import { eventApi as eventOpsClient } from "@/lib/prism-api";
import type { CreateAccountInvitationInput } from "@prism/types";

export const identityCommands = {
approveApprovalRequest: (requestId: string) => eventOpsClient.auth.approveApprovalRequest(requestId),
declineApprovalRequest: (requestId: string) => eventOpsClient.auth.declineApprovalRequest(requestId),
unlockUser: (userId: string) => eventOpsClient.auth.unlockUser(userId),
resetUserTwoFactor: (userId: string) => eventOpsClient.auth.resetUserTwoFactor(userId),
resendAccountInvitation: (userId: string) => eventOpsClient.auth.resendAccountInvitation(userId),
inviteStaff: (input: CreateAccountInvitationInput) => eventOpsClient.auth.inviteStaff(input),
};
