import { describe, expect, it, vi } from "vitest";
import { createTemplateStoreAdapter, type TemplateApiRequest, type TemplateApiRequestInit } from "./api-template-store";
import { cloneTemplateObjects, permanentFeatureCount } from "./templates";

describe("createTemplateStoreAdapter", () => {
  it("uses the shared API shape and maps saved templates into the editor model", async () => {
    const templateResponse = {
      id: "tpl_1",
      name: "Reception",
      width: 30,
      height: 18,
      gridSize: 1,
      pax: 120,
      includeGuests: false,
      includeSuppliers: true,
      guests: [],
      suppliers: [{ id: "supplier_1", name: "Supplier", kind: "av" as const, status: "booked" as const }],
      createdAt: "2026-09-01T00:00:00.000Z",
    };
    const calls: Array<{ path: string; init?: { method?: "POST" | "PATCH" | "DELETE"; body?: unknown } }> = [];
    const request: TemplateApiRequest = async <T>(path: string, init?: TemplateApiRequestInit) => {
      calls.push({ path, init });
      return templateResponse as T;
    };
    const store = createTemplateStoreAdapter(request);

    const saved = await store.add({
      name: "Reception",
      widthM: 30.4,
      heightM: 18.2,
      pax: 120.4,
      objects: [],
      includeGuests: false,
      includeSuppliers: true,
      guests: [{ id: "guest_1", name: "Guest", rsvp: "confirmed" }],
      suppliers: [{ id: "supplier_1", name: "Supplier", kind: "av", status: "booked" }],
    });

    expect(calls).toEqual([{ path: "/api/templates", init: {
      method: "POST",
      body: expect.objectContaining({
        width: 30,
        height: 18,
        pax: 120,
        guests: [],
        suppliers: expect.any(Array),
        sourceType: "custom",
      }),
    } }]);
    expect(saved).toMatchObject({
      id: "tpl_1",
      widthM: 30,
      heightM: 18,
      guests: [],
      suppliers: [{ id: "supplier_1" }],
    });
    expect(saved.createdAt).toBe(new Date("2026-09-01T00:00:00.000Z").getTime());
  });

  const fixtureObject = (id: string, category: "furniture" | "architecture" | "safety") => ({
    id,
    name: id,
    kind: "rect" as const,
    category,
    x: 1,
    y: 1,
    w: 2,
    h: 1,
    rotation: 0,
    fill: "#fff",
    stroke: "#000",
    strokeWidth: 1,
    locked: false,
    hidden: false,
  });

  it("saves walls, pillars and exits as permanent features apart from the movable layout, with the venue rules", async () => {
    const calls: Array<{ body?: unknown }> = [];
    const request: TemplateApiRequest = async <T>(_path: string, init?: TemplateApiRequestInit) => {
      calls.push({ body: init?.body });
      return { id: "tpl_2", name: "Hall", width: 10, height: 8, gridSize: 1, pax: 50, includeGuests: false, includeSuppliers: false, createdAt: "2026-09-01T00:00:00.000Z" } as T;
    };

    await createTemplateStoreAdapter(request).add({
      name: "Hall",
      widthM: 10,
      heightM: 8,
      pax: 50,
      venueRules: "  Load-in before 8am only  ",
      objects: [fixtureObject("table", "furniture"), fixtureObject("wall", "architecture"), fixtureObject("exit", "safety")],
      includeGuests: false,
      includeSuppliers: false,
      guests: [],
      suppliers: [],
    });

    const body = calls[0].body as { objects: Array<{ id: string }>; permanentFeatures: Array<{ id: string }>; venueRules: string };
    expect(body.objects.map((object) => object.id)).toEqual(["table"]);
    expect(body.permanentFeatures.map((object) => object.id)).toEqual(["wall", "exit"]);
    expect(body.venueRules).toBe("Load-in before 8am only");
  });

  it("brings stored permanent features back into the layout locked, and clones them locked on reuse", async () => {
    const request: TemplateApiRequest = async <T>() =>
      [{
        id: "tpl_3", name: "Hall", venueRules: "No confetti", width: 10, height: 8, gridSize: 1, pax: 50, includeGuests: false, includeSuppliers: false,
        objects: [fixtureObject("table", "furniture")], permanentFeatures: [fixtureObject("pillar", "architecture")], createdAt: "2026-09-01T00:00:00.000Z",
      }] as T;

    const [template] = await createTemplateStoreAdapter(request).load();

    expect(template.venueRules).toBe("No confetti");
    expect(template.objects.map((object) => [object.id, object.locked])).toEqual([["pillar", true], ["table", false]]);
    expect(permanentFeatureCount(template)).toBe(1);
    const reused = cloneTemplateObjects(template);
    expect(reused.map((object) => object.locked)).toEqual([true, false]);
    expect(new Set(reused.map((object) => object.id)).size).toBe(2);
  });
});
