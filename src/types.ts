import type { RefObject } from 'react'

export interface CardData {
  id: number
  name: string
  type?: string
  humanType?: string
  frameType?: string
  desc?: string
  race?: string | null
  atk?: number | null
  def?: number | null
  level?: number | null
  attribute?: string | null
  archetype?: string | null
  [key: string]: unknown
}

export interface CardInstance {
  id: number
  cardId: number
  data?: CardData | null
  position?: string | null
}

export type TurnOwner = 'player' | 'opponent'
export type Phase = 'dp' | 'sp' | 'mp1' | 'bp' | 'ep'

export interface BoardState {
  hand: CardInstance[]
  m1: CardInstance | null
  m2: CardInstance | null
  m3: CardInstance | null
  est1: CardInstance | null
  est2: CardInstance | null
  est3: CardInstance | null
  em1: CardInstance | null
  em2: CardInstance | null
  em3: CardInstance | null
  st1: CardInstance | null
  st2: CardInstance | null
  st3: CardInstance | null
  field: CardInstance | null
  efield: CardInstance | null
  gy: CardInstance[]
  egy: CardInstance[]
  ebanish: CardInstance[]
  banish: CardInstance[]
  deck: CardInstance[]
  extra: CardInstance[]
  eextra: CardInstance[]
  free: CardInstance[]
  efree: CardInstance[]
  emz1: CardInstance | null
  emz2: CardInstance | null
  extra_pile: CardInstance | null
  eextra_pile: CardInstance | null
  lp: number
  turn?: TurnOwner
  phase?: Phase
  [key: string]: CardInstance | CardInstance[] | number | string | null | undefined
}
export const ZONES = {
  HAND: 'hand',
  M1: 'm1', M2: 'm2', M3: 'm3',
  EST1: 'est1', EST2: 'est2', EST3: 'est3',
  EM1: 'em1', EM2: 'em2', EM3: 'em3',
  ST1: 'st1', ST2: 'st2', ST3: 'st3',
  FIELD: 'field',
  EFIELD: 'efield',
  GY: 'gy',
  EGY: 'egy',
  BANISH: 'banish',
  EBANISH: 'ebanish',
  DECK: 'deck',
  EXTRA: 'extra',
  EEXTRA: 'eextra',
  FREE: 'free',
  EFREE: 'efree',
  EMZ1: 'emz1',
  EMZ2: 'emz2',
  EXTRA_PILE: 'extra_pile',
  EEXTRA_PILE: 'eextra_pile',
} as const

export type Zone = typeof ZONES[keyof typeof ZONES]

export interface ComboStep {
  a?: string
  t?: number
  i?: number
  instanceId?: number
  f?: Zone
  from?: Zone
  to?: Zone
  z?: string
  n?: number
  v?: number
  top?: boolean
  cardId?: number
  card?: CardData
  [key: string]: unknown
}

export interface DeckValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface DeckState {
  main: number[]
  extra: number[]
  side?: number[]
}

export interface CardFilter {
  type?: string
  frameType?: string
  attribute?: string
  race?: string
  archetype?: string
  level?: number | null
}

export interface GameContextValue {
  board: BoardState
  history: BoardState[]
  recording: boolean
  playbackVisualizing: boolean
  playbackSpeed: number
  setPlaybackSpeed: (speed: number) => void
  combo: ComboStep[]
  playbackIndex: number
  maxPlaybackIndex: number
  initBoard: (mainIds: number[], extraIds: number[], cardDataMap: Record<number, CardData | undefined>) => void
  loadState: (combo: ComboStep[], history: BoardState[], index?: number) => void
  draw: (count?: number) => void
  shuffleDeck: () => void
  sortDeck: () => void
  moveCard: (instanceId: number, fromZone: string, toZone: string, position?: string) => void
  changePosition: (zone: string, newPosition: string) => void
  setLP: (lp: number) => void
  generateToken: (targetZone?: string) => void
  removeToken: (instanceId: number, zone: string) => void
  activateEffect: (instanceId: number, zone: string) => void
  activateSkill: () => void
  advancePhase: () => void
  resetBoard: () => void
  resetCombo: () => void
  startRecording: () => void
  stopRecording: () => void
  jumpToStep: (index: number) => void
  setPlaybackVisualizing: (value: boolean) => void
  setCombo: (value: ComboStep[]) => void
  setHistory: (value: BoardState[]) => void
  setHistoryIndex: (value: number) => void
  returnAllToDecks: () => void
  initialMainIds: RefObject<number[]>
  initialExtraIds: RefObject<number[]>
}

export interface DeckContextValue {
  deckName: string
  setDeckName: (value: string) => void
  mainDeck: number[]
  extraDeck: number[]
  validation: DeckValidationResult
  addCard: (card: CardData) => boolean
  removeFromMainDeck: (index: number) => void
  removeFromExtraDeck: (index: number) => void
  importDeck: (parsed: { main?: number[]; extra?: number[] }) => void
  clearDeck: () => void
  getCardCount: (cardId: number) => number
}

export interface CacheContextValue {
  cacheStatus: string
  progress: { fetched: number; total: number }
  totalCards: number
  error: string | null
  searchCards: (query: string, filters: CardFilter, limit?: number) => Promise<CardData[]>
  getCard: (id: number) => Promise<CardData | undefined>
  getCards: (ids: number[]) => Promise<CardData[]>
  fetchAndCacheCards: (ids: number[]) => Promise<CardData[]>
}
