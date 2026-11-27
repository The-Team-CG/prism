import { SignInView } from "@/features/client-auth/sign-in";

/** The shared "Sign in to P.R.I.S.M." page: anyone with an account signs in here and lands in their own portal. */
export default function Page() {
  return <SignInView frontDoor />;
}
