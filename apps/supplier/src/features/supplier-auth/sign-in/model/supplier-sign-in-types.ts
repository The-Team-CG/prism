export type SupplierSignInDraft = {
  email: string;
  password: string;
};

export type SupplierSignInStatus = "idle" | "loading" | "ready" | "error";
