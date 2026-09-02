import { describe, expect, it } from 'vitest'
import { parseYDK, validateDuelLinksDeck } from './ydkParser'

describe('YDK parsing and Duel Links validation', () => {
  it('reads main, extra, and side sections while ignoring comments', () => {
    const deck = parseYDK('#created by test\n#main\n123\n456\n#extra\n789\n!side\n101')
    expect(deck).toEqual({ main: [123, 456], extra: [789], side: [101] })
  })

  it('rejects decks below the main-deck minimum and fourth copies', () => {
    const result = validateDuelLinksDeck({ main: [1, 1, 1, 1], extra: [] })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Main deck has 4 cards (minimum 20)')
    expect(result.errors).toContain('Card 1 appears 4 times (maximum 3)')
  })
})
