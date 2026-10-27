import {
  pmcmSupplierDirectoryQuerySchema,
  type PmcmSupplierDirectoryQuery,
  type PrismSupplierCategory,
} from "@prism/types";

/** Pure supplier directory rules. */

const SUPPLIER_VIEW_CATEGORY_SLUGS: Record<string, string> = {
  venues: "venues",
  catering: "food-and-beverages",
  "photography-videography": "documentation",
  "lights-sounds": "technicals",
  decorations: "decorations",
  transportation: "logistics",
};

const KNOWN_SUPPLIER_VIEWS = new Set([
  "all",
  "preferred",
  "venues",
  "catering",
  "photography-videography",
  "lights-sounds",
  "decorations",
  "transportation",
  "contracts",
  "payments",
]);

function parseOrDefault<T>(schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } }, value: unknown, fallback: T): T {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}

export function normalizeSupplierDirectoryRoute(
  view: string,
  search: URLSearchParams,
  categories: PrismSupplierCategory[],
): { view: string; supplierId: string | null; query: PmcmSupplierDirectoryQuery } {
  const normalizedView = KNOWN_SUPPLIER_VIEWS.has(view) ? view : "all";
  const queryFields = ["q", "categoryId", "tier", "rating", "sort", "direction", "page", "pageSize"];
  const input = Object.fromEntries(queryFields.flatMap((field) => {
    const value = search.get(field);
    return value === null ? [] : [[field, value]];
  }));
  const defaults = pmcmSupplierDirectoryQuerySchema.parse({});
  const query = {
    q: parseOrDefault(pmcmSupplierDirectoryQuerySchema.shape.q, input.q, defaults.q),
    categoryId: parseOrDefault(pmcmSupplierDirectoryQuerySchema.shape.categoryId, input.categoryId, undefined),
    tier: parseOrDefault(pmcmSupplierDirectoryQuerySchema.shape.tier, input.tier, undefined),
    rating: parseOrDefault(pmcmSupplierDirectoryQuerySchema.shape.rating, input.rating, defaults.rating),
    sort: parseOrDefault(pmcmSupplierDirectoryQuerySchema.shape.sort, input.sort, defaults.sort),
    direction: parseOrDefault(pmcmSupplierDirectoryQuerySchema.shape.direction, input.direction, defaults.direction),
    page: parseOrDefault(pmcmSupplierDirectoryQuerySchema.shape.page, input.page, defaults.page),
    pageSize: parseOrDefault(pmcmSupplierDirectoryQuerySchema.shape.pageSize, input.pageSize, defaults.pageSize),
  };
  const hasCategoryFilter = search.has("categoryId");
  const hasTierFilter = search.has("tier");

  if (normalizedView === "preferred" && !hasTierFilter) query.tier = "tier_1";
  const categorySlug = SUPPLIER_VIEW_CATEGORY_SLUGS[normalizedView];
  if (categorySlug && !hasCategoryFilter) {
    query.categoryId = categories.find((category) => category.slug === categorySlug)?.id ?? `unmatched-preset:${categorySlug}`;
  }

  return { view: normalizedView, supplierId: search.get("supplierId") || null, query };
}

export function normalizeSupplierName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function isSupplierCreateDraftValid(input: {
  name: string;
  categoryId?: string;
}): boolean {
  return normalizeSupplierName(input.name).length > 0;
}

export function toggleSupplierSelection(
  selected: string[],
  supplierId: string,
): string[] {
  return selected.includes(supplierId)
    ? selected.filter((id) => id !== supplierId)
    : [...selected, supplierId];
}

export function isQuoteRequestReady(input: {
  supplierIds: string[];
  scope?: string;
}): boolean {
  return input.supplierIds.length > 0;
}

export function matchesAllOrValue(selected: string, value?: string | null) {
  return selected === "all" || selected === value;
}

export function supplierMatchesQuery(
  supplier: { name: string; categoryName: string; contactName?: string | null; email?: string | null },
  query: string,
) {
  const haystack = `${supplier.name} ${supplier.categoryName} ${supplier.contactName} ${supplier.email}`.toLowerCase();
  const needle = query.trim().toLowerCase();
  return !needle || haystack.includes(needle);
}

export function supplierMatchesRatingFilter(rating: number | null | undefined, filter: string) {
  if (filter === "all") return true;
  if (filter === "unrated") return rating == null;
  if (filter === "4.5") return (rating ?? 0) >= 4.5;
  if (filter === "4.0") return (rating ?? 0) >= 4;
  return true;
}

export function supplierMatchesDirectoryFilters(
  supplier: {
    name: string;
    categoryName: string;
    contactName?: string | null;
    email?: string | null;
    categoryId: string;
    tier: string;
    aggregateRating: number | null;
  },
  filters: { query: string; categoryId: string; tier: string; rating: string },
) {
  if (!supplierMatchesQuery(supplier, filters.query)) return false;
  if (!matchesAllOrValue(filters.categoryId, supplier.categoryId)) return false;
  if (!matchesAllOrValue(filters.tier, supplier.tier)) return false;
  return supplierMatchesRatingFilter(supplier.aggregateRating, filters.rating);
}

const CLOSED_QUOTE_STATUSES = new Set(["selected", "locked", "not_selected"]);

export function isQuoteClosed(status: string) {
  return CLOSED_QUOTE_STATUSES.has(status);
}

export function quoteCardAccentClass(quote: { status: string; outsideAcceptableRange?: boolean }) {
  if (quote.status === "selected" || quote.status === "locked") return "border-success/25 bg-success-soft/70";
  if (quote.outsideAcceptableRange) return "border-danger/25 bg-danger-soft/70";
  return "border-border";
}

export function quoteSelectButtonClass(status: string) {
  if (status === "selected" || status === "locked") return "bg-success-soft text-success";
  return "bg-ink text-sidebar-foreground";
}

export function quoteSelectLabel(status: string) {
  if (status === "selected" || status === "locked") return "Selected";
  if (status === "not_selected") return "Closed";
  return "Select supplier";
}

export function quoteAcceptableRangeCopy(
  category: { acceptableMin?: number; acceptableMax?: number } | undefined,
  format: (amount: number) => string,
) {
  if (category?.acceptableMin && category?.acceptableMax) {
    return {
      summary: `Acceptable range: ${format(category.acceptableMin)} to ${format(category.acceptableMax)}`,
      badge: `${format(category.acceptableMin)} - ${format(category.acceptableMax)}`,
    };
  }
  return { summary: "Acceptable range not set", badge: "No budget band" };
}

export function submittedBidCopy(count: number) {
  if (!count) return "Submitted supplier bids will appear here for side-by-side review.";
  return `${count} submitted bid${count === 1 ? "" : "s"} ready for PMCM review.`;
}

export function inclusionCountLabel(count: number) {
  return `${count} item${count === 1 ? "" : "s"}`;
}

export function supplierContactFallback(supplier: { email?: string | null; phone?: string | null }) {
  return supplier.email || supplier.phone || "No contact on file";
}
