/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import type { PrismClientCloseoutWorkspace } from "@prism/types";
import { ClientCloseoutView } from "./client-closeout-view";

const mocks = vi.hoisted(() => ({ useClientCloseout: vi.fn() }));

vi.mock("../view-models/use-client-closeout", () => ({
  useClientCloseout: mocks.useClientCloseout,
}));

function makeWorkspace(eventId: string, response: PrismClientCloseoutWorkspace["response"] = null): PrismClientCloseoutWorkspace {
  return {
    eventId,
    actualEndedAt: "2026-10-16T00:00:00.000Z",
    wrapUp: { status: "complete", clientAcknowledgedAt: null, acknowledgementNote: "" },
    deliverables: [{ id: "doc-1", title: "Final report", status: "submitted", required: true, acknowledgedAt: null, acknowledgementNote: "" }],
    response,
  };
}

function makeViewModel(workspace: PrismClientCloseoutWorkspace | null) {
  return {
    workspace,
    busy: false,
    error: null,
    notice: null,
    acknowledgeWrapUp: vi.fn(),
    acknowledgeDeliverable: vi.fn(),
    submitResponse: vi.fn(),
    revokeConsent: vi.fn(),
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ClientCloseoutView", () => {
  it("keeps archived acknowledgements and feedback read-only while allowing consent withdrawal", () => {
    const response = {
      eventId: "evt-archived",
      rating: 5,
      feedback: "Recorded feedback",
      testimonial: "Recorded testimonial",
      testimonialConsent: true,
      moderationStatus: "approved" as const,
      submittedAt: "2026-10-16T00:00:00.000Z",
    };
    mocks.useClientCloseout.mockReturnValue(makeViewModel(makeWorkspace("evt-archived", response)));

    render(createElement(ClientCloseoutView, { eventId: "evt-archived", archived: true }));

    expect((screen.getByRole("button", { name: "Acknowledge wrap-up" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Acknowledge receipt" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Update feedback" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText("Feedback") as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByLabelText("Optional testimonial") as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Withdraw testimonial consent" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("clears the previous event's feedback, testimonial, consent, and note when the event changes", async () => {
    const priorResponse = {
      eventId: "evt-first",
      rating: 2,
      feedback: "Private feedback from the first event",
      testimonial: "First event testimonial",
      testimonialConsent: true,
      moderationStatus: "pending" as const,
      submittedAt: "2026-10-16T00:00:00.000Z",
    };
    mocks.useClientCloseout.mockImplementation((eventId: string) =>
      makeViewModel(eventId === "evt-first" ? makeWorkspace(eventId, priorResponse) : makeWorkspace(eventId)),
    );
    const view = render(createElement(ClientCloseoutView, { eventId: "evt-first", archived: false }));
    expect((screen.getByLabelText("Feedback") as HTMLTextAreaElement).value).toBe("Private feedback from the first event");
    expect((screen.getByLabelText("Optional testimonial") as HTMLTextAreaElement).value).toBe("First event testimonial");
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);

    view.rerender(createElement(ClientCloseoutView, { eventId: "evt-second", archived: false }));

    await waitFor(() => {
      expect((screen.getByLabelText("Feedback") as HTMLTextAreaElement).value).toBe("");
      expect((screen.getByLabelText("Optional testimonial") as HTMLTextAreaElement).value).toBe("");
      expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
      expect((screen.getByLabelText("Acknowledgement note (optional)") as HTMLInputElement).value).toBe("");
    });
  });
});
