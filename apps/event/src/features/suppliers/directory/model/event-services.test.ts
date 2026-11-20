import { describe, expect, it } from "vitest";
import type { PrismSupplierCategory } from "@prism/types";
import { eventServices } from "./event-services";

const categories = [
  { id: "cat_food", name: "Catering", slug: "catering" },
  { id: "cat_photo", name: "Photo and Video", slug: "photo-and-video" },
  { id: "cat_reg", name: "Digital Registration", slug: "digital-registration" },
  { id: "cat_lights", name: "Lights and Sound", slug: "lights-and-sound" },
] as PrismSupplierCategory[];

describe("eventServices", () => {
  it("lists the briefing's services and any category already asked about, in the order PMCM acts", () => {
    const services = eventServices({
      services: ["Catering", "Photo and Video", "lights and sound"],
      categories,
      requests: [
        { categoryId: "cat_food", category: "Catering", status: "closed" },
        { categoryId: "cat_photo", category: "Photo and Video", status: "open" },
        { categoryId: "cat_photo", category: "Photo and Video", status: "open" },
        { categoryId: "cat_reg", category: "Digital Registration", status: "open" },
      ],
      quotes: [
        { categoryId: "cat_food", category: "Catering", status: "selected", supplierName: "Feast Catering", amount: 640_000 },
        { categoryId: "cat_photo", category: "Photo and Video", status: "submitted", supplierName: "Frame and Co.", amount: 180_000 },
      ],
    });
    expect(services.map((service) => [service.name, service.stage])).toEqual([
      ["Photo and Video", "compare"],
      ["Lights and Sound", "not_requested"],
      ["Digital Registration", "waiting"],
      ["Catering", "booked"],
    ]);
    expect(services[0].detail).toBe("1 quote in of 2 asked");
    expect(services[1]).toMatchObject({ fromBriefing: true, detail: "In the client's briefing, not requested yet" });
    expect(services[2]).toMatchObject({ fromBriefing: false, detail: "Waiting on 1 supplier" });
    expect(services[3].detail).toBe("Feast Catering · ₱640,000");
  });

  it("is empty when the briefing names nothing and nothing was asked", () => {
    expect(eventServices({ services: ["Fireworks"], categories, requests: [], quotes: [] })).toEqual([]);
  });
});
