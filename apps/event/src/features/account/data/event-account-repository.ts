import type { ChangeOwnPasswordInput, PrismCurrentUser, PrismOwnSignIn, UpdateOwnProfileInput } from "@prism/types";
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

export const eventAccountRepository = {
  updateName: (input: UpdateOwnProfileInput) => eventApi.auth.updateMe(input),
  changePassword: (input: ChangeOwnPasswordInput) => eventApi.auth.changeMyPassword(input),
};
