import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ClientOcularVisitPanel } from "./client-ocular-visit-panel";

describe("ClientOcularVisitPanel", () => {
  it("offers the venue visit request with an optional note, in plain words", () => {
    const markup = renderToStaticMarkup(createElement(ClientOcularVisitPanel, { busy: false, onSubmit: vi.fn(async () => undefined) }));
    expect(markup).toContain("Note for PMCM (optional)");
    expect(markup).toContain("Ask for a venue visit");
    expect(markup).not.toContain("Ocular");
  });
});
