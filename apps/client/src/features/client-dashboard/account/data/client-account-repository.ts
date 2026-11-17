import type { ChangeOwnPasswordInput, PrismCurrentUser, PrismOwnSignIn, UpdateOwnProfileInput } from "@prism/types";
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

export const clientAccountRepository = {
  updateName: (input: UpdateOwnProfileInput) => clientApi.auth.updateMe(input),
  changePassword: (input: ChangeOwnPasswordInput) => clientApi.auth.changeMyPassword(input),
};
