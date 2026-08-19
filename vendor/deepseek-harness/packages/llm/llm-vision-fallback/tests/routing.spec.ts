/**
 * Route-selection policy of the vision fallback: which designated routes a
 * describe call tries, in what order, and when a failure moves to the next
 * one. Pure value-level coverage; the streaming service wraps these without
 * further policy of its own.
 */

import { describe, expect, it } from 'vitest'
import { shouldFailOver, visionRoutes } from '../src/routing.ts'

const primary = { provider: 'codingplan', model: 'doubao-lite' }
const backup = { provider: 'codingplan', model: 'doubao-turbo' }

describe('visionRoutes', () => {
  it('returns nothing while no route is designated', () => {
    expect(visionRoutes({})).toEqual([])
  })

  it('auto tries the primary and then the backup', () => {
    expect(visionRoutes({ primary, backup })).toEqual([primary, backup])
  })

  it('auto with only a primary serves that route alone', () => {
    expect(visionRoutes({ primary })).toEqual([primary])
  })

  it('auto with only a backup still serves it, so an unset primary is not an outage', () => {
    expect(visionRoutes({ backup })).toEqual([backup])
  })

  it('auto deduplicates a backup identical to the primary', () => {
    expect(visionRoutes({ primary, backup: primary })).toEqual([primary])
    expect(visionRoutes({ primary, backup: { ...primary } })).toEqual([primary])
  })

  it('an absent mode behaves as auto', () => {
    expect(visionRoutes({ primary, backup })).toEqual([primary, backup])
  })

  it('primary policy pins the primary and ignores the backup', () => {
    expect(visionRoutes({ primary, backup, mode: 'primary' })).toEqual([primary])
    expect(visionRoutes({ backup, mode: 'primary' })).toEqual([])
  })

  it('backup policy pins the backup and ignores the primary', () => {
    expect(visionRoutes({ primary, backup, mode: 'backup' })).toEqual([backup])
    expect(visionRoutes({ primary, mode: 'backup' })).toEqual([])
  })
})

describe('shouldFailOver', () => {
  it('moves on from any failure while the main request still wants the description', () => {
    const signal = new AbortController().signal
    expect(shouldFailOver(new Error('VISION_DESCRIBE_TIMEOUT'), signal)).toBe(true)
    expect(shouldFailOver(new Error('rate limited'), signal)).toBe(true)
    expect(shouldFailOver(new Error('no description text'), signal)).toBe(true)
  })

  it('stops when the user cancelled the main request', () => {
    const controller = new AbortController()
    controller.abort()
    expect(shouldFailOver(new Error('anything'), controller.signal)).toBe(false)
  })
})
