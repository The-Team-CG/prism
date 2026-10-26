import { eventApi as eventOpsClient, eventApiRequest as request } from "@/lib/prism-api";
import type { CreateAccountInvitationInput, PrismApprovalRequest } from "@prism/types";

export const identityCommands = {
approveApprovalRequest: (requestId: string) =>
    request<PrismApprovalRequest>(`/api/auth/approval-requests/${requestId}/approve`, { method: "PATCH" }),
declineApprovalRequest: (requestId: string) =>
    request<PrismApprovalRequest>(`/api/auth/approval-requests/${requestId}/decline`, { method: "PATCH" }),
unlockUser: (userId: string) => eventOpsClient.auth.unlockUser(userId),
resetUserTwoFactor: (userId: string) => eventOpsClient.auth.resetUserTwoFactor(userId),
resendAccountInvitation: (userId: string) => eventOpsClient.auth.resendAccountInvitation(userId),
inviteStaff: (input: CreateAccountInvitationInput) => eventOpsClient.auth.inviteStaff(input),
};
