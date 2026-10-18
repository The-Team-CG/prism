import { describe, expect, it } from "vitest";
import { parsePrivacyCorrectionDraft } from "./privacy-correction";

describe("parsePrivacyCorrectionDraft", () => {
  it("sends only the fields the operator filled in, trimmed", () => {
    expect(parsePrivacyCorrectionDraft({ name: "  Ana R. Reyes ", email: "" })).toEqual({
      ok: true,
      patch: { name: "Ana R. Reyes" },
    });
    expect(parsePrivacyCorrectionDraft({ name: "", email: " ana@ayala.test " })).toEqual({
      ok: true,
      patch: { email: "ana@ayala.test" },
    });
  });

  it("refuses an empty correction and a malformed email before any request is sent", () => {
    expect(parsePrivacyCorrectionDraft({ name: "  ", email: "" })).toMatchObject({ ok: false });
    expect(parsePrivacyCorrectionDraft({ name: "", email: "not-an-email" })).toMatchObject({ ok: false });
  });
});
