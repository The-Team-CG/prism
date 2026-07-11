import type { SampleRole } from '@/lib/prism-api'

export function isPmcmAdmin(role: SampleRole): boolean {
  return role === 'pmcm-admin'
}
