import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

const future = new Date(Date.now() + 3_600_000).toISOString();
const past = "2001-01-01T00:00:00.000Z";

describe("client proxy navigation guard", () => {
  it.each([
    { cookie: undefined, redirected: true },
    { cookie: `prism_client_session=${past}`, redirected: true },
    { cookie: `prism_client_session=${future}`, redirected: false },
  ])("redirects signed-out dashboard visits to sign-in (cookie: $cookie)", ({ cookie, redirected }) => {
    const request = new NextRequest("https://prism.test/dashboard/events?tab=open", {
      headers: cookie ? { cookie } : {},
    });

    const response = proxy(request);

    if (redirected) {
      expect(response.headers.get("location")).toBe(
        "https://prism.test/sign-in?next=%2Fdashboard%2Fevents%3Ftab%3Dopen",
      );
    } else {
      expect(response.headers.get("location")).toBeNull();
    }
  });
});
