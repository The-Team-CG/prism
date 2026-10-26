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
      requestPasswordReset: (email) =>
        prismRequest(
          "/auth/password-reset/request",
          withBase(authOptions, { method: "POST", body: { email } }),
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
