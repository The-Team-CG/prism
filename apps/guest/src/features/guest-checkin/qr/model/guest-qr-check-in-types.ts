import type {
  CreateGuestCheckInInput,
  PrismGuestEventPass,
} from "@prism/types";

export type GuestQrCheckInInput = Extract<CreateGuestCheckInInput, { checkInMode: "qr_pass" }>;

export type GuestQrCheckInStatus =
  | "loading"
  | "ready"
  | "insecure"
  | "submitting"
  | "retryable"
  | "invalid"
  | "success"
  | "error";

export type GuestQrCheckInState = {
  status: GuestQrCheckInStatus;
  event: PrismGuestEventPass | null;
  secure: boolean;
  hasPass: boolean;
  message: string | null;
};

export type GuestQrCheckInRepository = {
  fetchEventByAccessCode(accessCode: string): Promise<PrismGuestEventPass>;
  checkInQr(accessCode: string, input: GuestQrCheckInInput): Promise<unknown>;
};
