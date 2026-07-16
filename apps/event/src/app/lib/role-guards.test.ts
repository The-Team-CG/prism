import { describe, expect, it } from 'vitest'
import { isPmcmAdmin } from './role-guards'

describe('isPmcmAdmin', () => {
  it('returns true for pmcm-admin', () => {
    expect(isPmcmAdmin('pmcm-admin')).toBe(true)
  })

  it('returns false for client', () => {
    expect(isPmcmAdmin('client')).toBe(false)
  })

  it('returns false for supplier', () => {
    expect(isPmcmAdmin('supplier')).toBe(false)
  })

  it('returns false for coordinator', () => {
    expect(isPmcmAdmin('coordinator')).toBe(false)
  })
})
