import { CheckCircle2, ClipboardCheck } from "lucide-react";
import type {
  CreateSupplierReviewInput,
  PrismEvent,
  PrismSupplier,
  PrismSupplierCategory,
  PrismSupplierQuoteRequest,
} from "@prism/types";
import { SupplierReviewPanel } from "./supplier-review-panel";
import {
  selectSupplierReviewSubjects,
  type SupplierReviewSubject,
} from "../model/supplier-review-rules";
import { useSupplierAssessmentForm } from "../view-models/use-supplier-assessment-form";

export type SupplierReviewPromptListProps = {
  event: PrismEvent;
  categories: readonly PrismSupplierCategory[];
  suppliers: readonly PrismSupplier[];
  quoteRequests: readonly PrismSupplierQuoteRequest[];
  busy: boolean;
  onAddReview: (supplierId: string, input: CreateSupplierReviewInput) => Promise<boolean>;
};

export function SupplierReviewPromptList({
  event,
  categories,
  suppliers,
  quoteRequests,
  busy,
  onAddReview,
}: SupplierReviewPromptListProps) {
  const subjects = selectSupplierReviewSubjects(suppliers, quoteRequests, event.id);
  const dueSubjects = subjects.filter((subject) => !subject.completed);
  const completedCount = subjects.length - dueSubjects.length;

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <ClipboardCheck className="mt-1 size-5 text-attention" />
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-attention">Supplier reviews</p>
            <h3 className="mt-1 text-xl font-black">Close the loop with assigned suppliers</h3>
            <p className="mt-1 text-sm text-muted-foreground">Private PMCM evidence for {event.eventName}.</p>
          </div>
        </div>
        <p className="text-sm font-black text-muted-foreground">{dueSubjects.length} due · {completedCount} completed</p>
      </div>

      {subjects.length === 0 ? (
        <div className="mt-5 rounded-md border border-dashed border-border bg-muted p-6 text-sm text-muted-foreground">
          No confirmed supplier assignments need review.
        </div>
      ) : (
        <div className="mt-5 grid gap-4">
          {subjects.map((subject) => (
            <SupplierReviewPromptCard
              key={subject.supplier.id}
              subject={subject}
              category={categories.find((category) => category.id === subject.supplier.categoryId)}
              busy={busy}
              onAddReview={onAddReview}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SupplierReviewPromptCard({
  subject,
  category,
  busy,
  onAddReview,
}: {
  subject: SupplierReviewSubject;
  category?: PrismSupplierCategory;
  busy: boolean;
  onAddReview: (supplierId: string, input: CreateSupplierReviewInput) => Promise<boolean>;
}) {
  const form = useSupplierAssessmentForm({
    supplierId: subject.supplier.id,
    dimensions: category?.reviewDimensions ?? [],
    initiallyCompleted: subject.completed,
    onAddReview,
  });
  const { completed } = form;

  return (
    <article className="rounded-lg border border-border bg-background p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-black">{subject.supplier.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">{subject.requestCategory}</p>
        </div>
        {completed && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-xs font-black text-success">
            <CheckCircle2 className="size-3.5" /> Review saved
          </span>
        )}
      </div>
      {!completed && (
        <SupplierReviewPanel
          reviewForm={{ rating: form.draft.rating, notes: form.draft.notes }}
          reviewDimensionRatings={form.dimensionRatings}
          dimensions={category?.reviewDimensions ?? []}
          busy={busy}
          onReviewForm={form.updateDraft}
          onReviewDimension={form.updateDimension}
          onSubmitReview={() => { void form.submit(); }}
          canSubmit={form.canSubmit}
          missingDimensionNames={form.missingDimensionNames}
          validationMessage={form.validationMessage}
        />
      )}
    </article>
  );
}
