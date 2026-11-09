import { formatPortalDate } from "@prism/ui/format-date";
import { ArrowDown, ArrowUp, CalendarDays, ChevronRight, RefreshCw, Search } from "lucide-react";
import { Alert, AlertDescription } from "@prism/ui/components/alert";
import { Badge } from "@prism/ui/components/badge";
import { Button } from "@prism/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@prism/ui/components/empty";
import { ScrollArea, ScrollBar } from "@prism/ui/components/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@prism/ui/components/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@prism/ui/components/tooltip";
import type { PmcmSupplierDirectoryQuery, PrismPmcmSupplierDirectoryPage, PrismSupplierCategory } from "@prism/types";
import { BNI_TITLE, SupplierAvatar, supplierTierLabel } from "./supplier-visuals";
import styles from "./supplier-workspace.module.css";

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
  onSearch: (value: string) => void;
  onQueryChange: QueryChange;
  onSelectSupplier: (supplierId: string, trigger: HTMLButtonElement) => void;
  onRefresh: () => void;
  onRetry: () => void;
};

/** Radix Select cannot hold an empty-string item, so "all" stands for "no filter". */
const ALL = "all";
const PAGE_SIZES = [25, 50] as const;

function dateLabel(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "Asia/Manila" }).format(date);
}

function ratingLabel(rating: { average: number | null; count: number }) {
  return rating.average === null ? "Not reviewed" : `${rating.average.toFixed(1)} / 5 (${rating.count})`;
}

function certificationLabel(attention: string, counts: { rejected: number; expired: number; submitted: number; verified: number; unknown: number }) {
  if (attention === "none") return "No records";
  const total = counts.rejected + counts.expired + counts.submitted + counts.verified + counts.unknown;
  return `${attention[0]?.toUpperCase()}${attention.slice(1)} · ${total}`;
}

function certificationDotClass(attention: string) {
  const classes: Record<string, string> = {
    none: "bg-muted-foreground",
    verified: "bg-success",
    expired: "bg-danger",
    rejected: "bg-danger",
  };
  return classes[attention] ?? "bg-attention";
}

