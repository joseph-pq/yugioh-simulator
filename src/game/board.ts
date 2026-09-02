import type { BoardState, CardData, CardInstance } from '../types'
import { ZONES } from '../types'

/** Zone groups are kept here so game rules, replay, and the board agree. */
export const MONSTER_ZONES = [ZONES.M1, ZONES.M2, ZONES.M3, ZONES.EMZ1, ZONES.EMZ2]
export const SPELL_ZONES = [ZONES.ST1, ZONES.ST2, ZONES.ST3]
export const BOARD_ZONES = [...MONSTER_ZONES, ...SPELL_ZONES, ZONES.FIELD, ZONES.EXTRA_PILE]

export const ARRAY_ZONES = [
  ZONES.HAND, ZONES.GY, ZONES.EGY, ZONES.BANISH, ZONES.EBANISH,
  ZONES.DECK, ZONES.EXTRA, ZONES.EEXTRA, ZONES.FREE, ZONES.EFREE,
] as const

export const SINGLE_ZONES = [
  ZONES.M1, ZONES.M2, ZONES.M3, ZONES.EM1, ZONES.EM2, ZONES.EM3,
  ZONES.ST1, ZONES.ST2, ZONES.ST3, ZONES.EST1, ZONES.EST2, ZONES.EST3,
  ZONES.FIELD, ZONES.EFIELD, ZONES.EMZ1, ZONES.EMZ2,
  ZONES.EXTRA_PILE, ZONES.EEXTRA_PILE,
] as const

export const POSITION = {
  FACE_UP_ATK: 'fua',
  FACE_UP_DEF: 'fud',
  FACE_DOWN_DEF: 'fdd',
  FACE_DOWN: 'fd',
  FACE_UP: 'fu',
} as const

export const TOKEN_CARD: CardData = {
  id: 99999999,
  name: 'Monster Token',
  type: 'Token',
  humanType: 'Token Monster',
  frameType: 'token',
  race: 'Cyberse',
  attribute: 'LIGHT',
  atk: 0,
  def: 0,
  level: 1,
  desc: 'This card can be used as any Monster Token.',
}

let nextInstanceId = 1

export function resetInstanceIds() {
  nextInstanceId = 1
}

export function makeInstance(cardId: number, data: CardData | null | undefined): CardInstance {
  return { id: nextInstanceId++, cardId, data }
}

export function createEmptyBoard(): BoardState {
  return {
    hand: [], m1: null, m2: null, m3: null,
    est1: null, est2: null, est3: null, em1: null, em2: null, em3: null,
    st1: null, st2: null, st3: null, field: null, efield: null,
    gy: [], egy: [], ebanish: [], banish: [], deck: [], extra: [], eextra: [],
    free: [], efree: [], emz1: null, emz2: null, extra_pile: null,
    eextra_pile: null, lp: 4000, turn: 'player', phase: 'dp',
  }
}

export function cloneBoard(board: BoardState): BoardState {
  return structuredClone(board)
}

export function isArrayZone(zone: string): zone is typeof ARRAY_ZONES[number] {
  return (ARRAY_ZONES as readonly string[]).includes(zone)
}

export function isToken(card: CardInstance): boolean {
  return card.cardId === TOKEN_CARD.id || card.data?.frameType?.toLowerCase().includes('token') === true
}

export function isExtraDeckCard(card: CardInstance): boolean {
  const frame = (card.data?.frameType ?? '').toLowerCase()
  return ['fusion', 'synchro', 'xyz', 'link'].some(keyword => frame.includes(keyword))
}
