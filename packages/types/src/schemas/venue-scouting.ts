import { z } from "zod";

/** FR-10: PMCM shows the client at least this many venues before the shortlist is published. */
export const VENUE_SCOUTING_MIN_OPTIONS = 3;

const calendarDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD dates");

export const createVenueScoutingOptionSchema = z.object({
  name: z.string().trim().min(1).max(200),
  location: z.string().trim().min(1).max(300),
  capacity: z.number().int().positive().max(100000),
  priceRange: z.string().trim().min(1).max(120),
  availableDates: z.array(calendarDate).min(1).max(20),
  notes: z.string().trim().max(2000).default(""),
});
export type CreateVenueScoutingOptionInput = z.input<typeof createVenueScoutingOptionSchema>;

export const chooseVenueScoutingPreferenceSchema = z.object({
  optionId: z.string().trim().min(1),
  note: z.string().trim().max(2000).default(""),
});
export type ChooseVenueScoutingPreferenceInput = z.input<typeof chooseVenueScoutingPreferenceSchema>;

export type PrismVenueScoutingOptionStatus = "draft" | "published" | "withdrawn";

export interface PrismVenueScoutingOption {
  id: string;
  eventId: string;
  name: string;
  location: string;
  capacity: number;
  priceRange: string;
  availableDates: string[];
  notes: string;
  status: PrismVenueScoutingOptionStatus;
  /** Set on the one option the client prefers. */
  clientPreferredAt: string | null;
  clientPreferenceNote: string;
  createdAt: string;
}

export interface PrismVenueScouting {
  eventId: string;
  options: PrismVenueScoutingOption[];
  preferredOptionId: string | null;
}
