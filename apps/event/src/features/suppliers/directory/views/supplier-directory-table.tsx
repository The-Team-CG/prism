import { Search, Star } from "lucide-react";
import { Alert, AlertDescription } from "@prism/ui/components/alert";
import { Button } from "@prism/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@prism/ui/components/empty";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@prism/ui/components/tooltip";
import type { PmcmSupplierDirectoryQuery, PrismPmcmSupplierDirectoryPage, PrismPmcmSupplierNextBooking, PrismSupplierCategory } from "@prism/types";
import { formatPortalDate } from "@prism/ui/format-date";
import { cx } from "@/features/pmcm-kit";
import { BNI_TITLE, supplierTierLabel } from "./supplier-visuals";

type SupplierRow = PrismPmcmSupplierDirectoryPage["items"][number];
type QueryChange = (patch: Partial<PmcmSupplierDirectoryQuery>) => void;
type Tier = NonNullable<PmcmSupplierDirectoryQuery["tier"]>;

type SupplierDirectoryTableProps = {
  directory: PrismPmcmSupplierDirectoryPage | null;
  categories: PrismSupplierCategory[];
  query: PmcmSupplierDirectoryQuery;
  searchDraft: string;
  loading: boolean;
  error: string | null;
  view: string;
  selectedSupplierId?: string | null;
  /** Each supplier's soonest upcoming confirmed booking, once loaded. */
  nextBookings?: ReadonlyMap<string, PrismPmcmSupplierNextBooking>;
  onSearch: (value: string) => void;
  onQueryChange: QueryChange;
  onSelectSupplier: (supplierId: string, trigger: HTMLButtonElement) => void;
  onRefresh: () => void;
  onRetry: () => void;
};

/** Radix Select cannot hold an empty-string item, so "all" stands for "no filter". */
const ALL = "all";
const PAGE_SIZES = [25, 50] as const;

/** One sort menu: each option is a field and its direction, instead of a field menu plus a separate arrow button. */
const SORTS: Array<{ id: string; label: string; sort: PmcmSupplierDirectoryQuery["sort"]; direction: PmcmSupplierDirectoryQuery["direction"] }> = [
  { id: "name-asc", label: "Name A to Z", sort: "name", direction: "asc" },
  { id: "rating-desc", label: "Highest rated", sort: "rating", direction: "desc" },
  { id: "last_review-desc", label: "Recently reviewed", sort: "last_review", direction: "desc" },
  { id: "certifications-asc", label: "Certificates needing attention", sort: "certifications", direction: "asc" },
];

/** What PMCM is missing for a supplier: contact gaps and certificates needing attention, one line each. */
export function supplierGaps(supplier: Pick<SupplierRow, "contactName" | "email" | "phone" | "certifications">): string[] {
  const gaps: string[] = [];
  if (!supplier.contactName.trim()) gaps.push("No contact person");
  if (!supplier.email.trim() && !supplier.phone.trim()) gaps.push("No email or phone");
  const { attention, expired, rejected, submitted } = supplier.certifications;
  if (attention === "expired") gaps.push(expired === 1 ? "1 certificate expired" : `${expired} certificates expired`);
  else if (attention === "rejected") gaps.push(rejected === 1 ? "1 certificate rejected" : `${rejected} certificates rejected`);
  else if (attention === "submitted") gaps.push(submitted === 1 ? "1 certificate to check" : `${submitted} certificates to check`);
  return gaps;
}

/**
 * The supplier directory as cards: what each supplier does and at what tier, how often PMCM has booked them, how
 * they are rated, and what PMCM is missing for them. Categories are chips, sorting is one menu, and pages stay
 * server-side.
 */
