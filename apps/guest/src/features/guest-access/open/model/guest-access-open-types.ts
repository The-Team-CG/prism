import type { PrismGuestEventPass } from "@prism/types";

export type GuestSession = PrismGuestEventPass & {
  guestName: string;
  openedAt: string;
};

export type GuestAccessOpenStatus = "idle" | "loading" | "ready" | "error";

export type GuestAccessOpenDraft = {
  guestName: string;
  accessCode: string;
};
