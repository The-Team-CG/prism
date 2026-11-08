import { z } from "zod";
import { prismEventDayStart } from "../coordinator-focus.js";

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

/** PMCM's per-role brief for one event: call time, attire, script and role instructions (New-CO2). */
export const upsertCoordinatorRoleBriefSchema = z.object({
  callTime: z.string().datetime({ offset: true }).nullable(),
  attire: z.string().trim().max(500),
  script: z.string().trim().max(8000),
  instructions: z.string().trim().max(4000),
});
export type UpsertCoordinatorRoleBriefInput = z.infer<typeof upsertCoordinatorRoleBriefSchema>;

export interface PrismCoordinatorRoleBrief {
  eventId: string;
  role: CoordinatorRole;
  callTime: string | null;
  attire: string;
  script: string;
  instructions: string;
  updatedAt: string;
  updatedBy: string;
}
export type CoordinatorRole = z.infer<typeof coordinatorRoleSchema>;

export function normalizeCoordinatorRole(value: string) {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function canonicalCoordinatorRole(value?: string | null): CoordinatorRole | undefined {
  if (!value) return undefined;
  const normalized = normalizeCoordinatorRole(value);
  return COORDINATOR_ROLES.find((role) => normalizeCoordinatorRole(role) === normalized);
}

/**
 * Registration and usher roles work the guest desk. They see guest check-in detail and the guest operations block on
 * the event-day run sheet. Matches any role label that names registration or an usher, so custom labels still count.
 */
export function isGuestDeskRole(role?: string | null): boolean {
  const value = role?.toLowerCase() ?? "";
  return value.includes("registration") || value.includes("usher");
}

/** A coordinator who withdraws this close to the event day creates an Emergency Change (catalog FR-89). */
export const COORDINATOR_EMERGENCY_WINDOW_HOURS = 48;

/**
 * Whether a withdrawal happened inside the emergency window around the event day. The window runs from 48 hours
 * before the event day begins in Philippine time until that day ends, so a withdrawal on the day itself counts but a
 * later clean-up does not. Anything not withdrawn, or missing either date, is not an emergency.
 */
export function isEmergencyCoordinatorWithdrawal(input: {
  status?: string | null;
  withdrawnAt?: string | Date | null;
  eventDate?: string | Date | null;
}): boolean {
  if (input.status !== "cancelled" || !input.withdrawnAt || !input.eventDate) return false;
  const withdrawn = new Date(input.withdrawnAt).getTime();
  const eventStart = prismEventDayStart(input.eventDate).getTime();
  if (Number.isNaN(withdrawn) || Number.isNaN(eventStart)) return false;
  const hour = 60 * 60 * 1000;
  return withdrawn >= eventStart - COORDINATOR_EMERGENCY_WINDOW_HOURS * hour && withdrawn < eventStart + 24 * hour;
}
