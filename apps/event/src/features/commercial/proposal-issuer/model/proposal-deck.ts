import type { PrismIssuedProposalSummary } from "@prism/types";

const peso = (amount: number) => `PHP ${Math.round(amount).toLocaleString("en-PH")}`;

/** FR-59: the slides of an issued proposal, as plain data so the layout can be tested without a PowerPoint library. */
export function proposalDeckSlides(proposal: PrismIssuedProposalSummary): Array<{ title: string; body: string[] }> {
  const summary = proposal.summary.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const investment = proposal.alternativeTotalAmount
    ? [`Option A: ${peso(proposal.totalAmount)}`, `Option B: ${peso(proposal.alternativeTotalAmount)}`]
    : [`Total: ${peso(proposal.totalAmount)}`];
  return [
    { title: proposal.title, body: [`Proposal version ${proposal.versionNumber}`, `Issued ${proposal.issuedAt.slice(0, 10)}`] },
    ...(summary.length ? summary.slice(0, 6).map((part, index) => ({ title: index === 0 ? "Overview" : "Overview (continued)", body: part.split("\n").slice(0, 12) })) : []),
    { title: "Investment", body: investment },
    { title: "Next steps", body: ["Review the proposal in your P.R.I.S.M client portal.", "Approve it, or request a revision with your comments."] },
  ];
}

/** Builds the .pptx in the browser; the library loads only when PMCM asks for the file. */
export async function downloadProposalDeck(proposal: PrismIssuedProposalSummary) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const deck = new PptxGenJS();
  deck.layout = "LAYOUT_WIDE";
  for (const slide of proposalDeckSlides(proposal)) {
    const page = deck.addSlide();
    page.addText(slide.title, { x: 0.6, y: 0.4, w: 12, h: 0.9, fontSize: 30, bold: true, color: "1B1B1F" });
    page.addText(slide.body.map((line) => ({ text: line, options: { bullet: slide.body.length > 1 } })), { x: 0.6, y: 1.5, w: 12, h: 5.4, fontSize: 18, color: "333333", valign: "top" });
  }
  await deck.writeFile({ fileName: `${proposal.title.replace(/[^\w -]+/g, "").slice(0, 60) || "proposal"} v${proposal.versionNumber}.pptx` });
}
