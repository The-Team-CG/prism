/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PrismCoordinatorSuggestion } from "@prism/types";
import { useCoordinatorRowViewModel } from "./use-coordinator-row-view-model";

const assignment = {
  id: "assignment_1",
  eventId: "evt_1",
  coordinatorId: "coord_1",
  coordinatorName: "Jordan Lee",
  role: "Usher",
  status: "acknowledged",
  doubleBookingWarning: false,
};

const candidate = {
  id: "coord_2",
  name: "Ana Reyes",
  role: "Usher",
  matchedSkills: ["registration"],
  missingSkills: ["first aid"],
  matchedSkillCount: 1,
  requiredSkillCount: 2,
} satisfies PrismCoordinatorSuggestion;

describe("useCoordinatorRowViewModel replacement suggestions", () => {
  it("loads the event-role skill ranking and preserves the selected candidate for replacement", async () => {
    const onLoadSuggestions = vi.fn(async () => [candidate]);
    const onReplace = vi.fn(async () => {});
    const { result } = renderHook(() => useCoordinatorRowViewModel({
      assignment,
      coordinators: [
        { id: "coord_1", name: "Jordan Lee", email: "jordan@example.test", active: true, roleTags: ["Usher"], skillsTags: [], createdAt: "" },
        { id: "coord_2", name: "Ana Reyes", email: "ana@example.test", active: true, roleTags: ["Usher"], skillsTags: ["registration"], createdAt: "" },
      ],
      busy: false,
      onReplace,
      onLoadSuggestions,
    }));

    await act(async () => {
      await result.current.findReplacementSuggestions();
    });

    expect(onLoadSuggestions).toHaveBeenCalledWith("Usher", []);
    expect(result.current.replacementSuggestions).toEqual([candidate]);
    expect(result.current.suggestionStatus).toBe("loaded");

    act(() => {
      result.current.selectReplacementCoordinator(candidate.id);
      result.current.setReplacementReason("Jordan is unavailable");
    });
    await act(async () => {
      await result.current.replace();
    });

    expect(onReplace).toHaveBeenCalledWith({
      replacementCoordinatorId: candidate.id,
      role: "Usher",
      reason: "Jordan is unavailable",
    });
  });

  it("reports when the event has no available skill matches", async () => {
    const { result } = renderHook(() => useCoordinatorRowViewModel({
      assignment,
      coordinators: [],
      busy: false,
      onReplace: vi.fn(async () => {}),
      onLoadSuggestions: vi.fn(async () => []),
    }));

    await act(async () => {
      await result.current.findReplacementSuggestions();
    });

    expect(result.current.suggestionStatus).toBe("empty");
  });
});
