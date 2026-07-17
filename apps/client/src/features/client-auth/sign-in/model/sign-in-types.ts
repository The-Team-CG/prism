import type { PrismUser } from "@/lib/prism-api";

export type SignInDraft = {
  email: string;
  password: string;
};

export type SignInStatus = "idle" | "loading" | "signed_in" | "error";

export type ClientSampleUser = PrismUser;

export const PRIVACY_NOTICE_VERSION = "2026-05-01";

export const INITIAL_SIGN_IN_DRAFT: SignInDraft = {
  email: "ana@ayala.test",
  password: "prism-client",
};

export const SAMPLE_PASSWORDS: Record<string, string> = {
  "ana@ayala.test": "prism-client",
};

export const CLIENT_SAMPLE_USERS: ClientSampleUser[] = [
  {
    id: "usr_client",
    name: "Ana Reyes",
    email: "ana@ayala.test",
    role: "client",
    organization: "Ayala Corp",
    approvalStatus: "approved",
  },
];
