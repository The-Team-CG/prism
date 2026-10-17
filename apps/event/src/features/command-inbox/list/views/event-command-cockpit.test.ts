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

  it('shows the games workspace to pmcm-admin', () => {
    const tabs = buildEventWorkflowTabs({ ...BASE_PARAMS, role: 'pmcm-admin' })
    expect(tabs.map((tab) => String(tab.id))).toContain('games')
  })

  it('shows the games workspace to coordinators and hides it from client and supplier shells', () => {
    const coordinatorTabs = buildEventWorkflowTabs({ ...BASE_PARAMS, role: 'coordinator' })
    expect(coordinatorTabs.map((tab) => String(tab.id))).toContain('games')

    for (const role of ['client', 'supplier'] as const) {
      const tabs = buildEventWorkflowTabs({ ...BASE_PARAMS, role })
      expect(tabs.map((tab) => String(tab.id))).not.toContain('games')
    }
  })
})
