/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismInquiry } from "@prism/types";
import { InquiryIntakeLog } from "./inquiry-intake-log";

afterEach(cleanup);

const inquiry = {
  id: "inq_1",
  eventName: "Ayala Summit",
  clientName: "Ana Cruz",
  companyName: "",
  email: "ana@acme.test",
  clientType: "Corporate",
  eventType: "Conference",
  eventDate: "2026-06-18",
  source: "P.R.I.S.M Website",
  status: "new",
  createdAt: "2026-10-01T02:00:00.000Z",
  message: "We need a venue for 200 guests.",
  parallelInquiryIds: [],
  mergeHistory: [],
  duplicate: false,
  previouslyDeclined: false,
} as unknown as PrismInquiry;

function renderLog(onDecline = vi.fn(async () => {})) {
  render(
    <InquiryIntakeLog
      inquiries={[inquiry]}
      onAccept={vi.fn(async () => {})}
      onPend={vi.fn(async () => {})}
      onDecline={onDecline}
      onMerge={vi.fn(async () => {})}
      onLogOnBehalf={vi.fn(async () => {})}
      busy={false}
    />,
  );
  return onDecline;
}

describe("InquiryIntakeLog decisions", () => {
  it("confirms a decline only after a reason is chosen, and then sends it", async () => {
    const onDecline = renderLog();
    fireEvent.click(screen.getByRole("button", { name: /Ayala Summit/ }));
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));

    const dialog = screen.getByRole("dialog", { name: "Decline inquiry from Ana Cruz?" });
    const confirm = within(dialog).getByRole("button", { name: "Decline inquiry" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(within(dialog).getByLabelText(/^Decline reason/), { target: { value: "Budget Too Low" } });
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(confirm);

    await waitFor(() => expect(onDecline).toHaveBeenCalledWith(expect.objectContaining({ id: "inq_1" }), "Budget Too Low"));
  });

  it("names the event date as a calendar date and shows a status update only when one exists", () => {
    renderLog();
    fireEvent.click(screen.getByRole("button", { name: /Ayala Summit/ }));

    expect(screen.getAllByText("Jun 18, 2026").length).toBeGreaterThan(0);
    expect(screen.queryByText("2026-06-18")).toBeNull();
    expect(screen.queryByText("Status updated")).toBeNull();
    expect(screen.getByRole("button", { name: "Put on hold" })).toBeTruthy();
  });
});

describe("InquiryIntakeLog log-on-behalf form", () => {
  it("starts with channel and referral source unset and says what Save still needs", () => {
    renderLog();
    fireEvent.click(screen.getByRole("button", { name: "Log inquiry" }));

    const dialog = screen.getByRole("dialog", { name: "Log inquiry on behalf of a client" });
    expect((within(dialog).getByLabelText(/^Channel/) as HTMLSelectElement).value).toBe("");
    expect((within(dialog).getByLabelText(/^Referral source/) as HTMLSelectElement).value).toBe("");
    expect((within(dialog).getByRole("button", { name: "Save inquiry" }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(dialog).getByText(/Fill in Client name, Email, Event name/)).toBeTruthy();
  });
});
