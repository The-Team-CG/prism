/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismFloorPlanDraft } from "@prism/types";
import { EventFloorplansTab } from "./event-floorplans-tab";

vi.mock("../view-models/use-floorplan-snapshot-history-view-model", () => ({
  useFloorplanSnapshotHistoryViewModel: () => ({ history: [], loading: false, error: null, load: vi.fn() }),
}));

afterEach(cleanup);

function draft(partial: Partial<PrismFloorPlanDraft> & Pick<PrismFloorPlanDraft, "id" | "name" | "status" | "sourceType">): PrismFloorPlanDraft {
  return { eventId: "evt_1", floorPlanId: "fp_1", isActive: false, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", ...partial } as PrismFloorPlanDraft;
}

describe("EventFloorplansTab", () => {
  it("leads with the approved official plan, separates client preferences, and keeps older versions in history", () => {
    const onOpenDraft = vi.fn();
    const v2 = draft({ id: "v2", name: "Official layout v2", status: "approved", sourceType: "template", isActive: true, createdByRole: "pmcm-admin", approvedSnapshotAt: "2026-05-02T02:00:00.000Z" });
    render(
      <EventFloorplansTab
        event={{ id: "evt_1", floorPlanStatus: "approved" } as never}
        drafts={[
          draft({ id: "v1", name: "Official layout v1", status: "approved", sourceType: "template", createdByRole: "pmcm-admin", approvedSnapshotAt: "2026-04-01T00:00:00.000Z" }),
          v2,
          draft({ id: "pref", name: "Client preference v2", status: "client_submitted", sourceType: "client_preference", createdByRole: "client", clientPreference: { seatingStyle: "Cabaret", stagePreference: "East" } as never }),
        ]}
        floorPlanTemplates={[]}
        onCreateTemplateDraft={vi.fn()}
        onOpenDraft={onOpenDraft}
        onSubmitDraft={vi.fn()}
        onApproveDraft={vi.fn()}
      />,
    );

    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings[0]).toBe("Official floorplan");
    expect(headings.indexOf("Client preferences1")).toBeGreaterThan(0);
    expect(headings.indexOf("Start a PMCM draft")).toBe(headings.length - 1);

    const official = screen.getByRole("region", { name: "Official floorplan" });
    expect(official.textContent).toContain("Official layout v2");
    expect(official.textContent).toContain("PMCM administrator");
    expect(official.textContent).not.toContain("pmcm-admin");

    const preferences = screen.getByRole("region", { name: /Client preferences/ });
    expect(preferences.textContent).toContain("Cabaret");
    expect(preferences.textContent).not.toContain("Open / Edit");

    const history = screen.getByText("Official layout v1").closest("details");
    expect(history?.open).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Open official plan" }));
    expect(onOpenDraft).toHaveBeenCalledWith(expect.objectContaining({ id: "evt_1" }), v2);
  });

  it("says plainly when no official plan is approved yet", () => {
    render(
      <EventFloorplansTab
        event={{ id: "evt_1" } as never}
        drafts={[draft({ id: "d1", name: "Draft", status: "pmcm_draft", sourceType: "template" })]}
        floorPlanTemplates={[]}
        onCreateTemplateDraft={vi.fn()}
        onOpenDraft={vi.fn()}
        onSubmitDraft={vi.fn()}
        onApproveDraft={vi.fn()}
      />,
    );
    expect(screen.getByRole("region", { name: "Official floorplan" }).textContent).toContain("No official floorplan has been approved yet. 1 PMCM draft is in progress below.");
    expect(screen.getByRole("button", { name: "Submit" })).toBeTruthy();
  });
});
