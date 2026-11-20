import type { PrismSupplierCategory, PrismSupplierQuoteRequest } from "@prism/types";
import type { SupplierQuoteRow } from "@/features/pmcm-kit";

export type ServiceStage = "not_requested" | "waiting" | "compare" | "booked";

export type EventService = {
  categoryId: string;
  name: string;
  stage: ServiceStage;
  /** One line under the name: who is booked and for how much, how many quotes are in, or who was asked. */
  detail: string;
  /** The client asked for this service in the briefing. */
  fromBriefing: boolean;
};

const peso = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);
const normalise = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** A briefing service ("Photo and Video") matched to its supplier category by name or slug. */
function categoryFor(service: string, categories: PrismSupplierCategory[]) {
  const key = normalise(service);
  return categories.find((category) => normalise(category.name) === key || normalise(category.slug ?? "") === key);
}

const STAGE_ORDER: Record<ServiceStage, number> = { compare: 0, not_requested: 1, waiting: 2, booked: 3 };

/**
 * The services this event needs, one row each, in the order PMCM acts on them: quotes in to compare, services not
 * requested yet, those waiting on suppliers, then what is booked. A service comes from the client's briefing, or from
 * a category PMCM already asked suppliers about.
 */
export function eventServices({ services, categories, requests, quotes }: {
  services: string[];
  categories: PrismSupplierCategory[];
  requests: Array<Pick<PrismSupplierQuoteRequest, "categoryId" | "category" | "status">>;
  quotes: Array<Pick<SupplierQuoteRow, "categoryId" | "category" | "status" | "supplierName" | "amount">>;
}): EventService[] {
  const rows = new Map<string, { category: PrismSupplierCategory; fromBriefing: boolean }>();
  for (const service of services) {
    const category = categoryFor(service, categories);
    if (category) rows.set(category.id, { category, fromBriefing: true });
  }
  for (const request of requests) {
    const category = categories.find((item) => item.id === request.categoryId || item.name === request.category);
    if (category && !rows.has(category.id)) rows.set(category.id, { category, fromBriefing: false });
  }
  return [...rows.values()].map(({ category, fromBriefing }) => {
    const inCategory = <T extends { categoryId?: string; category: string }>(item: T) => item.categoryId === category.id || item.category === category.name;
    const asked = requests.filter(inCategory);
    const received = quotes.filter(inCategory);
    const booked = received.find((quote) => quote.status === "selected");
    let stage: ServiceStage = "not_requested";
    let detail = fromBriefing ? "In the client's briefing, not requested yet" : "Not requested yet";
    if (booked) {
      stage = "booked";
      detail = `${booked.supplierName} · ${peso(booked.amount)}`;
    } else if (received.length) {
      stage = "compare";
      detail = `${received.length} ${received.length === 1 ? "quote" : "quotes"} in of ${asked.length} asked`;
    } else if (asked.length) {
      stage = "waiting";
      detail = `Waiting on ${asked.length} ${asked.length === 1 ? "supplier" : "suppliers"}`;
    }
    return { categoryId: category.id, name: category.name, stage, detail, fromBriefing };
  }).sort((a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] || a.name.localeCompare(b.name));
}
