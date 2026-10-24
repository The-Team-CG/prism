import { redirect } from "next/navigation";
import { safeNextPath } from "@prism/types";

export default async function GuestSignInRedirect({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const nextValue = Array.isArray(next) ? next[0] : next;
  redirect(`/open?next=${encodeURIComponent(safeNextPath(nextValue, "/dashboard"))}`);
}
