/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismEvent } from "@prism/types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/events",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { EventRegister } from "./event-register";

const events = [
  { id: "evt_a", eventName: "Ayala Summit", clientName: "Ayala", eventDate: "2026-11-20", status: "confirmed" },
  { id: "evt_b", eventName: "Bonifacio Gala", clientName: "BGC", eventDate: "2026-11-25", status: "confirmed" },
] as PrismEvent[];

afterEach(() => cleanup());

function rowFor(name: string) {
  return screen.getByRole("link", { name }).closest("tr") as HTMLElement;
}

describe("EventRegister attention column", () => {
  it("opens an event through its named row link while leaving attention labels distinct", () => {
    const onOpenEvent = vi.fn();
    render(<EventRegister events={events} onOpenEvent={onOpenEvent} />);
    const link = screen.getByRole("link", { name: "Ayala Summit" });
    expect(link.getAttribute("href")).toBe("/dashboard/events/evt_a/overview");
    fireEvent.click(link);
    expect(onOpenEvent).toHaveBeenCalledWith("evt_a");
    expect(screen.queryByRole("link", { name: /Open event/ })).toBeNull();
  });

  it("shows what is overdue on the event that has it, says nothing is overdue on a clear one, and stays blank until the data loads", () => {
    const attention = new Map([["evt_a", ["2 payments overdue", "1 unread message"]], ["evt_b", []]]);
    const { rerender } = render(<EventRegister events={events} attention={attention} onOpenEvent={() => undefined} />);

    // The same labels appear for narrow screens under the name; the column cell is the desktop one.
    expect(within(rowFor("Ayala Summit")).getAllByText("2 payments overdue").length).toBeGreaterThan(0);
    expect(within(rowFor("Ayala Summit")).queryByText("Nothing overdue")).toBeNull();
    expect(within(rowFor("Bonifacio Gala")).getByText("Nothing overdue")).toBeTruthy();

    rerender(<EventRegister events={events} onOpenEvent={() => undefined} />);
    expect(screen.queryByText("Nothing overdue")).toBeNull();
    expect(screen.queryByText("2 payments overdue")).toBeNull();
  });
});
