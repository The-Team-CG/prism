import { describe, expect, it } from 'vitest'
import { buildEventWorkflowTabs } from './event-command-cockpit'

const BASE_PARAMS = {
  draftsCount: 1,
  quotesCount: 0,
  assignmentsCount: 0,
  paymentsCount: 0,
  openChecksCount: 0,
}

describe('buildEventWorkflowTabs — floorplans tab visibility', () => {
  it('includes floorplans tab for pmcm-admin', () => {
    const tabs = buildEventWorkflowTabs({ ...BASE_PARAMS, role: 'pmcm-admin' })
    expect(tabs.some((t) => t.id === 'floorplans')).toBe(true)
  })

  it('omits floorplans tab for client', () => {
    const tabs = buildEventWorkflowTabs({ ...BASE_PARAMS, role: 'client' })
    expect(tabs.some((t) => t.id === 'floorplans')).toBe(false)
  })

  it('omits floorplans tab for supplier', () => {
    const tabs = buildEventWorkflowTabs({ ...BASE_PARAMS, role: 'supplier' })
    expect(tabs.some((t) => t.id === 'floorplans')).toBe(false)
  })
})