export function SupplierDirectoryCards(props: SupplierDirectoryTableProps) {
  const canGoPrevious = props.query.page > 0;
  const canGoNext = Boolean(props.directory?.hasNextPage);
  const items = props.directory?.items ?? [];
  return (
    <TooltipProvider>
      <section aria-label="Supplier directory" className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
        <SupplierDirectoryFilters {...props} />
        {props.error ? <DirectoryError message={props.error} onRetry={props.onRetry} /> : null}
        {items.length ? (
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((supplier) => (
              <SupplierCard key={supplier.id} supplier={supplier} next={props.nextBookings?.get(supplier.id)} selected={props.selectedSupplierId === supplier.id} onSelect={props.onSelectSupplier} />
            ))}
          </ul>
        ) : (
          <DirectoryEmpty loading={props.loading} />
        )}
        <DirectoryPagination
          directory={props.directory}
          query={props.query}
          loading={props.loading}
          canGoPrevious={canGoPrevious}
          canGoNext={canGoNext}
          onQueryChange={props.onQueryChange}
        />
      </section>
    </TooltipProvider>
  );
}

function SupplierDirectoryFilters({ categories, query, searchDraft, onSearch, onQueryChange }: SupplierDirectoryTableProps) {
  const tierOptions: Array<[Tier, string]> = [
    ["tier_1", "Tier 1"],
    ["tier_2", "Tier 2"],
    ["pending_first_event", "First event pending"],
  ];
  const ratingOptions: Array<[PmcmSupplierDirectoryQuery["rating"], string]> = [
    ["all", "Any rating"],
    ["4.5", "4.5 and above"],
    ["4.0", "4.0 and above"],
    ["unrated", "Not reviewed"],
  ];
  const sortId = SORTS.find((entry) => entry.sort === query.sort && entry.direction === query.direction)?.id ?? SORTS[0].id;
  const chip = (on: boolean) => cx("rounded-full border px-3 py-1 text-sm transition-colors", on ? "border-ink bg-ink text-ink-foreground" : "border-border bg-card text-foreground hover:bg-surface-raised");
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
        <label className="relative col-span-2 min-w-0 flex-1 sm:min-w-[200px] sm:max-w-[280px]">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <span className="sr-only">Search suppliers</span>
          <input value={searchDraft} onChange={(event) => onSearch(event.target.value)} placeholder="Search suppliers" className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/35" />
        </label>
        <Select value={query.tier ?? ALL} onValueChange={(value) => onQueryChange({ tier: value === ALL ? undefined : tierOptions.find(([option]) => option === value)?.[0], page: 0 })}>
          <SelectTrigger id="supplier-tier-filter" aria-label="Tier" className="h-9 w-full min-w-0 text-sm sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All tiers</SelectItem>
            {tierOptions.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={query.rating} onValueChange={(value) => onQueryChange({ rating: ratingOptions.find(([option]) => option === value)?.[0] ?? query.rating, page: 0 })}>
          <SelectTrigger id="supplier-rating-filter" aria-label="Rating" className="h-9 w-full min-w-0 text-sm sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ratingOptions.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sortId} onValueChange={(value) => { const entry = SORTS.find((option) => option.id === value); if (entry) onQueryChange({ sort: entry.sort, direction: entry.direction, page: 0 }); }}>
          <SelectTrigger id="supplier-sort" aria-label="Sort suppliers" className="col-span-2 h-9 w-full min-w-0 text-sm sm:w-60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((entry) => <SelectItem key={entry.id} value={entry.id}>Sort: {entry.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {categories.length ? (
        <div role="group" aria-label="Category" className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={!query.categoryId} onClick={() => onQueryChange({ categoryId: undefined, page: 0 })} className={chip(!query.categoryId)}>All categories</button>
          {categories.map((category) => (
            <button key={category.id} type="button" aria-pressed={query.categoryId === category.id} onClick={() => onQueryChange({ categoryId: category.id, page: 0 })} className={chip(query.categoryId === category.id)}>
              {category.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}


function DirectoryError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert variant="destructive" role="alert" className="rounded-none border-x-0 border-t-0">
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>{message}</span>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>Retry</Button>
      </AlertDescription>
    </Alert>
  );
}

function SupplierCard({ supplier, next, selected, onSelect }: { supplier: SupplierRow; next?: PrismPmcmSupplierNextBooking; selected: boolean; onSelect: SupplierDirectoryTableProps["onSelectSupplier"] }) {
  const gaps = supplierGaps(supplier);
  return (
    <li data-testid="supplier-card" className={cx("relative grid content-start gap-2 rounded-xl border bg-card p-4 transition-colors hover:bg-surface-raised has-[button:focus-visible]:ring-2 has-[button:focus-visible]:ring-ring", selected ? "border-primary" : "border-border")}>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <button type="button" onClick={(event) => onSelect(supplier.id, event.currentTarget)} className="block max-w-full truncate text-left text-base font-semibold text-foreground outline-none after:absolute after:inset-0">
            {supplier.name}
          </button>
          <p className="truncate text-sm text-muted-foreground">{[supplier.categoryName, supplierTierLabel(supplier.tier)].join(" · ")}</p>
        </div>
        {supplier.bniMember ? <Tooltip><TooltipTrigger asChild><span className="relative z-[1] shrink-0 rounded bg-info-soft px-1.5 py-0.5 text-xs font-medium text-info">BNI</span></TooltipTrigger><TooltipContent>{BNI_TITLE}</TooltipContent></Tooltip> : null}
      </div>
      <p className="text-sm text-foreground">
        {supplier.bookedEvents > 0 ? <>Booked on <span className="font-semibold">{supplier.bookedEvents} {supplier.bookedEvents === 1 ? "event" : "events"}</span></> : <span className="text-muted-foreground">Not booked yet</span>}
      </p>
      {next ? <p className="truncate text-sm text-muted-foreground">Next: <span className="text-foreground">{formatPortalDate(next.eventDate)}</span> · {next.eventName}</p> : null}
      <p className="flex items-center gap-1.5 text-sm">
        {supplier.rating.average === null ? (
          <span className="text-muted-foreground">No reviews yet</span>
        ) : (
          <>
            <Star aria-hidden className="size-3.5 fill-current text-attention" />
            <span className="font-medium text-foreground">{supplier.rating.average.toFixed(1)}</span>
            <span className="text-muted-foreground">from {supplier.rating.count} {supplier.rating.count === 1 ? "review" : "reviews"}</span>
          </>
        )}
      </p>
      {gaps.length ? (
        <ul className="grid gap-0.5 text-xs font-medium text-attention">
          {gaps.map((gap) => <li key={gap}>{gap}</li>)}
        </ul>
      ) : null}
    </li>
  );
}

function DirectoryEmpty({ loading }: { loading: boolean }) {
  return (
    <Empty className="rounded-xl border border-border bg-card p-10">
      <EmptyHeader>
        <EmptyTitle>{loading ? "Loading supplier directory" : "No suppliers match these filters"}</EmptyTitle>
        {loading ? null : <EmptyDescription>Clear a filter or search term to widen the directory.</EmptyDescription>}
      </EmptyHeader>
    </Empty>
  );
}


function DirectoryPagination({ directory, query, loading, canGoPrevious, canGoNext, onQueryChange }: {
  directory: PrismPmcmSupplierDirectoryPage | null;
  query: PmcmSupplierDirectoryQuery;
  loading: boolean;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onQueryChange: QueryChange;
}) {
  const resultCount = directory ? `${directory.totalCount} suppliers` : loading ? "Loading suppliers" : "Supplier count unavailable";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
      <span>{resultCount}</span>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span id="supplier-page-size-label">Per page</span>
        <Select value={String(query.pageSize)} onValueChange={(value) => onQueryChange({ pageSize: PAGE_SIZES.find((size) => String(size) === value) ?? query.pageSize, page: 0 })}>
          <SelectTrigger id="supplier-page-size" aria-labelledby="supplier-page-size-label" className="h-8 w-20 min-w-0 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="min-w-20 text-center">Page {query.page + 1}</span>
        <Button type="button" variant="outline" size="sm" disabled={!canGoPrevious || loading} onClick={() => onQueryChange({ page: query.page - 1 })}>Previous</Button>
        <Button type="button" variant="outline" size="sm" disabled={!canGoNext || loading} onClick={() => onQueryChange({ page: query.page + 1 })}>Next</Button>
      </div>
    </div>
  );
}
