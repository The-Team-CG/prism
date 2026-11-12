import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GuestPassView } from "./guest-pass-view";

const VALID_TOKEN = "abcdefghijklmnopqrstuvwxyz012345";

describe("GuestPassView", () => {
  it("offers a way back to the guest portal instead of a bare error when the pass link is broken", () => {
    const markup = renderToStaticMarkup(createElement(GuestPassView, { token: "undefined" }));

    expect(markup).toContain("This pass link is not valid");
    expect(markup).toContain("P.R.I.S.M.");
    expect(markup).toContain("Guest pass");
    expect(markup).toContain("Ask the event organizer for a new one.");
    expect(markup).toContain("Back to guest portal");
    expect(markup).not.toContain("Copy code");
  });

  it("shows the fallback code in groups of four with a copy action so staff can read it back", () => {
    const markup = renderToStaticMarkup(createElement(GuestPassView, { token: VALID_TOKEN }));

    expect(markup).toContain("abcd efgh ijkl mnop qrst uvwx yz01 2345");
    expect(markup).toContain("Copy code");
    expect(markup).not.toContain("Back to guest portal");
  });
});
