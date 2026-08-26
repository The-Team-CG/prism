import type { PrismAuthenticatedSession } from "@prism/types";

export type SupplierSignInDraft = {
  email: string;
  password: string;
};

export type SupplierSignInStatus = "idle" | "loading" | "ready" | "error";

export type SupplierSampleAccount = {
  email: string;
  password: string;
  label: string;
  tier: string;
};

export type SupplierAuthUser = Omit<PrismAuthenticatedSession, "signedInAt">;
