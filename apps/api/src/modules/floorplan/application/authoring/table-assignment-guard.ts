import { BadRequestException } from '@nestjs/common';
import { tableAssignmentsOf } from '@prism/floorplan-scene';
import {
  type FloorplanSceneDocument,
  SEATING_LIST_MAX_GUESTS,
  findTableAssignmentRejection,
  newTableAssignments,
  seatingUnavailableReason,
  type SeatingEvent,
  type TableAssignmentIneligibleReason,
  type TableEligibilityObject,
} from '@prism/types';

const REJECTION_MESSAGES: Record<TableAssignmentIneligibleReason, string> = {
  'unknown-guest': 'Only guests on this event guest list can be seated.',
  'guest-declined': 'Guests who declined cannot be seated.',
  'not-a-table': 'Guests can only be seated at visible seating tables.',
  'table-hidden': 'Hidden tables cannot take guests.',
  'table-full': 'This table has no free seats.',
  'guest-already-seated': 'A guest can only be seated at one table.',
  'event-too-large': `Table assignment is only available for events under ${SEATING_LIST_MAX_GUESTS} guests.`,
  'event-public': 'Table assignment is only available for private events.',
};

/** Rejects a plan save whose seat assignments break the shared table eligibility rule. */
export function assertTableAssignmentsEligible(
  objects: readonly TableEligibilityObject[],
  guests: readonly { id: string; rsvp?: string }[],
) {
  const rejection = findTableAssignmentRejection(objects, guests);
  if (rejection) throw new BadRequestException(REJECTION_MESSAGES[rejection.reason]);
}

/** Refuses new seat assignments on a plan for a public or large event; seats made before the rule applied are left alone. */
export function assertSeatingAllowedForNewAssignments(
  previousObjects: readonly TableEligibilityObject[],
  nextObjects: readonly TableEligibilityObject[],
  event: SeatingEvent,
) {
  const unavailable = seatingUnavailableReason(event.pax, event.eventPrivacy);
  if (!unavailable) return;
  if (newTableAssignments(previousObjects, nextObjects).length > 0) throw new BadRequestException(REJECTION_MESSAGES[unavailable]);
}

/** A scene's tables in the shape the seating rule reads. */
export function sceneTableEligibilityObjects(scene: FloorplanSceneDocument): TableEligibilityObject[] {
  return tableAssignmentsOf(scene).map((table) => ({
    id: table.tableId,
    kind: 'ellipse',
    category: 'furniture',
    seats: table.seats,
    hidden: table.hidden,
    assignedGuestIds: table.guestIds,
  }));
}
