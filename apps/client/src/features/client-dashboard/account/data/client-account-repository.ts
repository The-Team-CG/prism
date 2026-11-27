import type { ChangeOwnPasswordInput, PrismCurrentUser, PrismOwnSession, PrismOwnSignIn, UpdateOwnProfileInput } from "@prism/types";
import { defineResource } from "@prism/portal-query";
import { clientApi } from "@/lib/prism-api";

/** The signed-in client's own account as the API knows it. */
export const clientCurrentUserResource = defineResource<void, PrismCurrentUser>({
  name: "client.current-user",
  fetch: () => clientApi.auth.me(),
});

/** Their own latest sign-ins. */
export const clientOwnSignInsResource = defineResource<void, PrismOwnSignIn[]>({
  name: "client.own-sign-ins",
  fetch: () => clientApi.auth.mySignIns(),
});

/** The browsers they are signed in on now. */
export const clientOwnSessionsResource = defineResource<void, PrismOwnSession[]>({
  name: "client.own-sessions",
  fetch: () => clientApi.auth.mySessions(),
});

export const clientAccountRepository = {
  requestEmailChange: (input: { newEmail: string; password: string }) => clientApi.auth.requestEmailChange(input),
  cancelEmailChange: () => clientApi.auth.cancelEmailChange(),
  startTwoStep: (password: string) => clientApi.auth.startMyTwoFactor(password),
  enableTwoStep: (code: string) => clientApi.auth.enableMyTwoFactor(code),
  makeBackupCodes: (password: string) => clientApi.auth.regenerateMyBackupCodes(password),
  disableTwoStep: (password: string) => clientApi.auth.disableMyTwoFactor(password),
  signOutSession: (sessionId: string) => clientApi.auth.signOutSession(sessionId),
  signOutOtherSessions: () => clientApi.auth.signOutOtherSessions(),
  updateName: (input: UpdateOwnProfileInput) => clientApi.auth.updateMe(input),
  changePassword: (input: ChangeOwnPasswordInput) => clientApi.auth.changeMyPassword(input),
};
