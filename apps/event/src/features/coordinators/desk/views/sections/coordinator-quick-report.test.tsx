/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CoordinatorQuickReport } from "./coordinator-quick-report";
import type { CoordinatorIssueFormModel } from "./coordinator-role-sections";

afterEach(cleanup);

function issueForm(overrides: Partial<CoordinatorIssueFormModel> = {}): CoordinatorIssueFormModel {
  return {
    title: "", setTitle: vi.fn(), severity: "high", setSeverity: vi.fn(), affectedArea: "", setAffectedArea: vi.fn(), description: "", setDescription: vi.fn(),
    slaDueAt: "", setSlaDueAt: vi.fn(), assignToMe: false, setAssignToMe: vi.fn(), busy: false, error: null, submit: vi.fn(async () => true), ...overrides,
  };
}

describe("quick issue report", () => {
  it("sends a kind, a place and a note in a few taps, titled by its kind", async () => {
    const form = issueForm();
    const onDone = vi.fn();
    render(<CoordinatorQuickReport issueForm={form} areas={["Main Hall", "Kitchen"]} onDone={onDone} />);

    expect(screen.getByRole("button", { name: "Pick what kind first" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Supplier" }));
    fireEvent.click(screen.getByRole("button", { name: "Kitchen" }));
    fireEvent.change(screen.getByPlaceholderText(/Caterer 30 minutes late/), { target: { value: "Caterer late" } });
    fireEvent.click(screen.getByRole("button", { name: "Send to PMCM" }));

    expect(form.submit).toHaveBeenCalledWith({ title: "Supplier: Caterer late", severity: "high", affectedArea: "Kitchen", description: "Caterer late" });
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  });

  it("stays open with what was chosen when sending fails", async () => {
    const form = issueForm({ submit: vi.fn(async () => false), error: "No signal. Your report was not sent." });
    const onDone = vi.fn();
    render(<CoordinatorQuickReport issueForm={form} areas={[]} onDone={onDone} />);

    fireEvent.click(screen.getByRole("button", { name: "Equipment" }));
    fireEvent.click(screen.getByRole("button", { name: "Send to PMCM" }));

    await waitFor(() => expect(form.submit).toHaveBeenCalled());
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("No signal. Your report was not sent.");
    expect(screen.getByRole("button", { name: "Equipment" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("carries what was picked into the full form behind More details", () => {
    const form = issueForm();
    render(<CoordinatorQuickReport issueForm={form} areas={["Stage"]} onDone={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Guest" }));
    fireEvent.click(screen.getByRole("button", { name: "Stage" }));
    fireEvent.click(screen.getByRole("button", { name: /More details/ }));

    expect(form.setTitle).toHaveBeenCalledWith("Guest issue · Stage");
    expect(form.setAffectedArea).toHaveBeenCalledWith("Stage");
    expect(screen.getByText("Issue title (required)")).toBeTruthy();
  });
});
