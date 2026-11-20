import { describe, expect, it } from "vitest";
import { convertLegacyPlan } from "@prism/floorplan-scene";
import { createTemplateStoreAdapter, type TemplateApiRequest, type TemplateApiRequestInit } from "./api-template-store";

const scene = convertLegacyPlan({ name: "Hall", widthM: 10, heightM: 8, objects: [] }, "1.1.6");

describe("createTemplateStoreAdapter", () => {
  it("saves a template as its scene, with the venue rules trimmed and no guest or supplier lists", async () => {
    const calls: Array<{ path: string; init?: TemplateApiRequestInit }> = [];
    const request: TemplateApiRequest = async <T>(path: string, init?: TemplateApiRequestInit) => {
      calls.push({ path, init });
      return { id: "tpl_1", name: "Hall", width: 10, height: 8, pax: 50, scene, venueRules: "No confetti", createdAt: "2026-09-01T00:00:00.000Z" } as T;
    };

    const saved = await createTemplateStoreAdapter(request).add({ name: "Hall", pax: 50.4, venueRules: "  No confetti  ", scene });

    expect(calls).toEqual([{ path: "/api/templates", init: { method: "POST", body: expect.objectContaining({ name: "Hall", pax: 50, venueRules: "No confetti", scene, sourceType: "custom" }) } }]);
    expect(calls[0].init?.body).not.toHaveProperty("objects");
    expect(calls[0].init?.body).not.toHaveProperty("guests");
    expect(saved).toMatchObject({ id: "tpl_1", widthM: 10, heightM: 8, pax: 50, scene, venueRules: "No confetti" });
  });

  it("maps a stored template's room and scene, so a draft can copy the scene", async () => {
    const request: TemplateApiRequest = async <T>() =>
      [{ id: "tpl_3", name: "Hall", width: 10, height: 8, pax: 50, scene, createdAt: "2026-09-01T00:00:00.000Z" }] as T;

    const [template] = await createTemplateStoreAdapter(request).load();

    expect(template).toMatchObject({ id: "tpl_3", widthM: 10, heightM: 8, scene });
    expect(template.createdAt).toBe(new Date("2026-09-01T00:00:00.000Z").getTime());
  });
});
