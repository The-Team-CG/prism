import type { PrismGuestEventPass } from "@prism/types";

export type GuestSession = PrismGuestEventPass & {
  openedAt: string;
};

export type GuestAccessOpenStatus = "idle" | "loading" | "ready" | "error";

export type GuestAccessOpenDraft = {
  accessCode: string;
};
