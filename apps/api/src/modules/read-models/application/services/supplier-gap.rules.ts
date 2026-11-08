import type { PrismSupplierGap } from '@prism/types';

export type SupplierGapSupplier = {
  id: string;
  categoryId: string;
  tier: string;
  /** Availability row for the event date, if PMCM or the supplier recorded one. */
  availability: { blocked: boolean; capacity: number } | null;
  /** Selected bookings this supplier already holds on the event date, across events. */
  bookingsOnDate: number;
};

export type SupplierGapCategory = { id: string; name: string; coveredByThisEvent: boolean };

/** No availability row means the supplier has not ruled the date out, matching the selection capacity check. */
export function isSupplierAvailable(supplier: SupplierGapSupplier): boolean {
  if (!supplier.availability) return true;
  if (supplier.availability.blocked || supplier.availability.capacity < 1) return false;
  return supplier.bookingsOnDate < supplier.availability.capacity;
}

export function supplierGapsFrom(input: {
  eventDate: string;
  categories: SupplierGapCategory[];
  suppliers: SupplierGapSupplier[];
  acknowledgements: Map<string, PrismSupplierGap['acknowledgement']>;
}): PrismSupplierGap[] {
  return input.categories.map((category) => {
    const available = input.suppliers.filter((supplier) => supplier.categoryId === category.id && isSupplierAvailable(supplier));
    const tier1Available = available.filter((supplier) => supplier.tier === 'tier_1').length;
    const tier2Available = available.filter((supplier) => supplier.tier === 'tier_2').length;
    return {
      categoryId: category.id,
      categoryName: category.name,
      eventDate: input.eventDate,
      tier1Available,
      tier2Available,
      gap: !category.coveredByThisEvent && tier1Available + tier2Available === 0,
      acknowledgement: input.acknowledgements.get(category.id) ?? null,
    };
  });
}
