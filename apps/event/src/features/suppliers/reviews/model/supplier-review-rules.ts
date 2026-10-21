import type { PrismSupplier, PrismSupplierQuoteRequest } from "@prism/types";

export type SupplierReviewSubject = {
  supplier: PrismSupplier;
  requestCategory: string;
  completed: boolean;
};

export function selectSupplierReviewSubjects(
  suppliers: readonly PrismSupplier[],
  quoteRequests: readonly PrismSupplierQuoteRequest[],
  eventId: string,
): SupplierReviewSubject[] {
  const suppliersById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
  const seenSupplierIds = new Set<string>();

  return quoteRequests.flatMap((request) => {
    if (request.eventId !== eventId || request.assignmentStatus !== "confirmed" || !request.supplierId || seenSupplierIds.has(request.supplierId)) {
      return [];
    }

    const matchedSupplier = suppliersById.get(request.supplierId);
    if (!matchedSupplier) return [];

    seenSupplierIds.add(request.supplierId);
    return [{
      supplier: matchedSupplier,
      requestCategory: request.category || matchedSupplier.categoryName,
      completed: matchedSupplier.reviews.some((review) => review.eventId === eventId),
    }];
  });
}
