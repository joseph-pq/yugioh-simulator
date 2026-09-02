import type { BoardState, CardData, CardInstance, ComboStep } from '../types'
import type { TokenInitInfo } from '../services/urlState'
import { addTokenToBoard, changeCardPosition, drawCards, moveCardOnBoard, removeTokenFromBoard, returnAllCardsToDecks, sortDeck } from './transitions'
import { cloneBoard, createEmptyBoard, isArrayZone, isToken, POSITION, TOKEN_CARD } from './board'

export interface InitialStateInfo {
  init?: Record<string, number[]>
  tokens?: TokenInitInfo[]
}

const INITIAL_CHECK_ZONES = [
  'hand', 'gy', 'egy', 'banish', 'ebanish', 'free', 'efree',
  'm1', 'm2', 'm3', 'em1', 'em2', 'em3', 'st1', 'st2', 'st3',
  'est1', 'est2', 'est3', 'field', 'efield',
]

/** Extract the non-deck setup needed to start replaying a shared combo. */
export function extractInitialStateInfo(board?: BoardState): InitialStateInfo {
  if (!board) return {}
  const init: Record<string, number[]> = {}
  const tokens: TokenInitInfo[] = []

  INITIAL_CHECK_ZONES.forEach(zone => {
    const value = board[zone]
    const cards = Array.isArray(value) ? value : value ? [value as CardInstance] : []
    cards.forEach(card => {
      if (isToken(card)) {
        tokens.push({ z: zone, i: card.id, p: card.position || undefined })
      } else {
        ;(init[zone] ||= []).push(card.id)
      }
    })
  })

  return {
    init: Object.keys(init).length > 0 ? init : undefined,
    tokens: tokens.length > 0 ? tokens : undefined,
  }
}

/** Build a predictable starting board. Instance IDs are stable across shared URLs. */
export function createInitialBoard(
  main: number[],
  extra: number[],
  cards: Record<number, CardData | undefined>,
  initial?: InitialStateInfo,
): BoardState {
  const board = createEmptyBoard()
  let nextId = 1
  board.deck = main.map(cardId => ({ id: nextId++, cardId, data: cards[cardId] }))
  board.extra = extra.map(cardId => ({ id: nextId++, cardId, data: cards[cardId] }))

  Object.entries(initial?.init || {}).forEach(([zone, instanceIds]) => {
    instanceIds.forEach(instanceId => {
      const source = board.deck.find(card => card.id === instanceId) || board.extra.find(card => card.id === instanceId)
      if (!source) return
      board.deck = board.deck.filter(card => card !== source)
      board.extra = board.extra.filter(card => card !== source)
      if (isArrayZone(zone)) board[zone].push(source)
      else (board as Record<string, CardInstance | null>)[zone] = source
    })
  })

  initial?.tokens?.forEach(token => {
    addTokenToBoard(board, { id: token.i, cardId: TOKEN_CARD.id, data: TOKEN_CARD }, token.z, token.p || POSITION.FACE_UP_ATK)
  })
  return board
}

/** Replay one recorded step. Visual-only actions intentionally leave the board unchanged. */
export function applyReplayStep(board: BoardState, step: ComboStep, cards: Record<number, CardData | undefined> = {}): BoardState {
  const next = cloneBoard(board)
  const instanceId = (step.instanceId || step.i) as number | undefined
  const from = (step.from || step.f) as string | undefined
  const to = step.to as string | undefined
  const zone = (to || step.z || step.zone || from) as string | undefined
  const position = (step.position || step.p) as string | undefined
  const value = (step.val ?? step.v) as number | undefined

  switch (step.a) {
    case 'move':
      if (instanceId && from && to) moveCardOnBoard(next, instanceId, from, to, position)
      break
    case 'draw':
      drawCards(next, (step.n as number) || value || 1)
      break
    case 'shuffle':
      for (let index = next.deck.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1))
        ;[next.deck[index], next.deck[randomIndex]] = [next.deck[randomIndex], next.deck[index]]
      }
      break
    case 'sort':
      sortDeck(next, cards)
      break
    case 'reset_board':
      returnAllCardsToDecks(next, cards)
      break
    case 'pos':
      if (zone && position) changeCardPosition(next, zone, position, instanceId)
      break
    case 'lp':
      if (value !== undefined) next.lp = Math.max(0, value)
      break
    case 'token':
      if (zone) addTokenToBoard(next, { id: instanceId || 0, cardId: TOKEN_CARD.id, data: TOKEN_CARD }, zone, position)
      break
    case 'removetoken':
      if (zone && instanceId) removeTokenFromBoard(next, instanceId, zone)
      break
    case 'phase':
      if (step.phase) next.phase = step.phase as BoardState['phase']
      if (step.turn) next.turn = step.turn as BoardState['turn']
      break
  }
  return next
}

export function replayCombo(initialBoard: BoardState, combo: ComboStep[], cards: Record<number, CardData | undefined> = {}): BoardState[] {
  return combo.reduce<BoardState[]>((history, step) => [...history, applyReplayStep(history[history.length - 1] || initialBoard, step, cards)], [cloneBoard(initialBoard)])
}
