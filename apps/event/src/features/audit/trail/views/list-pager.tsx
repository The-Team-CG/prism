"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/app/components/ui/button";

/** Previous/next footer for a paged list; hidden when everything fits on one page. */
export function ListPager({
  label,
  rangeLabel,
  page,
  pageCount,
  onPrevious,
  onNext,
}: {
  label: string;
  rangeLabel: string;
  page: number;
  pageCount: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label={label} className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-sm">
      <span className="text-muted-foreground">{rangeLabel}</span>
      <span className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" disabled={page === 0} onClick={onPrevious} aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </Button>
        <span className="tabular-nums text-muted-foreground">
          {page + 1} / {pageCount}
        </span>
        <Button type="button" size="sm" variant="outline" disabled={page >= pageCount - 1} onClick={onNext} aria-label="Next page">
          <ChevronRight className="size-4" />
        </Button>
      </span>
    </nav>
  );
}
