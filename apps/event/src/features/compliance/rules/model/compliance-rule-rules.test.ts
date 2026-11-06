import { describe, expect, it } from "vitest";
import type { PrismComplianceRule } from "@prism/types";
import { activeWorkspaceRules, complianceRuleLayer, toCreateComplianceRuleInput } from "./compliance-rule-rules";

const rule = (overrides: Partial<PrismComplianceRule>): PrismComplianceRule => ({
  id: "r", eventType: "all", phase: "planning", severity: "must_fix", layer: "Must-Fix", conditionKey: "k", title: "T",
  note: "", active: true, createdAt: "", updatedAt: "", ...overrides,
});

describe("compliance rule settings", () => {
  it("stores each severity under its own layer, including advisory", () => {
    expect(["must_fix", "watch_out", "advisory"].map(complianceRuleLayer)).toEqual(["Must-Fix", "Should-Fix", "Advisory"]);
    expect(toCreateComplianceRuleInput({ title: " Power ", conditionKey: " venue_power ", phase: "event_day", severity: "advisory", note: "" }))
      .toEqual({ title: "Power", conditionKey: "venue_power", phase: "event_day", severity: "advisory", layer: "Advisory", note: "" });
  });

  it("lists only active workspace-wide rules, in phase order", () => {
    const rules = [
      rule({ id: "day", phase: "event_day", title: "A" }),
      rule({ id: "plan", phase: "planning", title: "B" }),
      rule({ id: "inactive", active: false }),
      rule({ id: "event-only", eventId: "evt_1" }),
    ];
    expect(activeWorkspaceRules(rules).map((item) => item.id)).toEqual(["plan", "day"]);
  });
});
