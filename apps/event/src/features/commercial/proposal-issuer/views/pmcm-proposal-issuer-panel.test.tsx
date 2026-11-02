/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PmcmProposalIssuerPanel } from "./pmcm-proposal-issuer-panel";

const repo = vi.hoisted(() => ({ latest: vi.fn(), createEstimate: vi.fn(), issue: vi.fn() }));
vi.mock("../data/proposal-issuer-repository", () => ({ proposalIssuerRepository: repo }));

afterEach(cleanup);

beforeEach(() => {
  repo.latest.mockResolvedValue({ proposal: null });
  repo.createEstimate.mockResolvedValue({ id: "est_1" });
  repo.issue.mockResolvedValue({ versionNumber: 1 });
});

describe("PmcmProposalIssuerPanel", () => {
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
});
