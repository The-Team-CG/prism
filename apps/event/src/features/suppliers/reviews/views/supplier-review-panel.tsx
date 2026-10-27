import { Star } from "lucide-react";

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
      <p className="text-xs font-black uppercase tracking-[0.14em] text-attention">Private PMCM Review</p>
      <div className="mt-3 grid gap-2">
        <select
          aria-label="Overall supplier rating"
          value={reviewForm.rating}
          onChange={(event) => onReviewForm({ rating: event.target.value })}
          className="h-10 rounded-md border border-border bg-white px-3 text-sm"
        >
          {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} stars</option>)}
        </select>
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
          <p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Category dimensions</p>
          {dimensions.map((dimension) => (
            <div key={dimension.id} className="flex items-center justify-between gap-3">
              <span className="text-sm">{dimension.name}</span>
              <select
                aria-label={dimension.name}
                value={reviewDimensionRatings[dimension.id] ?? ""}
                onChange={(event) => onReviewDimension(dimension.id, event.target.value)}
                className="h-9 rounded-md border border-border bg-white px-2 text-sm"
              >
                <option value="">Not rated</option>
                {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
      {missingDimensionNames.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">Rate every dimension to submit: {missingDimensionNames.join(", ")}.</p>
      )}
      {validationMessage && <p className="mt-3 text-xs text-muted-foreground">{validationMessage}</p>}
      <button
        type="button"
        disabled={busy || !canSubmit}
        onClick={onSubmitReview}
        className="mt-3 inline-flex h-9 items-center gap-2 rounded-md bg-ink px-3 text-xs font-black text-sidebar-foreground disabled:opacity-60"
      >
        <Star className="size-4" /> Add review
      </button>
    </div>
  );
}
