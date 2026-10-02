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
