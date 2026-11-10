import { describe, expect, it } from "vitest";
import type { PrismNotificationPreferences } from "@prism/types";
import { notificationChannelSummary } from "./notification-channel-summary";

const prefs = (overrides: Partial<PrismNotificationPreferences> = {}): PrismNotificationPreferences => ({
  email: "ana@pmcm.test", viberConfigured: true, viberLinked: true, viberEnabled: true, viberLinkedAt: "2026-11-01T00:00:00.000Z", ...overrides,
});

describe("notificationChannelSummary", () => {
  it("claims Viber only when the deployment has it, the account linked it and it is on", () => {
    expect(notificationChannelSummary(prefs(), "fallback@pmcm.test")).toEqual({ value: "Email + Viber", detail: "Updates go to ana@pmcm.test and your linked Viber." });
    expect(notificationChannelSummary(prefs({ viberEnabled: false }), "x")).toEqual({ value: "Email", detail: "Updates go to ana@pmcm.test. Viber is linked but turned off." });
    expect(notificationChannelSummary(prefs({ viberLinked: false, viberEnabled: false, viberLinkedAt: null }), "x")).toEqual({ value: "Email", detail: "Updates go to ana@pmcm.test. Link Viber below to get them there too." });
    expect(notificationChannelSummary(prefs({ viberConfigured: false, viberLinked: false, viberEnabled: false }), "x")).toEqual({ value: "Email", detail: "Updates go to ana@pmcm.test. Viber isn't set up for this deployment." });
  });

  it("makes only the email claim before the preferences load or when they cannot be read", () => {
    expect(notificationChannelSummary(null, "maxine@pmcm.test")).toEqual({ value: "Email", detail: "Updates go to maxine@pmcm.test." });
  });
});
