import { NextResponse, type NextRequest } from "next/server";
import { PRISM_SESSION_COOKIE_NAMES, isPrismSessionCookieActive } from "@prism/types";

/**
 * Navigation guard only: a signed-out visitor is sent to sign-in before the dashboard renders.
 * The cookie is a hint the browser can edit. Every API request is still verified by the API.
 */
export function proxy(request: NextRequest) {
  if (isPrismSessionCookieActive(request.cookies.get(PRISM_SESSION_COOKIE_NAMES.event)?.value, new Date())) {
    return NextResponse.next();
  }
  const signIn = request.nextUrl.clone();
  signIn.pathname = "/sign-in";
  signIn.search = "";
  signIn.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
