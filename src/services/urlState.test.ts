import { describe, expect, it } from 'vitest'
import { decodeState, encodeState, readShortComboSlug, validatePublishableState, MAX_COMBO_STEPS } from './urlState'

const state = { main: [1, 2], extra: [3], combo: [{ a: 'draw', n: 1 }], name: 'Test combo' }

describe('shared combo URL state', () => {
  it('round-trips legacy self-contained links', () => {
    expect(decodeState(encodeState(state))).toMatchObject(state)
  })

  it('recognizes only compact Base62 combo slugs', () => {
    expect(readShortComboSlug('#/c/A1b2C3d4E5f6')).toBe('A1b2C3d4E5f6')
    expect(readShortComboSlug('#/c/not-a-valid-slug')).toBeNull()
    expect(readShortComboSlug('#/sim?d=anything')).toBeNull()
  })

  it('rejects payloads that exceed publishing limits', () => {
    expect(validatePublishableState({ ...state, combo: Array.from({ length: MAX_COMBO_STEPS + 1 }, () => ({ a: 'draw' })) })).toContain('limited')
    expect(validatePublishableState({ ...state, main: [0] })).toContain('invalid card ID')
    expect(validatePublishableState(state)).toBeNull()
  })
})
