import { eventApi as eventOpsClient, eventApiRequest as request } from "@/lib/prism-api";
import type { PrismApprovalRequest } from "@prism/types";

export const identityCommands = {
approveApprovalRequest: (requestId: string) =>
    request<PrismApprovalRequest>(`/api/auth/approval-requests/${requestId}/approve`, { method: "PATCH" }),
declineApprovalRequest: (requestId: string) =>
    request<PrismApprovalRequest>(`/api/auth/approval-requests/${requestId}/decline`, { method: "PATCH" }),
};
