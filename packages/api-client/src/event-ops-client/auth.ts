import { prismRequest } from "../http";
import type { EventOpsClient, EventOpsClientOptions } from "./contracts.js";
import { withBase } from "./shared.js";

export function createAuthClient(
  options: EventOpsClientOptions,
): Pick<EventOpsClient, "auth"> {
  return {
    auth: {
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
