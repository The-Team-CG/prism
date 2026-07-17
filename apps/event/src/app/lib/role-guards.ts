import type { SampleRole } from "@prism/types";

export function isPmcmAdmin(role: SampleRole): boolean {
  return role === 'pmcm-admin'
}
