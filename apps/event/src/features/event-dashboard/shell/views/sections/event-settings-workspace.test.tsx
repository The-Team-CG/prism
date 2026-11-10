/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PrismEvent } from "@prism/types";
import type { EventSession } from "@/app/lib/session";
import { EventSettingsWorkspace } from "./event-settings-workspace";

const mine = vi.hoisted(() => vi.fn());
vi.mock("@/features/account-notifications/data/notification-preferences-repository", () => ({ notificationPreferencesRepository: { mine } }));

beforeEach(() => {
  mine.mockReset();
  mine.mockRejectedValue(new Error("offline"));
});
afterEach(cleanup);

const session: EventSession = {
  id: "user_pmcm",
  name: "Ms. Mys",
  role: "pmcm-admin",
  email: "pmcm@example.test",
  organization: "PMCM",
  approvalStatus: "approved",
  accessToken: "test-token",
  expiresAt: "2026-10-01T00:00:00.000Z",
  signedInAt: "2026-09-30T00:00:00.000Z",
};

const event: PrismEvent = {
  id: "evt_1",
  inquiryId: "inq_1",
  clientName: "Ana Reyes",
  eventName: "Summit",
  eventDate: "2026-10-01",
  status: "planning",
  clientPortalStatus: "unlocked",
  readiness: "open",
  archived: false,
  floorPlanStatus: "draft",
};

type SettingsProps = {
  session: EventSession;
  selectedEvent?: PrismEvent;
  onToggleClientEventDayView: (enabled: boolean) => Promise<boolean>;
  onSetEventPrivacy: (privacy: "private" | "public") => Promise<boolean>;
};

function renderSettings(overrides: Partial<SettingsProps> = {}) {
  const props: SettingsProps = {
    session,
    selectedEvent: event,
    onToggleClientEventDayView: vi.fn(async () => true),
    onSetEventPrivacy: vi.fn(async () => true),
    ...overrides,
  };

  render(<EventSettingsWorkspace {...props} />);
  return props;
}

describe("EventSettingsWorkspace event privacy", () => {
  it("defaults to private and saves PMCM's choice of public", async () => {
    const onSetEventPrivacy = vi.fn(async () => true);
    renderSettings({ onSetEventPrivacy });
    const privateOption = screen.getByRole("radio", { name: "Private" }) as HTMLInputElement;
    const publicOption = screen.getByRole("radio", { name: "Public" }) as HTMLInputElement;
    expect(privateOption.checked).toBe(true);
    fireEvent.click(publicOption);
    await waitFor(() => expect(publicOption.checked).toBe(true));
    expect(onSetEventPrivacy).toHaveBeenCalledWith("public");
  });
});

describe("EventSettingsWorkspace client event-day view", () => {
  it("starts off when the event flag is missing or false", () => {
    const { rerender } = render(
      <EventSettingsWorkspace
        session={session}
        selectedEvent={event}
        onToggleClientEventDayView={vi.fn(async () => true)}
        onSetEventPrivacy={vi.fn(async () => true)}
      />,
    );
    const toggle = screen.getByRole("switch", { name: "Client event-day view" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");

    rerender(
      <EventSettingsWorkspace
        session={session}
        selectedEvent={{ ...event, clientEventDayViewEnabled: false }}
        onToggleClientEventDayView={vi.fn(async () => true)}
        onSetEventPrivacy={vi.fn(async () => true)}
      />,
    );
    expect(toggle.getAttribute("aria-checked")).toBe("false");
  });

  it("persists both enable and disable changes", async () => {
    const onToggleClientEventDayView = vi.fn(async () => true);
    renderSettings({ onToggleClientEventDayView });
    const toggle = screen.getByRole("switch", { name: "Client event-day view" });

    fireEvent.click(toggle);
    await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("true"));
    expect(onToggleClientEventDayView).toHaveBeenNthCalledWith(1, true);

    fireEvent.click(toggle);
    await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("false"));
    expect(onToggleClientEventDayView).toHaveBeenNthCalledWith(2, false);
  });

  it("disables the switch while the save is pending", async () => {
    let resolveSave: (saved: boolean) => void = () => undefined;
    const onToggleClientEventDayView = vi.fn(
      () => new Promise<boolean>((resolve) => { resolveSave = resolve; }),
    );
    renderSettings({ onToggleClientEventDayView });
    const toggle = screen.getByRole("switch", { name: "Client event-day view" });

    fireEvent.click(toggle);
    expect((toggle as HTMLButtonElement).disabled).toBe(true);
    resolveSave(true);

    await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("true"));
    expect((toggle as HTMLButtonElement).disabled).toBe(false);
  });

  it("keeps the persisted value and reports a failed save", async () => {
    const onToggleClientEventDayView = vi.fn(async () => false);
    renderSettings({ onToggleClientEventDayView });
    const toggle = screen.getByRole("switch", { name: "Client event-day view" });

    fireEvent.click(toggle);

    expect((await screen.findByRole("alert")).textContent).toMatch(/could not save/i);
    expect(toggle.getAttribute("aria-checked")).toBe("false");
  });

  it("does not show the setting to non-admin portal staff", () => {
    const coordinatorSession: EventSession = { ...session, role: "coordinator" };

    render(
      <EventSettingsWorkspace
        session={coordinatorSession}
        selectedEvent={event}
        onToggleClientEventDayView={vi.fn(async () => true)}
        onSetEventPrivacy={vi.fn(async () => true)}
      />,
    );

    expect(screen.queryByRole("switch", { name: "Client event-day view" })).toBeNull();
  });
});

describe("EventSettingsWorkspace notifications summary", () => {
  const prefs = { email: "ana@pmcm.test", viberConfigured: true, viberLinked: true, viberEnabled: true, viberLinkedAt: "2026-11-01T00:00:00.000Z" };

  it("says only what the account's own settings support, and never claims delivery is unavailable", async () => {
    mine.mockResolvedValue({ ...prefs, viberConfigured: false, viberLinked: false, viberEnabled: false, viberLinkedAt: null });
    renderSettings();
    expect(await screen.findByText("Updates go to ana@pmcm.test. Viber isn't set up for this deployment.")).toBeTruthy();
    expect(screen.queryByText(/Live sending isn't connected yet/)).toBeNull();
  });

  it("adds Viber once it is set up, linked and on", async () => {
    mine.mockResolvedValue(prefs);
    renderSettings();
    expect(await screen.findByText("Email + Viber")).toBeTruthy();
  });

  it("keeps to the email claim when the settings cannot be read", async () => {
    renderSettings();
    await waitFor(() => expect(mine).toHaveBeenCalled());
    expect(screen.getByText(`Updates go to ${session.email}.`)).toBeTruthy();
  });
});