export function SupplierDirectoryTable(props: SupplierDirectoryTableProps) {
  const canGoPrevious = props.query.page > 0;
  const canGoNext = Boolean(props.directory?.hasNextPage);

  return (
    <TooltipProvider>
      <section aria-label="Supplier directory" className={`${styles.table} min-w-0 overflow-hidden`}>
        <SupplierDirectoryFilters {...props} />
        {props.view === "contracts" || props.view === "payments" ? <PortalScopeNotice view={props.view} /> : null}
        {props.error ? <DirectoryError message={props.error} onRetry={props.onRetry} /> : null}
        <ScrollArea className="w-full">
          <Table className="min-w-[880px]">
            <TableHeader className="bg-muted/60 text-xs text-muted-foreground">
              <TableRow className="hover:bg-transparent">
                <TableHead className="sticky left-0 z-10 min-w-[200px] bg-muted/60 pl-4">Supplier</TableHead>
                <TableHead className="min-w-[150px]">Category</TableHead>
                <TableHead className="min-w-[150px]">Tier</TableHead>
                <TableHead className="min-w-[200px]">Contact</TableHead>
                <TableHead className="min-w-[130px]">Rating</TableHead>
                <TableHead className="min-w-[140px]">Certifications</TableHead>
                <TableHead className="min-w-[110px]">Last review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.directory?.items.map((supplier) => (
                <SupplierDirectoryRow
                  key={supplier.id}
                  supplier={supplier}
                  selected={props.selectedSupplierId === supplier.id}
                  onSelect={props.onSelectSupplier}
                />
              ))}
              {!props.directory?.items.length ? <DirectoryEmptyRow loading={props.loading} /> : null}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
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

function SupplierDirectoryFilters({ categories, query, searchDraft, loading, onSearch, onQueryChange, onRefresh }: SupplierDirectoryTableProps) {
  const sortOptions: Array<[PmcmSupplierDirectoryQuery["sort"], string]> = [
    ["name", "Name"],
    ["rating", "Rating"],
    ["last_review", "Last review"],
    ["certifications", "Certifications"],
  ];
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
  const presetCategoryMissing = Boolean(query.categoryId && !categories.some((category) => category.id === query.categoryId));

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
      <label className="relative min-w-[180px] flex-1 sm:max-w-[220px]">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <span className="sr-only">Search suppliers</span>
        <input value={searchDraft} onChange={(event) => onSearch(event.target.value)} placeholder="Search suppliers" className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/35" />
      </label>
      <Select value={query.categoryId ?? ALL} onValueChange={(value) => onQueryChange({ categoryId: value === ALL ? undefined : value, page: 0 })}>
        <SelectTrigger id="supplier-category-filter" aria-label="Category" className="h-9 w-40 min-w-0 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All categories</SelectItem>
          {presetCategoryMissing && query.categoryId ? <SelectItem value={query.categoryId}>No category set up for this view</SelectItem> : null}
          {categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={query.tier ?? ALL} onValueChange={(value) => onQueryChange({ tier: value === ALL ? undefined : tierOptions.find(([option]) => option === value)?.[0], page: 0 })}>
        <SelectTrigger id="supplier-tier-filter" aria-label="Tier" className="h-9 w-36 min-w-0 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All tiers</SelectItem>
          {tierOptions.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={query.rating} onValueChange={(value) => onQueryChange({ rating: ratingOptions.find(([option]) => option === value)?.[0] ?? query.rating, page: 0 })}>
        <SelectTrigger id="supplier-rating-filter" aria-label="Rating" className="h-9 w-36 min-w-0 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ratingOptions.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={query.sort} onValueChange={(value) => onQueryChange({ sort: sortOptions.find(([option]) => option === value)?.[0] ?? query.sort, page: 0 })}>
        <SelectTrigger id="supplier-sort" aria-label="Sort suppliers" className="h-9 w-40 min-w-0 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map(([value, label]) => <SelectItem key={value} value={value}>Sort: {label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button type="button" variant="outline" size="sm" aria-label={`Sort ${query.direction === "asc" ? "descending" : "ascending"}`} onClick={() => onQueryChange({ direction: query.direction === "asc" ? "desc" : "asc" })}>
        {query.direction === "asc" ? <ArrowUp /> : <ArrowDown />}
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
        <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
      </Button>
    </div>
  );
}

function PortalScopeNotice({ view }: { view: string }) {
  return (
    <Alert className="rounded-none border-x-0 border-t-0">
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>Supplier {view} are managed inside an event workspace.</span>
        <Button asChild variant="link" size="sm" className="h-auto p-0">
          <a href="/dashboard/events">Open an event workspace</a>
        </Button>
      </AlertDescription>
    </Alert>
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

function TruncatedText({ value, className = "" }: { value: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`block min-w-0 truncate ${className}`}>{value}</span>
      </TooltipTrigger>
      <TooltipContent>{value}</TooltipContent>
    </Tooltip>
  );
}

function SupplierDirectoryRow({ supplier, selected, onSelect }: { supplier: SupplierRow; selected: boolean; onSelect: SupplierDirectoryTableProps["onSelectSupplier"] }) {
  return (
    <TableRow data-state={selected ? "selected" : undefined} className={selected ? styles.selectedRow : undefined}>
      <SupplierNameCell supplier={supplier} onSelect={onSelect} />
      <TableCell>
        <Badge variant="secondary" className="max-w-full min-w-0"><TruncatedText value={supplier.categoryName} /></Badge>
      </TableCell>
      <TableCell>
        <Badge variant={supplier.tier === "pending_first_event" ? "outline" : "success"} className="whitespace-nowrap">{supplierTierLabel(supplier.tier)}</Badge>
      </TableCell>
      <SupplierContactCell supplier={supplier} />
      <TableCell className="whitespace-nowrap text-sm">{ratingLabel(supplier.rating)}</TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        <span className={`mr-1.5 inline-block size-1.5 rounded-full ${certificationDotClass(supplier.certifications.attention)}`} />{certificationLabel(supplier.certifications.attention, supplier.certifications)}
      </TableCell>
      <SupplierReviewDateCell lastReviewedAt={supplier.lastReviewedAt} />
    </TableRow>
  );
}

function SupplierNameCell({ supplier, onSelect }: { supplier: SupplierRow; onSelect: SupplierDirectoryTableProps["onSelectSupplier"] }) {
  return (
    <TableCell className="sticky left-0 z-[1] bg-card pl-4 font-medium">
      <div className="flex min-w-0 max-w-[18rem] items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" onClick={(event) => onSelect(supplier.id, event.currentTarget)} className="group flex min-h-6 min-w-0 flex-1 items-center justify-between gap-1 text-left text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="truncate">{supplier.name}</span><ChevronRight aria-hidden="true" className="size-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{supplier.name}</TooltipContent>
        </Tooltip>
        {supplier.bniMember ? <Tooltip><TooltipTrigger asChild><Badge variant="info" className="shrink-0">BNI</Badge></TooltipTrigger><TooltipContent>{BNI_TITLE}</TooltipContent></Tooltip> : null}
      </div>
    </TableCell>
  );
}

function SupplierContactCell({ supplier }: { supplier: SupplierRow }) {
  const contactValue = supplier.email || supplier.phone || "";
  return (
    <TableCell className="text-muted-foreground">
      <div className="flex min-w-0 items-center gap-2">
        <SupplierAvatar name={supplier.contactName || supplier.name} />
        <div className="min-w-0">
          <TruncatedText value={supplier.contactName || "No contact on file"} />
          {contactValue ? <TruncatedText value={contactValue} className="text-xs" /> : null}
        </div>
      </div>
    </TableCell>
  );
}

function SupplierReviewDateCell({ lastReviewedAt }: { lastReviewedAt: string | null }) {
  return (
    <TableCell className="whitespace-nowrap text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <CalendarDays aria-hidden="true" className="size-3" />
        {lastReviewedAt ? <time dateTime={lastReviewedAt} title={formatPortalDate(lastReviewedAt)}>{dateLabel(lastReviewedAt)}</time> : dateLabel(null)}
      </span>
    </TableCell>
  );
}

function DirectoryEmptyRow({ loading }: { loading: boolean }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={7} className="p-0">
        <Empty className="border-0 p-10">
          <EmptyHeader>
            <EmptyTitle>{loading ? "Loading supplier directory" : "No suppliers match these filters"}</EmptyTitle>
            {loading ? null : <EmptyDescription>Clear a filter or search term to widen the directory.</EmptyDescription>}
          </EmptyHeader>
        </Empty>
      </TableCell>
    </TableRow>
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
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-muted-foreground">
      <span>{resultCount}</span>
      <div className="flex items-center gap-2">
        <span id="supplier-page-size-label">Rows</span>
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
