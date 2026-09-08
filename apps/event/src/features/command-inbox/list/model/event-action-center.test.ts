import { describe, expect, it } from "vitest";
import { selectEventActionCenter } from "./event-action-center";
import type { PrismDefenseReadinessAction, PrismPmcmCommandInbox } from "@prism/types";

describe("event action center", () => {
  it("orders persisted PMCM actions deterministically across source order", () => {
    const inbox = { items: [
      { id: "b", label: "B", description: "b", severity: "warning", kind: "billing", createdAt: "2026-01-02", href: "/billing" },
      { id: "a", label: "A", description: "a", severity: "warning", kind: "billing", createdAt: "2026-01-01", href: "/billing" },
    ] } as PrismPmcmCommandInbox;
    const readiness: { nextActions: PrismDefenseReadinessAction[] } = { nextActions: [{ key: "blocked", label: "Blocked", detail: "blocked", status: "blocked", targetTab: "closure" }] };
    const first = selectEventActionCenter(inbox, readiness).map((item) => item.id);
    const second = selectEventActionCenter({ ...inbox, items: [...inbox.items].reverse() }, readiness).map((item) => item.id);
    expect(first).toEqual(second);
    expect(first[0]).toBe("readiness:blocked");
  });
});
