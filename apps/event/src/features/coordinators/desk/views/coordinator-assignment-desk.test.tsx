/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CoordinatorAssignmentDesk } from "./coordinator-assignment-desk";

afterEach(cleanup);

const coordinators = [
  { id: "coord_1", name: "Jordan Lee", email: "jordan@example.test", active: true, roleTags: ["Floor Director"], skillsTags: [] },
  { id: "coord_2", name: "Sam Cruz", email: "sam@example.test", active: true, roleTags: ["Stage Director"], skillsTags: [] },
  { id: "coord_3", name: "Ana Reyes", email: "ana@example.test", active: true, roleTags: ["Usher"], skillsTags: [] },
  { id: "coord_4", name: "Riley Tan", email: "riley@example.test", active: true, roleTags: ["Usher"], skillsTags: [] },
];

const assignments = [
  { id: "assignment_1", eventId: "evt_1", coordinatorId: "coord_1", coordinatorName: "Jordan Lee", role: "Floor Director", status: "acknowledged", eventDate: "2026-10-01" },
  { id: "assignment_2", eventId: "evt_1", coordinatorId: "coord_2", coordinatorName: "Sam Cruz", role: "Stage Director", status: "pending_acknowledgement", eventDate: "2026-10-01" },
  { id: "assignment_other", eventId: "evt_2", coordinatorId: "coord_3", coordinatorName: "Ana Reyes", role: "Usher", status: "pending_acknowledgement", eventDate: "2026-10-05" },
  { id: "assignment_released", eventId: "evt_1", coordinatorId: "coord_4", coordinatorName: "Riley Tan", role: "Usher", status: "cancelled", eventDate: "2026-10-01" },
];

function renderDesk(overrides: Record<string, unknown> = {}) {
  const props = {
    event: { id: "evt_1", eventDate: "2026-10-01" },
    coordinators,
    assignments,
    roleRequirements: [],
    busy: false,
    onAssign: vi.fn(async () => {}),
    onLoadSuggestions: vi.fn(async () => []),
    onSaveCoverage: vi.fn(async () => true),
    onSendReminders: vi.fn(async () => ({ leadTimeDays: 7, reminders: [{ assignmentId: "assignment_2", status: "queued", reason: null }] })),
    onDesignateOperator: vi.fn(async () => true),
    onLoadOperator: vi.fn(async () => null),
    onLoadAvailability: vi.fn(async () => []),
    onLoadReliabilityHistory: vi.fn(async () => []),
    onCreateAvailability: vi.fn(async () => true),
    onDeleteAvailability: vi.fn(async () => true),
    ...overrides,
  };
  render(<CoordinatorAssignmentDesk {...(props as unknown as ComponentProps<typeof CoordinatorAssignmentDesk>)} />);
  return props as typeof props & Record<string, ReturnType<typeof vi.fn>>;
}

