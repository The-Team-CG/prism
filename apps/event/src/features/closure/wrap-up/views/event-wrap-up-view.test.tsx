/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismEventWrapUp } from "@prism/types";
import { wrapUpRepository } from "../data/wrap-up-repository";
import { EventWrapUpView } from "./event-wrap-up-view";

vi.mock("../data/wrap-up-repository", () => ({
  wrapUpRepository: { get: vi.fn(), start: vi.fn(), update: vi.fn() },
}));

const repository = vi.mocked(wrapUpRepository);

function wrapUpRecord(logisticsRecorded: boolean): PrismEventWrapUp {
  const pending = { status: "pending" as const, evidence: "", completedAt: null };
  return {
    id: "wrap_1",
    eventId: "event_1",
    mode: "full",
    status: "pending",
    activatedAt: "2026-10-17T18:00:00.000Z",
    deadlineAt: "2026-10-18T18:00:00.000Z",
    twelveHourReminderAt: null,
    twentyFourHourReminderAt: null,
    requiredItems: { post_event_documents: false, billing: false, logistics: logisticsRecorded, issues: false, feedback: false },
    sections: {
      logistics: logisticsRecorded
        ? { status: "complete" as const, evidence: "Recorded in the PMCM logistics completion panel", completedAt: "2026-10-18T09:00:00.000Z" }
        : pending,
      issues: pending,
      feedback: pending,
      supplierEgress: pending,
      billingDraft: { ...pending, items: [] },
    },
    supplierEgressSummary: { confirmedSuppliers: 3, leftSite: 2, outstanding: ["Florals"] },
    clientAcknowledgedAt: null,
    acknowledgementRecordedBy: null,
    acknowledgementSource: "pmcm_recorded",
    clientAcknowledgementNote: "",
    completedAt: null,
    completedBy: null,
  } as PrismEventWrapUp;
}

describe("EventWrapUpView supplier egress and billing draft", () => {
  beforeEach(() => {
    repository.get.mockReset();
    repository.update.mockReset();
  });
  afterEach(cleanup);

  it("shows who has not reported leaving next to the supplier egress section", async () => {
    repository.get.mockResolvedValueOnce(wrapUpRecord(false));
    render(<EventWrapUpView eventId="event_1" />);

    const summary = await screen.findByTestId("supplier-egress-summary");
    expect(summary.textContent).toContain("2 of 3 confirmed suppliers reported done and leaving.");
    expect(summary.textContent).toContain("Not reported leaving: Florals");
  });

  it("saves drafted billing items with the sections and lets a draft item be removed first", async () => {
    repository.get.mockResolvedValueOnce(wrapUpRecord(false));
    repository.update.mockResolvedValueOnce(wrapUpRecord(false));
    render(<EventWrapUpView eventId="event_1" />);
    await screen.findByTestId("supplier-egress-summary");

    fireEvent.change(screen.getByLabelText("Billing item"), { target: { value: "Overtime hours" } });
    fireEvent.change(screen.getByLabelText("Billing amount"), { target: { value: "4500" } });
    fireEvent.click(screen.getByRole("button", { name: "Add item" }));
    fireEvent.change(screen.getByLabelText("Billing item"), { target: { value: "Extra tables" } });
    fireEvent.change(screen.getByLabelText("Billing amount"), { target: { value: "1200" } });
    fireEvent.click(screen.getByRole("button", { name: "Add item" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Extra tables" }));
    expect(screen.queryByText(/Extra tables/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Save wrap-up evidence" }));
    await waitFor(() => expect(repository.update).toHaveBeenCalledTimes(1));
    expect(repository.update.mock.calls[0][1].sections?.billingDraft?.items).toEqual([{ label: "Overtime hours", amount: 4500, note: "" }]);
    expect(repository.update.mock.calls[0][1].sections).toHaveProperty("supplierEgress");
  });

  it("does not add an item without a label or with a non-whole amount", async () => {
    repository.get.mockResolvedValueOnce(wrapUpRecord(false));
    render(<EventWrapUpView eventId="event_1" />);
    await screen.findByTestId("supplier-egress-summary");
    const add = screen.getByRole("button", { name: "Add item" });

    expect((add as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Billing item"), { target: { value: "Overtime hours" } });
    fireEvent.change(screen.getByLabelText("Billing amount"), { target: { value: "12.5" } });
    expect((add as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Billing amount"), { target: { value: "12" } });
    expect((add as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("EventWrapUpView logistics mirror", () => {
  beforeEach(() => {
    repository.get.mockReset();
    repository.update.mockReset();
  });
  afterEach(cleanup);

  it("shows logistics as not recorded until the PMCM record exists, then reflects it", async () => {
    repository.get.mockResolvedValueOnce(wrapUpRecord(false));
    const before = render(<EventWrapUpView eventId="event_1" />);
    expect(await screen.findByText(/Not recorded\. Record logistics completion in the panel above/)).toBeTruthy();
    before.unmount();

    repository.get.mockResolvedValueOnce(wrapUpRecord(true));
    render(<EventWrapUpView eventId="event_1" />);
    expect(await screen.findByText(/Recorded in the logistics completion panel above/)).toBeTruthy();
  });

  it("does not offer a logistics control and never sends logistics in the save payload", async () => {
    repository.get.mockResolvedValueOnce(wrapUpRecord(false));
    repository.update.mockResolvedValueOnce(wrapUpRecord(false));
    render(<EventWrapUpView eventId="event_1" />);
    await screen.findByTestId("wrap-up-logistics-mirror");

    expect(screen.queryByRole("checkbox", { name: /logistics/i })).toBeNull();
    expect(screen.queryByRole("combobox", { name: /logistics/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Save wrap-up evidence" }));
    await waitFor(() => expect(repository.update).toHaveBeenCalledTimes(1));
    const payload = repository.update.mock.calls[0][1];
    expect(payload.requiredItems).not.toHaveProperty("logistics");
    expect(payload.sections).not.toHaveProperty("logistics");
  });
});
