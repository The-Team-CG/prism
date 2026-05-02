import { redirect } from "next/navigation";

export default function GuestSignInRedirect() {
  redirect("/open");
}
