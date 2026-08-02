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
  [key: string]: CardInstance | CardInstance[] | number | null | undefined
}

export interface ComboStep {
  a?: string
  t?: number
  i?: number
  instanceId?: number
  f?: string
  from?: string
  to?: string
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
  recording: boolean
  playbackVisualizing: boolean
  combo: ComboStep[]
  playbackIndex: number
  maxPlaybackIndex: number
  initBoard: (mainIds: number[], extraIds: number[], cardDataMap: Record<number, CardData | undefined>) => void
  draw: (count?: number) => void
  shuffleDeck: () => void
  sortDeck: () => void
  moveCard: (instanceId: number, fromZone: string, toZone: string, position?: string) => void
  changePosition: (zone: string, newPosition: string) => void
  setLP: (lp: number) => void
  sendToGY: (instanceId: number, fromZone: string) => void
  sendToBanish: (instanceId: number, fromZone: string) => void
  addToHand: (instanceId: number, fromZone: string) => void
  returnToDeck: (instanceId: number, fromZone: string, toTop?: boolean) => void
  millCards: (count?: number) => void
  generateToken: (targetZone?: string) => void
  removeToken: (instanceId: number, zone: string) => void
  activateEffect: (instanceId: number, zone: string) => void
  activateSkill: () => void
  resetBoard: () => void
  resetCombo: () => void
  startRecording: () => void
  stopRecording: () => void
  jumpToStep: (index: number) => void
  setPlaybackVisualizing: (value: boolean) => void
  setCombo: (value: ComboStep[]) => void
  setHistory: (value: BoardState[]) => void
  setHistoryIndex: (value: number) => void
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
