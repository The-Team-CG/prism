import { Star } from "lucide-react";
import { Button } from "@prism/ui/components/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";

export type SupplierReviewForm = { rating: string; notes: string };

export type SupplierReviewPanelProps = {
  reviewForm: SupplierReviewForm;
  reviewDimensionRatings: Record<string, string>;
  dimensions: Array<{ id: string; name: string }>;
  busy: boolean;
  onReviewForm: (patch: Partial<SupplierReviewForm>) => void;
  onReviewDimension: (dimensionId: string, value: string) => void;
  onSubmitReview: () => void;
  /** Defaults to "notes present"; the closure prompt flow passes the full dimension-complete gate. */
  canSubmit?: boolean;
  missingDimensionNames?: string[];
  validationMessage?: string | null;
};

/** Radix Select cannot hold an empty-string item, so "none" stands for an unrated dimension. */
const NOT_RATED = "none";
const RATINGS = ["5", "4", "3", "2", "1"];

export function SupplierReviewPanel({
  reviewForm,
  reviewDimensionRatings,
  dimensions,
  busy,
  onReviewForm,
  onReviewDimension,
  onSubmitReview,
  canSubmit = Boolean(reviewForm.notes.trim()),
  missingDimensionNames = [],
  validationMessage = null,
}: SupplierReviewPanelProps) {
  return (
    <div className="rounded-lg border border-border bg-muted p-4">
      <p className="text-sm text-muted-foreground">Private PMCM Review</p>
      <div className="mt-3 grid gap-2">
        <Select value={reviewForm.rating} onValueChange={(rating) => onReviewForm({ rating })}>
          <SelectTrigger aria-label="Overall supplier rating" className="h-10 w-full min-w-0 bg-white text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RATINGS.map((value) => <SelectItem key={value} value={value}>{value} stars</SelectItem>)}
          </SelectContent>
        </Select>
        <textarea
          aria-label="Private supplier review notes"
          value={reviewForm.notes}
          onChange={(event) => onReviewForm({ notes: event.target.value })}
          className="min-h-20 rounded-md border border-border bg-white px-3 py-2 text-sm"
          placeholder="Private review notes"
        />
      </div>
      {dimensions.length > 0 && (
        <div className="mt-3 grid gap-2">
          <p className="text-xs font-medium text-muted-foreground">Category dimensions</p>
          {dimensions.map((dimension) => (
            <div key={dimension.id} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm" title={dimension.name}>{dimension.name}</span>
              <Select value={reviewDimensionRatings[dimension.id] || NOT_RATED} onValueChange={(value) => onReviewDimension(dimension.id, value === NOT_RATED ? "" : value)}>
                <SelectTrigger aria-label={dimension.name} className="h-9 w-24 min-w-0 bg-white text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NOT_RATED}>Not rated</SelectItem>
                  {RATINGS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
      {missingDimensionNames.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">Rate every dimension to submit: {missingDimensionNames.join(", ")}.</p>
      )}
      {validationMessage && <p className="mt-3 text-xs text-muted-foreground">{validationMessage}</p>}
      <Button type="button" size="sm" disabled={busy || !canSubmit} onClick={onSubmitReview} className="mt-3">
        <Star className="size-4" /> Add review
      </Button>
    </div>
  );
}
