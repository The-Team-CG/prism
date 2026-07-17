export type SupplierSession = {
  id: string;
  name: string;
  email: string;
  role: string;
  organization: string;
  signedInAt: string;
};

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

export type SupplierAuthUser = Omit<SupplierSession, "signedInAt">;
