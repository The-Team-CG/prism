import { describe, expect, it } from "vitest";
import type { PrismEvent } from "@prism/types";
import type { ClientDashboardAction } from "../../workspace/model/client-dashboard-view-rules";
import { clientHomeFigures } from "./client-home-summary";

function action(id: string, patch: Partial<ClientDashboardAction> = {}): ClientDashboardAction {
  return {
    id, title: id, description: "", detail: "", ctaLabel: "Open", icon: () => null, targetTab: "overview", status: "open", tone: "primary", nextActor: "you", ...patch,
  } as ClientDashboardAction;
}

function figures(actions: ClientDashboardAction[]) {
  return clientHomeFigures({
    actions,
    events: [] as PrismEvent[],
    payments: [],
    todayKey: "2026-11-09",
    hrefFor: () => "/dashboard",
    formatMoney: String,
    formatDate: String,
  });
}

describe("client home attention summary", () => {
  it("describes the items that need the client without contradicting their count", () => {
    expect(figures([action("sign")])[0]).toMatchObject({ label: "Needs you", value: 1, detail: "1 item, none blocking" });
    expect(figures([action("a"), action("b")])[0]).toMatchObject({ value: 2, detail: "2 items, none blocking" });
    expect(figures([action("a", { blocking: true }), action("b")])[0]).toMatchObject({ value: 2, detail: "1 blocking now" });
    expect(figures([])[0]).toMatchObject({ value: 0, detail: "All caught up" });
  });
});
