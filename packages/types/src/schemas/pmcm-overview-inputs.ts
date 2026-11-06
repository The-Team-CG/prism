import { z } from "zod";

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a calendar date (YYYY-MM-DD)").refine(
  (value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  },
  "Expected a real calendar date",
);

/** The calendar window is bounded so one request cannot read the whole history. */
export const PMCM_CALENDAR_MAX_DAYS = 800;

export const pmcmCalendarQuerySchema = z
  .object({ from: dateKeySchema, to: dateKeySchema })
  .strict()
  .refine((value) => value.to >= value.from, { message: "to must not be before from", path: ["to"] })
  .refine(
    (value) => (Date.parse(`${value.to}T00:00:00Z`) - Date.parse(`${value.from}T00:00:00Z`)) / 86_400_000 <= PMCM_CALENDAR_MAX_DAYS,
    { message: `The calendar window is at most ${PMCM_CALENDAR_MAX_DAYS} days`, path: ["to"] },
  );
export type PmcmCalendarQuery = z.infer<typeof pmcmCalendarQuerySchema>;
