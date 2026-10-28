import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PrismAccountHelp } from "@prism/ui/account-help";
import { pmcmSupportContactFromEnvironment } from "@/lib/portal-urls";

const render = (props: Parameters<typeof PrismAccountHelp>[0]) => renderToStaticMarkup(createElement(PrismAccountHelp, props));

describe("account help on sign-in and invitation screens", () => {
  it("links a locked-out user straight to the configured PMCM channel with the situation filled in", () => {
    const markup = render({ topic: "an expired invitation link", contact: { email: "help@pmcm.test", phone: "+63 2 8123 4567" } });

    expect(markup).toContain('href="mailto:help@pmcm.test?subject=P.R.I.S.M%20account%20help%3A%20an%20expired%20invitation%20link"');
    expect(markup).toContain('href="tel:+63281234567"');
  });

  it("never invents a contact: without a configured channel it shows the plain instruction, or nothing", () => {
    expect(render({ topic: "client portal access", contact: {} })).toBe("<p>Contact PMCM for account issues or access requests.</p>");
    expect(render({ topic: "an expired invitation link", contact: {}, fallback: null })).toBe("");
  });

  it("reads the deployment's channel from the portal environment and treats blank values as unset", () => {
    vi.stubEnv("NEXT_PUBLIC_PMCM_SUPPORT_EMAIL", " help@pmcm.test ");
    vi.stubEnv("NEXT_PUBLIC_PMCM_SUPPORT_PHONE", "  ");
    expect(pmcmSupportContactFromEnvironment()).toEqual({ email: "help@pmcm.test" });
  });

  afterEach(() => vi.unstubAllEnvs());
});
