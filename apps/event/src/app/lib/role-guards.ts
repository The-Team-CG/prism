import type { PrismUserRole } from "@prism/types";

export function isPmcmAdmin(role: PrismUserRole): boolean {
  return role === 'pmcm-admin'
}
