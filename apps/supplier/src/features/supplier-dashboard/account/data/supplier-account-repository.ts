import type { ChangeOwnPasswordInput, PrismCurrentUser, PrismOwnSession, PrismOwnSignIn, UpdateOwnProfileInput } from "@prism/types";
import { defineResource } from "@prism/portal-query";
import { supplierApi } from "@/lib/prism-api";

/** The signed-in supplier's own account as the API knows it. */
export const supplierCurrentUserResource = defineResource<void, PrismCurrentUser>({
  name: "supplier.current-user",
  fetch: () => supplierApi.auth.me(),
});

/** Their own latest sign-ins. */
export const supplierOwnSignInsResource = defineResource<void, PrismOwnSignIn[]>({
  name: "supplier.own-sign-ins",
  fetch: () => supplierApi.auth.mySignIns(),
});

/** The browsers they are signed in on now. */
export const supplierOwnSessionsResource = defineResource<void, PrismOwnSession[]>({
  name: "supplier.own-sessions",
  fetch: () => supplierApi.auth.mySessions(),
});

export const supplierAccountRepository = {
  requestEmailChange: (input: { newEmail: string; password: string }) => supplierApi.auth.requestEmailChange(input),
  cancelEmailChange: () => supplierApi.auth.cancelEmailChange(),
  startTwoStep: (password: string) => supplierApi.auth.startMyTwoFactor(password),
  enableTwoStep: (code: string) => supplierApi.auth.enableMyTwoFactor(code),
  disableTwoStep: (password: string) => supplierApi.auth.disableMyTwoFactor(password),
  signOutSession: (sessionId: string) => supplierApi.auth.signOutSession(sessionId),
  signOutOtherSessions: () => supplierApi.auth.signOutOtherSessions(),
  updateName: (input: UpdateOwnProfileInput) => supplierApi.auth.updateMe(input),
  changePassword: (input: ChangeOwnPasswordInput) => supplierApi.auth.changeMyPassword(input),
};
