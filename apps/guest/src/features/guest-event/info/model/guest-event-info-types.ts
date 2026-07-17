import type { PrismGuestEventPass } from "@prism/types";

export type GuestEventInfoStatus = "idle" | "loading" | "ready" | "error";

export type GuestEventInfoRow = {
  label: string;
  value: string;
};

export type GuestEventInfoViewState = {
  event: PrismGuestEventPass | null;
  status: GuestEventInfoStatus;
  error: string | null;
  infoRows: GuestEventInfoRow[];
  qrUrl: string | null;
};
