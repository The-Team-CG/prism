import { describe, expect, it, vi } from "vitest";
import { createTemplateStoreAdapter, type TemplateApiRequest, type TemplateApiRequestInit } from "./api-template-store";

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

    expect(calls).toEqual([{ path: "/templates", init: {
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
});
