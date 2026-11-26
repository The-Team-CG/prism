/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  list: vi.fn(),
  propose: vi.fn(async () => ({})),
  outcome: vi.fn(),
}));
vi.mock("../data/presentation-meetings-repository", () => ({ presentationMeetingsRepository: repository }));

import { PresentationMeetingsPanel } from "./presentation-meetings-panel";

async function offerTwoTimes() {
  const times = screen.getAllByLabelText(/Time option/);
  fireEvent.change(times[0]!, { target: { value: "2027-01-10T10:00" } });
  fireEvent.change(times[1]!, { target: { value: "2027-01-11T14:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Send times to the client" }));
  await waitFor(() => expect(repository.propose).toHaveBeenCalled());
  return (repository.propose.mock.calls.at(-1) as unknown as [string, Record<string, unknown>])[1];
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PresentationMeetingsPanel (UAT 7.6)", () => {
  it("has P.R.I.S.M create the Zoom meeting by default once Zoom is connected", async () => {
    repository.list.mockResolvedValue({ meetings: [], atRisk: false, zoomAvailable: true });
    render(<PresentationMeetingsPanel eventId="evt_1" />);

    const create = await screen.findByRole("checkbox", { name: /Create the Zoom meeting/ });
    expect((create as HTMLInputElement).checked).toBe(true);
    expect(await offerTwoTimes()).toMatchObject({ platform: "zoom", createZoomMeeting: true });
  });

  it("asks for a pasted link while Zoom is not connected, and for Meet or Teams", async () => {
    repository.list.mockResolvedValue({ meetings: [], atRisk: false, zoomAvailable: false });
    render(<PresentationMeetingsPanel eventId="evt_1" />);

    expect(await screen.findByText(/Zoom is not connected yet/)).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: /Create the Zoom meeting/ })).toBeNull();

    fireEvent.change(screen.getByLabelText("Platform"), { target: { value: "google_meet" } });
    fireEvent.change(screen.getByLabelText("Google Meet meeting link"), { target: { value: "https://meet.google.com/abc-defg-hij" } });
    const sent = await offerTwoTimes();
    expect(sent).toMatchObject({ platform: "google_meet", meetingLink: "https://meet.google.com/abc-defg-hij" });
    expect(sent).not.toHaveProperty("createZoomMeeting");
  });
});
