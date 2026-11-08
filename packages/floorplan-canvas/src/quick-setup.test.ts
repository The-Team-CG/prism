import { describe, expect, it } from "vitest";
import { arrangeQuickSetup, QUICK_SETUP_PRESETS } from "./quick-setup";

describe("FR-82 quick setup presets", () => {
  it("offers eighteen presets, three per event-type group, and lays each out inside the room", () => {
    expect(QUICK_SETUP_PRESETS).toHaveLength(18);
    const groups = new Map<string, number>();
    for (const preset of QUICK_SETUP_PRESETS) groups.set(preset.group, (groups.get(preset.group) ?? 0) + 1);
    expect([...groups.values()]).toEqual([3, 3, 3, 3, 3, 3]);
    for (const preset of QUICK_SETUP_PRESETS) {
      const { objects } = arrangeQuickSetup(preset, { widthM: 30, heightM: 25, pax: 150 });
      expect(objects.length).toBeGreaterThan(0);
      for (const object of objects) {
        expect(object.x).toBeGreaterThanOrEqual(0);
        expect(object.y).toBeGreaterThanOrEqual(0);
        expect(object.x + Math.max(object.w, object.h)).toBeLessThanOrEqual(30.01);
      }
    }
  });

  it("seats the confirmed guest count when the room allows, and reports the shortfall when it does not", () => {
    const banquet = QUICK_SETUP_PRESETS.find((preset) => preset.name === "Reception banquet")!;
    const roomy = arrangeQuickSetup(banquet, { widthM: 40, heightM: 30, pax: 200 });
    expect(roomy.objects.filter((object) => object.name.startsWith("Round Banquet"))).toHaveLength(20);
    expect(roomy.shortfall).toBe(0);
    const cramped = arrangeQuickSetup(banquet, { widthM: 12, heightM: 12, pax: 200 });
    expect(cramped.shortfall).toBeGreaterThan(0);
  });
});
