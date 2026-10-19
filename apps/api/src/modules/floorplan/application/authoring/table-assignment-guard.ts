import { BadRequestException } from '@nestjs/common';
import {
  findTableAssignmentRejection,
  floorPlanCanvasObjectSchema,
  type TableAssignmentIneligibleReason,
  type TableEligibilityGuest,
  type TableEligibilityObject,
} from '@prism/types';

const REJECTION_MESSAGES: Record<TableAssignmentIneligibleReason, string> = {
  'unknown-guest': 'Only guests on this event guest list can be seated.',
  'guest-declined': 'Guests who declined cannot be seated.',
  'not-a-table': 'Guests can only be seated at visible seating tables.',
  'table-hidden': 'Hidden tables cannot take guests.',
  'table-full': 'This table has no free seats.',
  'guest-already-seated': 'A guest can only be seated at one table.',
};

/** Rejects a plan save whose seat assignments break the shared table eligibility rule. */
export function assertTableAssignmentsEligible(
  objects: readonly TableEligibilityObject[],
  guests: readonly TableEligibilityGuest[],
) {
  const rejection = findTableAssignmentRejection(objects, guests);
  if (rejection) throw new BadRequestException(REJECTION_MESSAGES[rejection.reason]);
}

/**
 * Reads stored plan objects for the seat check. Entries that are not editor-shaped carry no seat
 * assignments the editor could have written, so they are skipped.
 */
export function storedTableEligibilityObjects(values: readonly unknown[]): TableEligibilityObject[] {
  return values.flatMap((value) => {
    const parsed = floorPlanCanvasObjectSchema.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  });
}

/** Reads stored guest roster entries for the seat check, keeping only the fields the rule uses. */
export function storedTableEligibilityGuests(values: readonly unknown[]): TableEligibilityGuest[] {
  return values.flatMap((value) => {
    if (!isRecord(value) || typeof value.id !== 'string') return [];
    return [{ id: value.id, rsvp: typeof value.rsvp === 'string' ? value.rsvp : undefined }];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
