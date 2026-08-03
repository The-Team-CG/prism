import type { PARESupplierRecord, PARETriggerInput } from "@prism/types";

/**
 * The Ayala Summit withdrawal from the PARE service tests, reused as the sample
 * payload the agent apps fall back to when a tool is called without one. That
 * keeps `eve dev` and the evals useful without a database.
 */

export const SAMPLE_PARE_TRIGGER: PARETriggerInput = {
  triggerId: "qr_selected",
  event: {
    id: "evt_sample",
    eventName: "Ayala Summit",
    eventDate: "2026-06-18T00:00:00.000Z",
    clientName: "Ana Reyes",
  },
  withdrawnRequest: {
    supplierId: "sup_sonicline",
    supplierName: "SonicLine Technicals",
    category: "Technicals",
    supplierTier: "tier_1",
  },
  selectedQuotes: [],
  briefingServiceRequirements: [],
  now: "2026-05-07T00:00:00.000Z",
};

export const SAMPLE_PARE_SUPPLIERS: PARESupplierRecord[] = [
  {
    id: "sup_avbackup",
    name: "AV Backup Crew",
    tier: "tier_1",
    categoryName: "Technicals",
    serviceInclusions: "Backup lights and sound",
    performanceNotes: "Available for overflow work.",
    reviews: [],
    quoteRequests: [],
    quotes: [],
  },
];