describe("CoordinatorAssignmentDesk skill suggestions", () => {
  it("loads all selected skills for the chosen role and shows the server match explanation", async () => {
    const suggestion = {
      id: "coord_3",
      name: "Ana Reyes",
      role: "Usher",
      matchedSkills: ["registration"],
      missingSkills: ["first aid"],
      matchedSkillCount: 1,
      requiredSkillCount: 2,
    };
    const onLoadSuggestions = vi.fn(async () => [suggestion]);
    const skillfulCoordinators = coordinators.map((coordinator) =>
      coordinator.id === "coord_3" || coordinator.id === "coord_4"
        ? { ...coordinator, skillsTags: ["registration", "first aid"] }
        : coordinator,
    );
    const props = renderDesk({ coordinators: skillfulCoordinators, onLoadSuggestions });

    fireEvent.change(screen.getByRole("combobox", { name: "Coordinator role filter" }), { target: { value: "Usher" } });
    fireEvent.click(screen.getByLabelText("registration"));
    fireEvent.click(screen.getByLabelText("first aid"));
    fireEvent.click(screen.getByRole("button", { name: "Find skill matches" }));

    expect(await screen.findByText("Matched: registration")).toBeTruthy();
    expect(screen.getByText("Missing: first aid")).toBeTruthy();
    expect(onLoadSuggestions).toHaveBeenCalledWith("Usher", ["registration", "first aid"]);

    fireEvent.click(screen.getByRole("button", { name: "Assign Ana Reyes" }));
    expect(props.onAssign).toHaveBeenCalledWith(expect.objectContaining({ id: "coord_3" }), "Usher");
  });

  it("shows an empty state when no server candidates match the selected role", async () => {
    renderDesk();

    fireEvent.change(screen.getByRole("combobox", { name: "Coordinator role filter" }), { target: { value: "Usher" } });
    fireEvent.click(screen.getByRole("button", { name: "Find skill matches" }));

    expect(await screen.findByText("No coordinators match this role and skill selection.")).toBeTruthy();
  });

  it("keeps the desk usable and reports a failed suggestions request", async () => {
    renderDesk({ onLoadSuggestions: vi.fn(async () => { throw new Error("Offline"); }) });

    fireEvent.change(screen.getByRole("combobox", { name: "Coordinator role filter" }), { target: { value: "Usher" } });
    fireEvent.click(screen.getByRole("button", { name: "Find skill matches" }));

    expect(await screen.findByText("Could not load skill matches. Try again.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Find skill matches" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("loads conflict alternatives from the API and assigns the returned candidate", async () => {
    const suggestion = {
      id: "coord_4",
      name: "Riley Tan",
      role: "Usher",
      matchedSkills: ["guest flow"],
      missingSkills: [],
      matchedSkillCount: 1,
      requiredSkillCount: 1,
    };
    const onLoadSuggestions = vi.fn(async () => [suggestion]);
    const props = renderDesk({
      event: { id: "evt_1", eventDate: "2026-10-05" },
      onLoadSuggestions,
    });

    await waitFor(() => expect(props.onLoadOperator).toHaveBeenCalled());
    fireEvent.change(screen.getByRole("combobox", { name: "Coordinator role filter" }), { target: { value: "Usher" } });
    fireEvent.click(screen.getByLabelText("Available only"));
    fireEvent.click(screen.getByRole("button", { name: "Review conflict" }));

    expect(await screen.findByText("1 of 1 required skills matched")).toBeTruthy();
    expect(screen.getByText("Matched: guest flow")).toBeTruthy();
    expect(screen.getByText("Missing: None")).toBeTruthy();
    expect(onLoadSuggestions).toHaveBeenCalledWith("Usher", []);
    fireEvent.click(screen.getByRole("button", { name: "Assign Riley Tan" }));
    expect(props.onAssign).toHaveBeenCalledWith({ id: "coord_4", name: "Riley Tan" }, "Usher");
  });
});

const availabilityEntry = {
  id: "availability_1",
  coordinatorId: "coord_1",
  startsAt: "2026-10-01T13:00:00.000Z",
  endsAt: "2026-10-01T17:00:00.000Z",
  kind: "unavailable",
  note: "Personal leave",
  declaredBy: "PMCM Admin",
  createdAt: "2026-09-01T00:00:00.000Z",
};

describe("CoordinatorAssignmentDesk availability", () => {
  it("warns PMCM when an assigned coordinator is unavailable on the event date", async () => {
    renderDesk({ onLoadAvailability: vi.fn(async () => [availabilityEntry]) });

    fireEvent.change(screen.getByLabelText("Coordinator availability"), { target: { value: "coord_1" } });

    expect(await screen.findByText(/unavailable date overlaps this event assignment/i)).toBeTruthy();
  });

  it("records unavailable dates as whole days and refreshes the list", async () => {
    const props = renderDesk();
    fireEvent.change(screen.getByLabelText("Coordinator availability"), { target: { value: "coord_1" } });
    await waitFor(() => expect(props.onLoadAvailability).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText("First unavailable day"), { target: { value: "2026-12-10" } });
    fireEvent.change(screen.getByLabelText("Last unavailable day"), { target: { value: "2026-12-11" } });
    fireEvent.click(screen.getByRole("button", { name: "Add unavailable dates" }));

    await waitFor(() => expect(props.onCreateAvailability).toHaveBeenCalledWith("coord_1", expect.objectContaining({
      startsAt: "2026-12-10T00:00:00.000Z",
      endsAt: "2026-12-12T00:00:00.000Z",
      kind: "unavailable",
    })));
    await waitFor(() => expect(props.onLoadAvailability).toHaveBeenCalledTimes(2));
  });

  it("keeps what PMCM typed when the API refuses the dates", async () => {
    const props = renderDesk({ onCreateAvailability: vi.fn(async () => false) });
    fireEvent.change(screen.getByLabelText("Coordinator availability"), { target: { value: "coord_1" } });
    await waitFor(() => expect(props.onLoadAvailability).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText("First unavailable day"), { target: { value: "2026-12-10" } });
    fireEvent.change(screen.getByLabelText("Last unavailable day"), { target: { value: "2026-12-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Add unavailable dates" }));

    await waitFor(() => expect(props.onCreateAvailability).toHaveBeenCalledTimes(1));
    expect((screen.getByLabelText("First unavailable day") as HTMLInputElement).value).toBe("2026-12-10");
    expect(props.onLoadAvailability).toHaveBeenCalledTimes(1);
  });

  it("shows entries as day ranges and removes one", async () => {
    const props = renderDesk({ onLoadAvailability: vi.fn(async () => [availabilityEntry]) });
    fireEvent.change(screen.getByLabelText("Coordinator availability"), { target: { value: "coord_1" } });

    expect(await screen.findByText(/2026-10-01 · Personal leave/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(props.onDeleteAvailability).toHaveBeenCalledWith("coord_1", "availability_1"));
  });
});

describe("CoordinatorAssignmentDesk acknowledgment reminders", () => {
  it("lists only this event's pending coordinators and reports who was reminded", async () => {
    const props = renderDesk();
    const panel = screen.getByRole("button", { name: "Collapse pending acknowledgments" }).closest("div.rounded-2xl") as HTMLElement;

    expect(within(panel).getByText("Sam Cruz")).toBeTruthy();
    expect(within(panel).queryByText("Ana Reyes")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Send reminders" }));

    expect(await screen.findByText("1 pending coordinator reminded.")).toBeTruthy();
    expect(props.onSendReminders).toHaveBeenCalledTimes(1);
  });

  it("says so when the reminder request fails", async () => {
    renderDesk({ onSendReminders: vi.fn(async () => null) });

    fireEvent.click(screen.getByRole("button", { name: "Send reminders" }));

    expect(await screen.findByText(/reminders were not sent/i)).toBeTruthy();
  });
});

describe("CoordinatorAssignmentDesk Event Day System Operator", () => {
  const operator = (name: string, coordinatorId: string) => ({ coordinatorId, coordinatorName: name, designatedAt: "2026-09-29T00:00:00.000Z" });

  it("offers only coordinators still working this event and designates the chosen one", async () => {
    const onLoadOperator = vi.fn()
      .mockResolvedValueOnce(operator("Jordan Lee", "coord_1"))
      .mockResolvedValueOnce(operator("Sam Cruz", "coord_2"));
    const props = renderDesk({ onLoadOperator });
    expect(await screen.findByText("Current operator: Jordan Lee.")).toBeTruthy();

    const select = screen.getByLabelText("Event Day System Operator");
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Select a coordinator",
      "Jordan Lee · Floor Director",
      "Sam Cruz · Stage Director",
    ]);

    fireEvent.change(select, { target: { value: "coord_2" } });
    fireEvent.click(screen.getByRole("button", { name: "Designate operator" }));

    await waitFor(() => expect(props.onDesignateOperator).toHaveBeenCalledWith("coord_2"));
    expect(await screen.findByText("Current operator: Sam Cruz.")).toBeTruthy();
  });

  it("does not claim a change when the designation is refused", async () => {
    const props = renderDesk({ onDesignateOperator: vi.fn(async () => false) });
    await screen.findByText("No operator designated yet.");

    fireEvent.change(screen.getByLabelText("Event Day System Operator"), { target: { value: "coord_2" } });
    fireEvent.click(screen.getByRole("button", { name: "Designate operator" }));

    expect(await screen.findByText(/operator was not changed/i)).toBeTruthy();
    expect(props.onLoadOperator).toHaveBeenCalledTimes(1);
  });

  it("keeps designation unavailable when the current operator cannot be loaded", async () => {
    const props = renderDesk({ onLoadOperator: vi.fn(async () => { throw new Error("Network unavailable"); }) });

    expect(await screen.findByText(/could not load the current operator/i)).toBeTruthy();
    expect(screen.queryByText("No operator designated yet.")).toBeNull();
    fireEvent.change(screen.getByLabelText("Event Day System Operator"), { target: { value: "coord_2" } });
    expect((screen.getByRole("button", { name: "Designate operator" }) as HTMLButtonElement).disabled).toBe(true);
    expect(props.onDesignateOperator).not.toHaveBeenCalled();
  });

  it("flags a designated operator who has since left the event", async () => {
    renderDesk({ onLoadOperator: vi.fn(async () => operator("Riley Tan", "coord_4")) });

    expect(await screen.findByText(/Riley Tan is no longer assigned to this event/i)).toBeTruthy();
  });
});

describe("CoordinatorAssignmentDesk coverage targets", () => {
  const usherTarget = { role: "Usher", required: 3, assigned: 1, acknowledged: 0, requiredSkills: ["registration"], assignedSkills: [], satisfied: false };

  it("saves a new target with its skills", async () => {
    const props = renderDesk();

    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "Floor Director" } });
    fireEvent.change(screen.getByLabelText("Required coordinators"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Required skills, comma separated"), { target: { value: "first aid, registration" } });
    fireEvent.click(screen.getByRole("button", { name: "Save target" }));

    await waitFor(() => expect(props.onSaveCoverage).toHaveBeenCalledWith({ role: "Floor Director", required: 2, requiredSkills: ["first aid", "registration"] }));
    expect(await screen.findByText("Coverage target saved for Floor Director.")).toBeTruthy();
  });

  it("loads an existing target into the form so it can be changed", async () => {
    const props = renderDesk({ roleRequirements: [usherTarget] });

    fireEvent.click(screen.getByRole("button", { name: "Edit target" }));

    expect((screen.getByLabelText("Role") as HTMLSelectElement).value).toBe("Usher");
    expect((screen.getByLabelText("Required coordinators") as HTMLInputElement).value).toBe("3");
    fireEvent.change(screen.getByLabelText("Required coordinators"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Save target" }));

    await waitFor(() => expect(props.onSaveCoverage).toHaveBeenCalledWith({ role: "Usher", required: 4, requiredSkills: ["registration"] }));
  });

  it("requires mapping an unknown historical role to the catalog before saving", async () => {
    const historicalTarget = { ...usherTarget, role: "Legacy Floor Lead" };
    const props = renderDesk({ roleRequirements: [historicalTarget] });

    await waitFor(() => expect(props.onLoadOperator).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Edit target" }));

    expect(screen.getByText(/Legacy Floor Lead.*historical role/).textContent).toContain("Legacy Floor Lead");
    expect((screen.getByLabelText("Role") as HTMLSelectElement).value).toBe("");
    expect((screen.getByRole("button", { name: "Save target" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "Floor Director" } });
    fireEvent.click(screen.getByRole("button", { name: "Save target" }));
    await waitFor(() => expect(props.onSaveCoverage).toHaveBeenCalledWith({ role: "Floor Director", mapFromRole: "Legacy Floor Lead", required: 3, requiredSkills: ["registration"] }));
    expect(await screen.findByText("Coverage target mapped from Legacy Floor Lead to Floor Director.")).toBeTruthy();
  });

  it("explains a rejected target instead of sending it", async () => {
    const props = renderDesk();

    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "Floor Director" } });
    fireEvent.change(screen.getByLabelText("Required coordinators"), { target: { value: "1.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save target" }));

    expect(await screen.findByRole("status")).toBeTruthy();
    expect(props.onSaveCoverage).not.toHaveBeenCalled();
  });
});
