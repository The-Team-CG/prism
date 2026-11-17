import type { ChangeOwnPasswordInput, PrismCurrentUser, PrismOwnSession, PrismOwnSignIn, UpdateOwnProfileInput } from "@prism/types";
import { defineResource } from "@prism/portal-query";
import { eventApi } from "@/lib/prism-api";

/** The signed-in PMCM staff member's or coordinator's own account as the API knows it. */
export const eventCurrentUserResource = defineResource<void, PrismCurrentUser>({
  name: "event.current-user",
  fetch: () => eventApi.auth.me(),
});

/** Their own latest sign-ins. */
export const eventOwnSignInsResource = defineResource<void, PrismOwnSignIn[]>({
  name: "event.own-sign-ins",
  fetch: () => eventApi.auth.mySignIns(),
});

/** The browsers they are signed in on now. */
export const eventOwnSessionsResource = defineResource<void, PrismOwnSession[]>({
  name: "event.own-sessions",
  fetch: () => eventApi.auth.mySessions(),
});

export const eventAccountRepository = {
  signOutSession: (sessionId: string) => eventApi.auth.signOutSession(sessionId),
  signOutOtherSessions: () => eventApi.auth.signOutOtherSessions(),
  updateName: (input: UpdateOwnProfileInput) => eventApi.auth.updateMe(input),
  changePassword: (input: ChangeOwnPasswordInput) => eventApi.auth.changeMyPassword(input),
};
