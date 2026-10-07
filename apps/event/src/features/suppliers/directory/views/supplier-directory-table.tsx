import { ArrowDown, ArrowUp, RefreshCw, Search } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import type { PmcmSupplierDirectoryQuery, PrismPmcmSupplierDirectoryPage, PrismSupplierCategory } from "@prism/types";

function dateLabel(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

function ratingLabel(rating: { average: number | null; count: number }) {
  return rating.average === null ? "Not reviewed" : `${rating.average.toFixed(1)} / 5 (${rating.count})`;
}

function certificationLabel(attention: string, counts: { rejected: number; expired: number; submitted: number; verified: number; unknown: number }) {
  if (attention === "none") return "No records";
  const total = counts.rejected + counts.expired + counts.submitted + counts.verified + counts.unknown;
  return `${attention[0]?.toUpperCase()}${attention.slice(1)} · ${total}`;
}

export function SupplierDirectoryTable({
  directory,
  categories,
  query,
  searchDraft,
  loading,
  error,
  view,
  onSearch,
  onQueryChange,
  onSelectSupplier,
  onRefresh,
  onRetry,
}: {
  directory: PrismPmcmSupplierDirectoryPage | null;
  categories: PrismSupplierCategory[];
  query: PmcmSupplierDirectoryQuery;
  searchDraft: string;
  loading: boolean;
  error: string | null;
  view: string;
  onSearch: (value: string) => void;
  onQueryChange: (patch: Partial<PmcmSupplierDirectoryQuery>) => void;
  onSelectSupplier: (supplierId: string, trigger: HTMLButtonElement) => void;
  onRefresh: () => void;
  onRetry: () => void;
}) {
  const canGoPrevious = query.page > 0;
  const canGoNext = Boolean(directory?.hasNextPage);
  const sortOptions: Array<[PmcmSupplierDirectoryQuery["sort"], string]> = [
    ["name", "Name"],
    ["rating", "Rating"],
    ["last_review", "Last review"],
    ["certifications", "Certifications"],
  ];

  return (
    <section aria-label="Supplier directory" className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <label className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <span className="sr-only">Search suppliers</span>
          <input
            value={searchDraft}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search suppliers"
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
          />
        </label>
        <label className="sr-only" htmlFor="supplier-category-filter">Category</label>
        <select id="supplier-category-filter" value={query.categoryId ?? ""} onChange={(event) => onQueryChange({ categoryId: event.target.value || undefined, page: 0 })} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">All categories</option>
          {query.categoryId && !categories.some((category) => category.id === query.categoryId) ? <option value={query.categoryId}>No matching category for this view</option> : null}
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <label className="sr-only" htmlFor="supplier-tier-filter">Tier</label>
        <select id="supplier-tier-filter" value={query.tier ?? ""} onChange={(event) => onQueryChange({ tier: (event.target.value || undefined) as PmcmSupplierDirectoryQuery["tier"], page: 0 })} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">All tiers</option>
          <option value="tier_1">Tier 1</option>
          <option value="tier_2">Tier 2</option>
          <option value="pending_first_event">Pending first event</option>
        </select>
        <label className="sr-only" htmlFor="supplier-rating-filter">Rating</label>
        <select id="supplier-rating-filter" value={query.rating} onChange={(event) => onQueryChange({ rating: event.target.value as PmcmSupplierDirectoryQuery["rating"], page: 0 })} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="all">Any rating</option>
          <option value="4.5">4.5 and above</option>
          <option value="4.0">4.0 and above</option>
          <option value="unrated">Not reviewed</option>
        </select>
        <label className="sr-only" htmlFor="supplier-sort">Sort suppliers</label>
        <select id="supplier-sort" value={query.sort} onChange={(event) => onQueryChange({ sort: event.target.value as PmcmSupplierDirectoryQuery["sort"], page: 0 })} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          {sortOptions.map(([value, label]) => <option key={value} value={value}>Sort: {label}</option>)}
        </select>
        <Button type="button" variant="outline" size="sm" aria-label={`Sort ${query.direction === "asc" ? "descending" : "ascending"}`} onClick={() => onQueryChange({ direction: query.direction === "asc" ? "desc" : "asc" })}>
          {query.direction === "asc" ? <ArrowUp /> : <ArrowDown />}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      {view === "contracts" || view === "payments" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-3 text-sm">
          <p>Supplier {view} are managed inside an event workspace.</p>
          <a href="/dashboard/events" className="font-semibold text-primary underline-offset-4 hover:underline">Open an event workspace</a>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-b border-destructive/20 bg-destructive/5 px-4 py-3 text-sm">
          <p>{error}</p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>Retry</Button>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-muted/80 text-xs font-medium text-muted-foreground backdrop-blur">
            <tr className="h-10 border-b border-border">
              <th scope="col" className="px-4">Supplier</th>
              <th scope="col" className="px-3">Category</th>
              <th scope="col" className="px-3">Tier</th>
              <th scope="col" className="px-3">Contact</th>
              <th scope="col" className="px-3">Rating</th>
              <th scope="col" className="px-3">Certifications</th>
              <th scope="col" className="px-3">Last review</th>
            </tr>
          </thead>
          <tbody>
            {directory?.items.map((supplier) => (
              <tr key={supplier.id} className="h-11 border-b border-border/70 transition-colors hover:bg-muted/40">
                <th scope="row" className="px-4 font-medium">
                  <button type="button" onClick={(event) => onSelectSupplier(supplier.id, event.currentTarget)} className="max-w-[230px] truncate text-left text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {supplier.name}
                  </button>
                  {supplier.bniMember ? <span className="ml-2 text-xs text-muted-foreground">BNI</span> : null}
                </th>
                <td className="px-3 text-muted-foreground">{supplier.categoryName}</td>
                <td className="px-3">{supplier.tier.replaceAll("_", " ")}</td>
                <td className="max-w-[190px] px-3 text-muted-foreground">
                  <span className="block truncate">{supplier.contactName || "No contact on file"}</span>
                  <span className="block truncate text-xs">{supplier.email || supplier.phone || ""}</span>
                </td>
                <td className="whitespace-nowrap px-3">{ratingLabel(supplier.rating)}</td>
                <td className="px-3 text-muted-foreground">{certificationLabel(supplier.certifications.attention, supplier.certifications)}</td>
                <td className="whitespace-nowrap px-3 text-muted-foreground">{dateLabel(supplier.lastReviewedAt)}</td>
              </tr>
            ))}
            {!directory?.items.length && !loading ? (
              <tr><td colSpan={7} className="px-4 py-14 text-center text-sm text-muted-foreground">No suppliers match these filters.</td></tr>
            ) : null}
            {!directory?.items.length && loading ? (
              <tr><td colSpan={7} className="px-4 py-14 text-center text-sm text-muted-foreground">Loading supplier directory…</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-muted-foreground">
        <span>{directory ? `${directory.totalCount} suppliers` : loading ? "Loading suppliers" : "Supplier count unavailable"}</span>
        <div className="flex items-center gap-2">
          <label htmlFor="supplier-page-size">Rows</label>
          <select id="supplier-page-size" value={query.pageSize} onChange={(event) => onQueryChange({ pageSize: Number(event.target.value) as 25 | 50, page: 0 })} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
            <option value={25}>25</option><option value={50}>50</option>
          </select>
          <span className="min-w-20 text-center">Page {query.page + 1}</span>
          <Button type="button" variant="outline" size="sm" disabled={!canGoPrevious || loading} onClick={() => onQueryChange({ page: query.page - 1 })}>Previous</Button>
          <Button type="button" variant="outline" size="sm" disabled={!canGoNext || loading} onClick={() => onQueryChange({ page: query.page + 1 })}>Next</Button>
        </div>
      </div>
    </section>
  );
}
