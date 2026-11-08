import { describe, expect, it } from "vitest";
import type { PrismIssuedProposalSummary } from "@prism/types";
import { proposalDeckSlides } from "./proposal-deck";

const proposal: PrismIssuedProposalSummary = {
  id: "p1", eventId: "e1", versionNumber: 2, title: "Acme Gala proposal", summary: "Evening gala for 200.\n\nStage, AV and styling.",
  totalAmount: 900000, alternativeTotalAmount: 1200000, revisionNote: "", issuedAt: "2026-11-10T00:00:00.000Z", clientStatus: "pending",
};

describe("FR-59 PowerPoint export", () => {
  it("lays the issued proposal out as title, overview, investment with both packages, and next steps", () => {
    const slides = proposalDeckSlides(proposal);
    expect(slides.map((slide) => slide.title)).toEqual(["Acme Gala proposal", "Overview", "Overview (continued)", "Investment", "Next steps"]);
    expect(slides[3]!.body).toEqual(["Option A: PHP 900,000", "Option B: PHP 1,200,000"]);
    expect(proposalDeckSlides({ ...proposal, alternativeTotalAmount: null, summary: "" }).find((slide) => slide.title === "Investment")!.body).toEqual(["Total: PHP 900,000"]);
  });
});
