import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PrismClientOcularVisit } from "@prism/types";
import { ClientOcularVisitPanel } from "./client-ocular-visit-panel";

function renderPanel(visit: PrismClientOcularVisit | null) {
  return renderToStaticMarkup(createElement(ClientOcularVisitPanel, {
    visit,
    busy: false,
    onSubmit: vi.fn(async () => undefined),
  }));
}

describe("ClientOcularVisitPanel", () => {
  it("renders the optional-note request form before a request exists", () => {
    const markup = renderPanel(null);

    expect(markup).toContain("Optional note for PMCM");
    expect(markup).toContain("Request ocular visit");
  });

  it("shows a scheduled client confirmation", () => {
    const markup = renderPanel({
      eventId: "evt_1",
      status: "scheduled",
      clientNote: null,
      requestedAt: "2026-10-01T00:00:00.000Z",
      scheduledAt: "2026-10-17T10:00:00+08:00",
    });

    expect(markup).toMatch(/scheduled/i);
    expect(markup).toContain("Oct 17");
    expect(markup).not.toContain("Waiver reason");
  });

  it("does not render a PMCM waiver reason", () => {
    const visit = {
      eventId: "evt_1",
      status: "waived",
      clientNote: null,
      requestedAt: null,
      scheduledAt: null,
      waiverReason: "Internal PMCM reason",
    } as PrismClientOcularVisit;

    const markup = renderPanel(visit);

    expect(markup).toContain("Ocular visit waived");
    expect(markup).not.toContain("Internal PMCM reason");
  });
});
