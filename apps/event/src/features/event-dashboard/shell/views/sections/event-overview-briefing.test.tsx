/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismDefenseReadiness, PrismEvent } from "@prism/types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/events/evt_1",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { EventWorkspaceOverview } from "./event-overview";

const event = { id: "evt_1", eventName: "Ayala Summit", clientName: "Ayala", eventDate: "2099-06-18", status: "briefing", clientPortalStatus: "unlocked" } as PrismEvent;
const readiness = {
  overallStatus: "blocked",
  lifecycleStage: "briefing_proposal",
  score: 29,
  nextActions: [],
  summary: { briefingSubmitted: false },
} as unknown as PrismDefenseReadiness;

afterEach(() => cleanup());

describe("EventWorkspaceOverview briefing", () => {
  it("never offers PMCM a way to submit the briefing, even while the client has not", () => {
    render(
      <EventWorkspaceOverview
        event={event}
        readiness={readiness}
        drafts={[]}
        quoteRequestCount={0}
        quoteCount={0}
        openCheckCount={0}
        canStartEventDay={false}
        busy={false}
        onStartEventDay={() => undefined}
        onRunCompliance={() => undefined}
        onOpenTab={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: "Run compliance check" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /submit briefing|resubmit briefing/i })).toBeNull();
  });
});
