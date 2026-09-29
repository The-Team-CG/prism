export type SignInDraft = {
  email: string;
  password: string;
};

export type SignInStatus = "idle" | "loading" | "signed_in" | "error";

export const INITIAL_SIGN_IN_DRAFT: SignInDraft = {
  email: "",
  password: "",
};
