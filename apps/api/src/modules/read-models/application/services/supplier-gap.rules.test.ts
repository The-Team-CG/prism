import { describe, expect, it } from 'vitest';
import { isSupplierAvailable, supplierGapsFrom } from './supplier-gap.rules';

const supplier = (overrides: Record<string, unknown> = {}) => ({ id: 's1', categoryId: 'cat_av', tier: 'tier_1', availability: null, bookingsOnDate: 0, ...overrides });

describe('FR-63 supplier gap rule', () => {
  it('treats blocked, zero-capacity or fully booked suppliers as unavailable', () => {
    expect(isSupplierAvailable(supplier() as never)).toBe(true);
    expect(isSupplierAvailable(supplier({ availability: { blocked: true, capacity: 2 } }) as never)).toBe(false);
    expect(isSupplierAvailable(supplier({ availability: { blocked: false, capacity: 0 } }) as never)).toBe(false);
    expect(isSupplierAvailable(supplier({ availability: { blocked: false, capacity: 1 }, bookingsOnDate: 1 }) as never)).toBe(false);
  });

  it('flags a gap only when no Tier 1 or Tier 2 supplier is free and the event has no booking in that category', () => {
    const gaps = supplierGapsFrom({
      eventDate: '2026-12-01',
      categories: [
        { id: 'cat_av', name: 'Technicals', coveredByThisEvent: false },
        { id: 'cat_food', name: 'Catering', coveredByThisEvent: false },
        { id: 'cat_photo', name: 'Photo', coveredByThisEvent: true },
      ],
      suppliers: [
        supplier({ id: 'av1', availability: { blocked: true, capacity: 1 } }),
        supplier({ id: 'av2', tier: 'pending_first_event' }),
        supplier({ id: 'food1', categoryId: 'cat_food', tier: 'tier_2' }),
      ] as never,
      acknowledgements: new Map(),
    });
    expect(gaps.map((item) => [item.categoryName, item.gap])).toEqual([['Technicals', true], ['Catering', false], ['Photo', false]]);
  });
});

describe('FR-16 supplier selection policy', () => {
  it('allows Tier 2 only when no free Tier 1 supplier is rated for the event scale', () => {
    const categories = [{ id: 'cat_av', name: 'Technicals', coveredByThisEvent: false }];
    const run = (suppliers: unknown[], eventScale: 'small' | 'medium' | 'large' | null) => supplierGapsFrom({ eventDate: '2026-12-01', eventScale, categories, suppliers: suppliers as never, acknowledgements: new Map() })[0]!;

    const smallTier1 = supplier({ id: 'av1', capacityRating: 'small' });
    expect(run([smallTier1], 'small')).toMatchObject({ tier1Capable: 1, tier2EscalationAllowed: false });
    expect(run([smallTier1], 'large')).toMatchObject({ tier1Available: 1, tier1Capable: 0, tier2EscalationAllowed: true });
    expect(run([supplier({ id: 'av2', capacityRating: null })], 'large')).toMatchObject({ tier1Capable: 1, tier2EscalationAllowed: false });
    expect(run([supplier({ id: 'av3', capacityRating: 'large', availability: { blocked: true, capacity: 1 } })], 'medium')).toMatchObject({ tier1Capable: 0, tier2EscalationAllowed: true });
  });
});
