/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PmcmProposalIssuerPanel } from "./pmcm-proposal-issuer-panel";

const repo = vi.hoisted(() => ({ latest: vi.fn(), createEstimate: vi.fn(), issue: vi.fn(), draftWording: vi.fn(), selectedQuoteLines: vi.fn(async (): Promise<unknown[]> => []), previousEstimates: vi.fn(async (): Promise<unknown[]> => []) }));
vi.mock("../data/proposal-issuer-repository", () => ({ proposalIssuerRepository: repo }));

afterEach(cleanup);

beforeEach(() => {
  repo.latest.mockResolvedValue({ proposal: null });
  repo.createEstimate.mockResolvedValue({ id: "est_1" });
  repo.issue.mockResolvedValue({ versionNumber: 1 });
});

describe("PmcmProposalIssuerPanel", () => {
  it("consolidates selected supplier quotes and a returning client's previous estimate into the lines", async () => {
    repo.selectedQuoteLines.mockResolvedValue([{ category: "Production", description: "SoundLine quote", quantity: 1, unitAmount: 85000 }]);
    repo.previousEstimates.mockResolvedValue([{ eventId: "evt_0", eventName: "Gala 2025", eventDate: "2025-12-01", totalAmount: 120000, lines: [{ category: "Venue", description: "Ballroom", quantity: 1, unitAmount: 120000 }] }]);
    render(<PmcmProposalIssuerPanel eventId="evt_1" />);
    await screen.findByText("No proposal has been issued for this event yet.");

    fireEvent.click(screen.getByRole("button", { name: "Add selected supplier quotes" }));
    await waitFor(() => expect((screen.getByLabelText("Line 1 description") as HTMLInputElement).value).toBe("SoundLine quote"));
    expect(screen.queryByLabelText("Line 2 description")).toBeNull();

    fireEvent.click(await screen.findByRole("button", { name: "Use these lines" }));
    expect((screen.getByLabelText("Line 2 description") as HTMLInputElement).value).toBe("Ballroom");
  });

  it("does not issue the immutable version until the PMCM user confirms it", async () => {
    render(<PmcmProposalIssuerPanel eventId="evt_1" />);
    await screen.findByText("No proposal has been issued for this event yet.");

    // Nothing is prefilled: the budget and title are blank, and the budget reads back as pesos.
    expect((screen.getByLabelText("Client budget (PHP)") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Proposal title") as HTMLInputElement).value).toBe("");
    fireEvent.change(screen.getByLabelText("Client budget (PHP)"), { target: { value: "500,000" } });
    expect(screen.getByText("Budget ₱500,000")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Line 1 category"), { target: { value: "Venue" } });
    fireEvent.change(screen.getByLabelText("Line 1 description"), { target: { value: "Event delivery" } });
    fireEvent.change(screen.getByLabelText("Line 1 unit amount in PHP"), { target: { value: "500000" } });
    fireEvent.change(screen.getByLabelText("Proposal title"), { target: { value: "Venue package" } });

    fireEvent.click(screen.getByRole("button", { name: "Issue to client" }));
    expect(repo.createEstimate).not.toHaveBeenCalled();

    const confirm = screen.getByRole("region", { name: "Confirm issue" });
    expect(within(confirm).getByText("Issue version 1 to the client?")).toBeTruthy();
    expect(within(confirm).getByText(/₱500,000/)).toBeTruthy();

    fireEvent.click(within(confirm).getByRole("button", { name: "Confirm and issue" }));
    await waitFor(() => expect(repo.issue).toHaveBeenCalledTimes(1));
    expect(repo.createEstimate).toHaveBeenCalledTimes(1);
  });

  it("fills the wording from the estimate for PMCM to edit and issues nothing", async () => {
    repo.draftWording.mockResolvedValue({
      draft: { title: "Garden gala package", summary: "A warm summary.", revisionNote: "", highlights: [], sections: { executiveSummary: "A garden gala.", eventConcept: "An evening outdoors.", servicePackageSummary: "Venue.", investmentSummary: "PHP 300,000.", paymentSchedule: "Downpayment 50%; balance 50%." } },
      requestId: "req_1",
      modelVersion: "claude-sonnet-5-5",
    });
    render(<PmcmProposalIssuerPanel eventId="evt_1" />);
    await screen.findByText("No proposal has been issued for this event yet.");

    fireEvent.change(screen.getByLabelText("Client budget (PHP)"), { target: { value: "500,000" } });
    fireEvent.change(screen.getByLabelText("Line 1 category"), { target: { value: "Venue" } });
    fireEvent.change(screen.getByLabelText("Line 1 description"), { target: { value: "Garden venue" } });
    fireEvent.change(screen.getByLabelText("Line 1 unit amount in PHP"), { target: { value: "300000" } });
    fireEvent.click(screen.getByRole("button", { name: "Draft wording with AI" }));

    await waitFor(() => expect((screen.getByLabelText("Proposal title") as HTMLInputElement).value).toBe("Garden gala package"));
    expect(repo.draftWording).toHaveBeenCalledWith({
      eventId: "evt_1",
      budgetAmount: 500000,
      notes: "",
      lines: [{ category: "Venue", description: "Garden venue", quantity: 1, unitAmount: 300000 }],
      paymentSchedule: [{ label: "Downpayment", percentage: 50 }, { label: "Balance before the event", percentage: 50 }],
    });
    // The summary is filled with the five sections under their catalog headings.
    expect((screen.getByLabelText(/What the client sees/) as HTMLTextAreaElement).value).toMatch(/^Executive Summary\nA garden gala\.\n\nEvent Concept\n/);
    expect(screen.getByText("Draft wording added. Review and edit it before you issue.")).toBeTruthy();
    expect(repo.createEstimate).not.toHaveBeenCalled();
    expect(repo.issue).not.toHaveBeenCalled();
  });

  it("restores the wording PMCM had typed when the AI draft is undone", async () => {
    repo.draftWording.mockResolvedValue({
      draft: { title: "AI title", summary: "AI summary", revisionNote: "", highlights: [], sections: { executiveSummary: "A garden gala.", eventConcept: "An evening outdoors.", servicePackageSummary: "Venue.", investmentSummary: "PHP 300,000.", paymentSchedule: "Downpayment 50%; balance 50%." } },
      requestId: "req_1",
      modelVersion: "claude-sonnet-5-5",
    });
    render(<PmcmProposalIssuerPanel eventId="evt_1" />);
    await screen.findByText("No proposal has been issued for this event yet.");
    fireEvent.change(screen.getByLabelText("Client budget (PHP)"), { target: { value: "500,000" } });
    fireEvent.change(screen.getByLabelText("Line 1 category"), { target: { value: "Venue" } });
    fireEvent.change(screen.getByLabelText("Line 1 description"), { target: { value: "Garden venue" } });
    fireEvent.change(screen.getByLabelText("Line 1 unit amount in PHP"), { target: { value: "300000" } });
    fireEvent.change(screen.getByLabelText("Proposal title"), { target: { value: "My own title" } });

    fireEvent.click(screen.getByRole("button", { name: "Draft wording with AI" }));
    await waitFor(() => expect((screen.getByLabelText("Proposal title") as HTMLInputElement).value).toBe("AI title"));

    fireEvent.click(screen.getByRole("button", { name: "Undo AI draft" }));
    expect((screen.getByLabelText("Proposal title") as HTMLInputElement).value).toBe("My own title");
    expect(screen.queryByRole("button", { name: "Undo AI draft" })).toBeNull();
  });

  it("shows the server's reason when drafting is unavailable and keeps typed text", async () => {
    repo.draftWording.mockRejectedValue(new Error("AI drafting is not available: no AI provider is configured."));
    render(<PmcmProposalIssuerPanel eventId="evt_1" />);
    await screen.findByText("No proposal has been issued for this event yet.");

    fireEvent.change(screen.getByLabelText("Client budget (PHP)"), { target: { value: "500,000" } });
    fireEvent.change(screen.getByLabelText("Line 1 category"), { target: { value: "Venue" } });
    fireEvent.change(screen.getByLabelText("Line 1 description"), { target: { value: "Garden venue" } });
    fireEvent.change(screen.getByLabelText("Line 1 unit amount in PHP"), { target: { value: "300000" } });
    fireEvent.change(screen.getByLabelText("Proposal title"), { target: { value: "My own title" } });
    fireEvent.click(screen.getByRole("button", { name: "Draft wording with AI" }));

    expect((await screen.findByRole("alert")).textContent).toContain("no AI provider is configured");
    expect((screen.getByLabelText("Proposal title") as HTMLInputElement).value).toBe("My own title");
  });
});
