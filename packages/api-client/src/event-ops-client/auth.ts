import type { PrismApprovalRequest } from "@prism/types";
import { prismRequest } from "../http";
import type { EventOpsClient, EventOpsClientOptions } from "./contracts";
import { withBase } from "./shared";

export function createAuthClient(
  options: EventOpsClientOptions,
): Pick<EventOpsClient, "auth"> {
  // Sign-in and password endpoints answer 401 for bad credentials; they must not trigger session expiry.
  const authOptions: EventOpsClientOptions = {
    baseUrl: options.baseUrl,
    getAuthToken: options.getAuthToken,
  };
  return {
    auth: {
      login: (input) =>
        prismRequest("/auth/login", withBase(authOptions, { method: "POST", body: input })),
      requestApproval: (input) =>
        prismRequest(
          "/auth/approval-requests",
          withBase(authOptions, { method: "POST", body: input }),
        ),
      logout: () =>
        prismRequest<void>("/auth/logout", withBase(options, { method: "POST" })),
      acknowledgePrivacyNotice: (input) =>
        prismRequest<void>(
          "/auth/privacy-notice/acknowledge",
          withBase(options, { method: "POST", body: input }),
        ),
      me: () => prismRequest("/auth/me", withBase(options, { method: "GET" })),
      updateMe: (input) => prismRequest("/auth/me", withBase(options, { method: "PATCH", body: input })),
      changeMyPassword: (input) => prismRequest<void>("/auth/me/password", withBase(options, { method: "POST", body: input })),
      mySignIns: () => prismRequest("/auth/me/sign-ins", withBase(options, { method: "GET" })),
      requestEmailChange: (input) => prismRequest("/auth/me/email", withBase(options, { method: "POST", body: input })),
      cancelEmailChange: () => prismRequest<void>("/auth/me/email", withBase(options, { method: "DELETE" })),
      confirmEmailChange: (token) => prismRequest("/auth/email-change/confirm", withBase(authOptions, { method: "POST", body: { token } })),
      startMyTwoFactor: (password) => prismRequest("/auth/me/two-factor/setup", withBase(options, { method: "POST", body: { password } })),
      enableMyTwoFactor: (code) => prismRequest<{ backupCodes: string[] }>("/auth/me/two-factor/enable", withBase(options, { method: "POST", body: { code } })),
      regenerateMyBackupCodes: (password) => prismRequest<{ backupCodes: string[] }>("/auth/me/two-factor/backup-codes", withBase(options, { method: "POST", body: { password } })),
      disableMyTwoFactor: (password) => prismRequest<void>("/auth/me/two-factor/disable", withBase(options, { method: "POST", body: { password } })),
      mySessions: () => prismRequest("/auth/me/sessions", withBase(options, { method: "GET" })),
      signOutSession: (sessionId) =>
        prismRequest<void>(`/auth/me/sessions/${encodeURIComponent(sessionId)}`, withBase(options, { method: "DELETE" })),
      signOutOtherSessions: () => prismRequest("/auth/me/sessions/sign-out-others", withBase(options, { method: "POST" })),
      approvalRequests: () =>
        prismRequest<PrismApprovalRequest[]>("/auth/approval-requests", withBase(options)),
      approveApprovalRequest: (requestId) =>
        prismRequest<PrismApprovalRequest>(
          `/auth/approval-requests/${encodeURIComponent(requestId)}/approve`,
          withBase(options, { method: "PATCH" }),
        ),
      declineApprovalRequest: (requestId) =>
        prismRequest<PrismApprovalRequest>(
          `/auth/approval-requests/${encodeURIComponent(requestId)}/decline`,
          withBase(options, { method: "PATCH" }),
        ),
      unlockUser: (userId) =>
        prismRequest(
          `/auth/users/${encodeURIComponent(userId)}/unlock`,
          withBase(options, { method: "PATCH" }),
        ),
      resetUserTwoFactor: (userId) =>
        prismRequest(
          `/auth/users/${encodeURIComponent(userId)}/two-factor/reset`,
          withBase(options, { method: "PATCH" }),
        ),
      setupTwoFactor: (token) =>
        prismRequest(
          "/auth/2fa/setup",
          withBase(authOptions, { method: "POST", body: { token } }),
        ),
      verifyTwoFactor: (input) =>
        prismRequest(
          "/auth/2fa/verify",
          withBase(authOptions, { method: "POST", body: input }),
        ),
      developmentTwoFactorQr: (token) =>
        prismRequest(
          "/auth/2fa/development-qr",
          withBase(authOptions, { method: "POST", body: { token }, cache: "no-store" }),
        ),
      requestPasswordReset: (email) =>
        prismRequest(
          "/auth/password-reset/request",
          withBase(authOptions, { method: "POST", body: { email } }),
        ),
      requestEmailSignInCode: (email) =>
        prismRequest(
          "/auth/email-code/request",
          withBase(authOptions, { method: "POST", body: { email } }),
        ),
      previewInvitation: (token) =>
        prismRequest(
          "/auth/activate/preview",
          withBase(authOptions, { method: "POST", body: { token } }),
        ),
      confirmInvitation: (token) =>
        prismRequest(
          "/auth/activate/confirm",
          withBase(authOptions, { method: "POST", body: { token } }),
        ),
      verifyEmailSignInCode: (input) =>
        prismRequest(
          "/auth/email-code/verify",
          withBase(authOptions, { method: "POST", body: input }),
        ),
      consumePasswordReset: (token, password) =>
        prismRequest(
          "/auth/password-reset/consume",
          withBase(authOptions, { method: "POST", body: { token, password } }),
        ),
      activateAccount: (input) =>
        prismRequest(
          "/auth/activate",
          withBase(options, { method: "POST", body: input }),
        ),
      inviteStaff: (input) =>
        prismRequest(
          "/auth/invitations",
          withBase(options, { method: "POST", body: input }),
        ),
      resendAccountInvitation: (userId) =>
        prismRequest(
          `/auth/invitations/${encodeURIComponent(userId)}/resend`,
          withBase(options, { method: "POST" }),
        ),
    },
  };
}
