import type { CardData } from '../types'

export type CardTypeCategory = 'monster' | 'spell' | 'trap' | 'unknown'
export type CardPositionCategory = 'monster' | 'spell-trap' | 'unknown'

/**
 * YGOPRO provides descriptive type strings (for example, "Effect Monster")
 * rather than a single card-family field. Keep keyword matching centralized
 * wherever the simulator needs to reason about the card's broad category.
 */
export function getCardTypeCategory(card: Pick<CardData, 'type'> | null | undefined): CardTypeCategory {
  const type = card?.type?.toLowerCase()

  if (!type) return 'unknown'
  if (type.includes('spell')) return 'spell'
  if (type.includes('trap')) return 'trap'
  if (type.includes('monster')) return 'monster'
  return 'unknown'
}

export function isSpellOrTrap(card: Pick<CardData, 'type'> | null | undefined): boolean {
  const category = getCardTypeCategory(card)
  return category === 'spell' || category === 'trap'
}

export function getCardPositionCategory(card: Pick<CardData, 'type'> | null | undefined): CardPositionCategory {
  if (isSpellOrTrap(card)) return 'spell-trap'
  return getCardTypeCategory(card) === 'monster' ? 'monster' : 'unknown'
}
