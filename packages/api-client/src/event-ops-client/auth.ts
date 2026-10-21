import { prismRequest } from "../http";
import type { EventOpsClient, EventOpsClientOptions } from "./contracts";
import { withBase } from "./shared";

export function createAuthClient(
  options: EventOpsClientOptions,
): Pick<EventOpsClient, "auth"> {
  return {
    auth: {
      login: (input) =>
        prismRequest("/auth/login", withBase(options, { method: "POST", body: input })),
      requestApproval: (input) =>
        prismRequest(
          "/auth/approval-requests",
          withBase(options, { method: "POST", body: input }),
        ),
      setupTwoFactor: (token) =>
        prismRequest(
          "/auth/2fa/setup",
          withBase(options, { method: "POST", body: { token } }),
        ),
      verifyTwoFactor: (input) =>
        prismRequest(
          "/auth/2fa/verify",
          withBase(options, { method: "POST", body: input }),
        ),
      requestPasswordReset: (email) =>
        prismRequest(
          "/auth/password-reset/request",
          withBase(options, { method: "POST", body: { email } }),
        ),
      consumePasswordReset: (token, password) =>
        prismRequest(
          "/auth/password-reset/consume",
          withBase(options, { method: "POST", body: { token, password } }),
        ),
    },
  };
}
