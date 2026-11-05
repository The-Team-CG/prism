import { z } from "zod";

export const COORDINATOR_ROLES = [
  "General Coordinator",
  "Event Day System Operator",
  "Registration Staff",
  "Floor Director",
  "Stage Director",
  "Ingress and Egress Assistant",
  "Usher",
] as const;

export const coordinatorRoleSchema = z.enum(COORDINATOR_ROLES);
export type CoordinatorRole = z.infer<typeof coordinatorRoleSchema>;

export function normalizeCoordinatorRole(value: string) {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function canonicalCoordinatorRole(value?: string | null): CoordinatorRole | undefined {
  if (!value) return undefined;
  const normalized = normalizeCoordinatorRole(value);
  return COORDINATOR_ROLES.find((role) => normalizeCoordinatorRole(role) === normalized);
}

/** A coordinator who withdraws this close to the event day creates an Emergency Change (catalog FR-89). */
export const COORDINATOR_EMERGENCY_WINDOW_HOURS = 48;

/**
 * Whether a withdrawal happened inside the emergency window around the event day. Event dates are whole UTC days;
 * the window runs from 48 hours before the start of that day until the day ends, so a withdrawal on the day itself
 * counts but a later clean-up does not. Anything not withdrawn, or missing either date, is not an emergency.
 */
export function isEmergencyCoordinatorWithdrawal(input: {
  status?: string | null;
  withdrawnAt?: string | Date | null;
  eventDate?: string | Date | null;
}): boolean {
  if (input.status !== "cancelled" || !input.withdrawnAt || !input.eventDate) return false;
  const withdrawn = new Date(input.withdrawnAt).getTime();
  const eventStart = new Date(input.eventDate).getTime();
  if (Number.isNaN(withdrawn) || Number.isNaN(eventStart)) return false;
  const hour = 60 * 60 * 1000;
  return withdrawn >= eventStart - COORDINATOR_EMERGENCY_WINDOW_HOURS * hour && withdrawn < eventStart + 24 * hour;
}
