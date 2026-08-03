export type SupplierSession = {
  id: string;
  name: string;
  email: string;
  role: string;
  organization: string;
  signedInAt: string;
  /**
   * Bearer token issued by POST /api/auth/login. Persisted so supplier reads can
   * authenticate as themselves instead of asserting `?actorRole=supplier` in the
   * query string, which any caller could forge (PA-284).
   */
  accessToken: string;
  expiresAt: string;
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
