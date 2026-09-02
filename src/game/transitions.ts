import type { BoardState, CardData, CardInstance, Phase, TurnOwner } from '../types'
import { getCardTypeCategory } from '../utils/cardType'
import { ARRAY_ZONES, isArrayZone, isExtraDeckCard, isToken, POSITION, SINGLE_ZONES, TOKEN_CARD } from './board'

/** Pure board transitions. The provider owns history; this module owns rules. */
export function drawCards(board: BoardState, count: number): BoardState {
  const n = Math.min(count, board.deck.length)
  board.hand.push(...board.deck.splice(0, n))
  return board
}

export function moveCardOnBoard(board: BoardState, instanceId: number, fromZone: string, toZone: string, position?: string): BoardState {
  let card: CardInstance | null = null
  if (isArrayZone(fromZone)) {
    const index = board[fromZone].findIndex(item => item.id === instanceId)
    if (index !== -1) card = board[fromZone].splice(index, 1)[0]
  } else {
    const source = board[fromZone] as CardInstance | null
    if (source?.id === instanceId) {
      card = source
      ;(board as Record<string, CardInstance | null>)[fromZone] = null
    }
  }

  if (!card) return board
  if (isArrayZone(toZone)) {
    board[toZone].push(card)
  } else {
    const destination = board[toZone] as CardInstance | null
    if (destination) board.hand.push(destination)
    ;(board as Record<string, CardInstance | null>)[toZone] = { ...card, position: position || POSITION.FACE_UP_ATK }
  }
  return board
}

export function changeCardPosition(board: BoardState, zone: string, position: string, instanceId?: number): BoardState {
  if (isArrayZone(zone)) {
    const card = instanceId ? board[zone].find(item => item.id === instanceId) : board[zone][board[zone].length - 1]
    if (card) card.position = position
  } else {
    const card = board[zone] as CardInstance | null
    if (card) card.position = position
  }
  return board
}

export function removeTokenFromBoard(board: BoardState, instanceId: number, zone: string): BoardState {
  if (isArrayZone(zone)) {
    const index = board[zone].findIndex(card => card.id === instanceId)
    const tokenIndex = index === -1 ? board[zone].findIndex(isToken) : index
    if (tokenIndex !== -1) board[zone].splice(tokenIndex, 1)
  } else {
    const card = board[zone] as CardInstance | null
    if (card && (card.id === instanceId || isToken(card))) {
      ;(board as Record<string, CardInstance | null>)[zone] = null
    }
  }
  return board
}

export function addTokenToBoard(board: BoardState, token: CardInstance, zone: string, position: string = POSITION.FACE_UP_ATK): BoardState {
  if (isArrayZone(zone)) {
    board[zone].push(token)
  } else if (board[zone] === null) {
    ;(board as Record<string, CardInstance | null>)[zone] = { ...token, position }
  } else {
    board.hand.push(token)
  }
  return board
}

export function advancePhase(board: BoardState): { phase: Phase; turn: TurnOwner } {
  const phases: Phase[] = ['dp', 'sp', 'mp1', 'bp', 'ep']
  const currentIndex = phases.indexOf(board.phase || 'dp')
  const isEndOfTurn = currentIndex === -1 || currentIndex === phases.length - 1
  return {
    phase: isEndOfTurn ? 'dp' : phases[currentIndex + 1],
    turn: isEndOfTurn ? (board.turn === 'player' ? 'opponent' : 'player') : (board.turn || 'player'),
  }
}

function sortValue(card: CardData | undefined): number {
  switch (getCardTypeCategory(card)) {
    case 'monster': return 1
    case 'spell': return 2
    case 'trap': return 3
    default: return 99
  }
}

export function sortDeck(board: BoardState, cards: Record<number, CardData | undefined>): BoardState {
  board.deck.sort((a, b) => {
    const cardA = cards[a.cardId]
    const cardB = cards[b.cardId]
    if (!cardA || !cardB) return 0
    return sortValue(cardA) - sortValue(cardB) || cardA.name.localeCompare(cardB.name)
  })
  return board
}

export function returnAllCardsToDecks(board: BoardState, cards: Record<number, CardData | undefined>): BoardState {
  const main: CardInstance[] = []
  const extra: CardInstance[] = []
  const collect = (card: CardInstance) => {
    if (isToken(card)) return
    ;(isExtraDeckCard(card) ? extra : main).push(card)
  }

  ARRAY_ZONES.forEach(zone => {
    board[zone].forEach(collect)
    board[zone] = []
  })
  SINGLE_ZONES.forEach(zone => {
    const card = board[zone]
    if (card) collect(card)
    board[zone] = null
  })
  board.deck = main
  board.extra = extra
  sortDeck(board, cards)
  board.extra.sort((a, b) => cards[a.cardId]?.name.localeCompare(cards[b.cardId]?.name || '') || 0)
  return board
}

export { TOKEN_CARD }
