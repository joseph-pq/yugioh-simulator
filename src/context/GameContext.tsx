import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react'
import type { BoardState, CardData, CardInstance, ComboStep, GameContextValue } from '../types'

const GameContext = createContext<GameContextValue | null>(null)

const getOrderValue = (card: CardData | null | undefined): number => {
  if (!card || !card.type) return 0
  const type = card.type.toLowerCase()
  if (type.includes('spell')) return 2
  if (type.includes('trap')) return 3
  return 1
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
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

export const MONSTER_ZONES = [ZONES.M1, ZONES.M2, ZONES.M3, ZONES.EMZ1, ZONES.EMZ2]
export const SPELL_ZONES = [ZONES.ST1, ZONES.ST2, ZONES.ST3]
export const BOARD_ZONES = [...MONSTER_ZONES, ...SPELL_ZONES, ZONES.FIELD, ZONES.EXTRA_PILE]

const ARRAY_ZONES = [
  ZONES.HAND,
  ZONES.GY,
  ZONES.EGY,
  ZONES.BANISH,
  ZONES.EBANISH,
  ZONES.DECK,
  ZONES.EXTRA,
  ZONES.EEXTRA,
  ZONES.FREE,
  ZONES.EFREE,
] as const

const SINGLE_ZONES = [
  ZONES.M1,
  ZONES.M2,
  ZONES.M3,
  ZONES.EM1,
  ZONES.EM2,
  ZONES.EM3,
  ZONES.ST1,
  ZONES.ST2,
  ZONES.ST3,
  ZONES.EST1,
  ZONES.EST2,
  ZONES.EST3,
  ZONES.FIELD,
  ZONES.EFIELD,
  ZONES.EMZ1,
  ZONES.EMZ2,
  ZONES.EXTRA_PILE,
  ZONES.EEXTRA_PILE,
] as const

export const POSITION = {
  FACE_UP_ATK: 'fua',
  FACE_UP_DEF: 'fud',
  FACE_DOWN_DEF: 'fdd',
  FACE_DOWN: 'fd',
  FACE_UP: 'fu',
} as const

const EXTRA_FRAME_KEYWORDS = ['fusion', 'synchro', 'xyz', 'link']

function isExtraDeckCard(card: CardInstance) {
  const frame = (card.data?.frameType ?? '').toLowerCase()

  return EXTRA_FRAME_KEYWORDS.some(keyword => frame.includes(keyword))
}

function isToken(card: CardInstance) {
  const frame = (card.data?.frameType ?? '').toLowerCase()

  return frame.includes('token')
}

function createEmptyBoard(): BoardState {
  return {
    hand: [],
    m1: null,
    m2: null,
    m3: null,
    est1: null,
    est2: null,
    est3: null,
    em1: null,
    em2: null,
    em3: null,
    st1: null,
    st2: null,
    st3: null,
    field: null,
    efield: null,
    gy: [],
    egy: [],
    ebanish: [],
    banish: [],
    deck: [],
    extra: [],
    eextra: [],
    free: [],
    efree: [],
    emz1: null,
    emz2: null,
    extra_pile: null,
    eextra_pile: null,
    lp: 4000,
  }
}

let nextInstanceId = 1
function makeInstance(cardId: number, data: CardData | null | undefined): CardInstance {
  return { id: nextInstanceId++, cardId, data }
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [board, setBoard] = useState<BoardState>(() => createEmptyBoard())
  const [recording, setRecording] = useState(false)
  const [combo, setCombo] = useState<ComboStep[]>([])
  const [playbackVisualizing, setPlaybackVisualizing] = useState(false)

  const [history, setHistory] = useState<BoardState[]>([createEmptyBoard()])
  const [historyIndex, setHistoryIndex] = useState(0)

  const cardsRef = useRef<Record<number, CardData | undefined>>({})

  useEffect(() => {
    if (history[historyIndex]) {
      setBoard(history[historyIndex])
    }
  }, [historyIndex, history])

  const initBoard = useCallback((mainIds: number[], extraIds: number[], cardDataMap: Record<number, CardData | undefined>) => {
    nextInstanceId = 1
    cardsRef.current = cardDataMap

    const newBoard = createEmptyBoard()
    newBoard.deck = mainIds.map(cid => makeInstance(cid, cardDataMap[cid]))
    newBoard.extra = extraIds.map(cid => makeInstance(cid, cardDataMap[cid]))
    newBoard.lp = 4000

    setBoard(newBoard)
    setCombo([])
    setPlaybackVisualizing(false)
    setHistory([newBoard])
    setHistoryIndex(0)
    setRecording(false)
  }, [])

  const updateBoardState = useCallback((updater: (prev: BoardState) => BoardState, action: string, detail: Record<string, unknown>) => {
    setHistory(prev => {
      const currentBoard = prev[historyIndex] || createEmptyBoard()
      const nextBoard = updater(JSON.parse(JSON.stringify(currentBoard)) as BoardState)

      const nextHistory = prev.slice(0, historyIndex + 1)
      nextHistory.push(nextBoard)

      if (recording) {
        setCombo(prevCombo => {
          const nextCombo = prevCombo.slice(0, historyIndex)
          nextCombo.push({ a: action, ...detail, t: Date.now() })
          return nextCombo
        })
      }

      setTimeout(() => setHistoryIndex(nextHistory.length - 1), 0)
      return nextHistory
    })
  }, [historyIndex, recording])

  const draw = useCallback((count = 1) => {
    updateBoardState(prev => {
      if (prev.deck.length === 0) return prev
      const n = Math.min(count, prev.deck.length)
      const drawn = prev.deck.slice(0, n)
      prev.deck = prev.deck.slice(n)
      prev.hand = [...prev.hand, ...drawn]
      return prev
    }, 'draw', { n: count })
  }, [updateBoardState])

  const shuffleDeck = useCallback(() => {
    updateBoardState(prev => {
      prev.deck = shuffleArray(prev.deck)
      return prev
    }, 'shuffle', {})
  }, [updateBoardState])

  const sortDeck = useCallback(() => {
    updateBoardState(prev => {
      prev.deck.sort((a, b) => {
        const cardA = cardsRef.current[a.cardId]
        const cardB = cardsRef.current[b.cardId]
        if (!cardA || !cardB) return 0
        const typeA = getOrderValue(cardA)
        const typeB = getOrderValue(cardB)
        if (typeA !== typeB) return typeA - typeB
        return cardA.name.localeCompare(cardB.name)
      })
      return prev
    }, 'sort', {})
  }, [updateBoardState])

  const returnAllToDecks = useCallback(() => {
    updateBoardState(prev => {
      const main: CardInstance[] = []
      const extra: CardInstance[] = []

      // Collect cards from array zones
      ARRAY_ZONES.forEach(zone => {
        prev[zone].forEach(card => {
          if (isToken(card)) {
            return
          }

          if (isExtraDeckCard(card)) {
            extra.push(card)
          } else {
            main.push(card)
          }
        })

        prev[zone] = []
      })

      // Collect cards from single-card zones
      SINGLE_ZONES.forEach(zone => {
        const card = prev[zone]

        if (!card) {
          return
        }

        if (!isToken(card)) {
          if (isExtraDeckCard(card)) {
            extra.push(card)
          } else {
            main.push(card)
          }
        }

        prev[zone] = null
      })

      prev.deck = main
      prev.extra = extra

      // Reuse your existing sort algorithm
      prev.deck.sort((a, b) => {
        const cardA = cardsRef.current[a.cardId]
        const cardB = cardsRef.current[b.cardId]

        if (!cardA || !cardB) return 0

        const typeA = getOrderValue(cardA)
        const typeB = getOrderValue(cardB)

        if (typeA !== typeB)
          return typeA - typeB

        return cardA.name.localeCompare(cardB.name)
      })

      prev.extra.sort((a, b) => {
        const cardA = cardsRef.current[a.cardId]
        const cardB = cardsRef.current[b.cardId]

        if (!cardA || !cardB) return 0

        return cardA.name.localeCompare(cardB.name)
      })

      return prev
    }, 'reset_board', {})
  }, [updateBoardState])

  const moveCard = useCallback((instanceId: number, fromZone: string, toZone: string, position?: string) => {
    const zones = ['hand', 'egy', 'gy', 'ebanish', 'banish', 'eextra', 'extra', 'deck', 'efree', 'free']
    const sourceCard = (() => {
      if (zones.includes(fromZone)) {
        const zoneVal = board[fromZone as keyof BoardState]
        return Array.isArray(zoneVal) ? zoneVal.find((c: CardInstance) => c.id === instanceId) || null : null
      }

      const zoneCard = board[fromZone as keyof BoardState]
      return zoneCard && (zoneCard as CardInstance).id === instanceId ? zoneCard : null
    })() as CardInstance | null

    updateBoardState(prev => {
      let card: CardInstance | null = null

      if (zones.includes(fromZone)) {
        const arr = prev[fromZone as keyof BoardState] as CardInstance[]
        const idx = arr.findIndex(c => c.id === instanceId)
        if (idx !== -1) {
          card = arr[idx]
          arr.splice(idx, 1)
        }
      } else {
        card = prev[fromZone as keyof BoardState] as CardInstance | null
        if (card && card.id === instanceId) {
          ; (prev as Record<string, CardInstance | null>)[fromZone] = null
        } else {
          card = null
        }
      }

      if (!card) return prev

      if (zones.includes(toZone)) {
        ; (prev[toZone as keyof BoardState] as CardInstance[]).push(card)
      } else {
        if (prev[toZone as keyof BoardState] !== null) {
          prev.hand.push(prev[toZone as keyof BoardState] as CardInstance)
        }
        ; (prev as Record<string, CardInstance | null>)[toZone] = { ...card, position: position || POSITION.FACE_UP_ATK }
      }

      return prev
    }, 'move', {
      i: instanceId, cardId: sourceCard?.cardId, f: fromZone, to: toZone, p: position,
    })
  }, [board, updateBoardState])

  const changePosition = useCallback((zone: string, newPosition: string) => {
    updateBoardState(prev => {
      const current = prev[zone as keyof BoardState] as CardInstance | null
      if (current) {
        current.position = newPosition
      }
      return prev
    }, 'pos', { z: zone, p: newPosition })
  }, [updateBoardState])

  const setLP = useCallback((lp: number) => {
    updateBoardState(prev => {
      prev.lp = Math.max(0, lp)
      return prev
    }, 'lp', { v: lp })
  }, [updateBoardState])

  const sendToGY = useCallback((instanceId: number, fromZone: string) => {
    moveCard(instanceId, fromZone, 'gy')
  }, [moveCard])

  const sendToBanish = useCallback((instanceId: number, fromZone: string) => {
    moveCard(instanceId, fromZone, 'banish')
  }, [moveCard])

  const addToHand = useCallback((instanceId: number, fromZone: string) => {
    moveCard(instanceId, fromZone, 'hand')
  }, [moveCard])

  const returnToDeck = useCallback((instanceId: number, fromZone: string, toTop = true) => {
    updateBoardState(prev => {
      let card: CardInstance | null = null

      if (['hand', 'gy', 'banish', 'extra', 'free'].includes(fromZone)) {
        const arr = prev[fromZone as keyof BoardState] as CardInstance[]
        const idx = arr.findIndex(c => c.id === instanceId)
        if (idx !== -1) {
          card = arr[idx]
          arr.splice(idx, 1)
        }
      } else {
        card = prev[fromZone as keyof BoardState] as CardInstance | null
        if (card && card.id === instanceId) {
          ; (prev as Record<string, CardInstance | null>)[fromZone] = null
        }
      }

      if (!card) return prev

      if (toTop) {
        prev.deck.unshift(card)
      } else {
        prev.deck.push(card)
      }
      return prev
    }, 'todeck', { i: instanceId, f: fromZone, top: toTop })
  }, [updateBoardState])

  const millCards = useCallback((count = 1) => {
    updateBoardState(prev => {
      const n = Math.min(count, prev.deck.length)
      const milled = prev.deck.slice(0, n)
      prev.deck = prev.deck.slice(n)
      prev.gy = [...prev.gy, ...milled]
      return prev
    }, 'mill', { n: count })
  }, [updateBoardState])

  const generateToken = useCallback((targetZone = 'hand') => {
    updateBoardState(prev => {
      const tokenInstance = makeInstance(99999999, {
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
      })

      if (['hand', 'gy', 'banish', 'free', 'deck'].includes(targetZone)) {
        ; (prev[targetZone as keyof BoardState] as CardInstance[]).push(tokenInstance)
      } else {
        const existing = prev[targetZone as keyof BoardState] as CardInstance | null
        if (existing === null) {
          ; (prev as Record<string, CardInstance | null>)[targetZone] = { ...tokenInstance, position: POSITION.FACE_UP_ATK }
        } else {
          prev.hand.push(tokenInstance)
        }
      }
      return prev
    }, 'token', { to: targetZone })
  }, [updateBoardState])

  const activateEffect = useCallback((instanceId: number, zone: string) => {
    updateBoardState(prev => prev, 'effect', { i: instanceId, z: zone })
  }, [updateBoardState])

  const activateSkill = useCallback(() => {
    updateBoardState(prev => prev, 'skill', {})
  }, [updateBoardState])

  const removeToken = useCallback((instanceId: number, zone: string) => {
    updateBoardState(prev => {
      if (['hand', 'gy', 'banish', 'free', 'deck', 'extra'].includes(zone)) {
        const arr = prev[zone as keyof BoardState] as CardInstance[]
        prev[zone as keyof BoardState] = arr.filter(c => c.id !== instanceId) as unknown as BoardState[keyof BoardState]
      } else {
        const current = prev[zone as keyof BoardState] as CardInstance | null
        if (current?.id === instanceId) {
          ; (prev as Record<string, CardInstance | null>)[zone] = null
        }
      }
      return prev
    }, 'removetoken', { i: instanceId, z: zone })
  }, [updateBoardState])

  const resetBoard = useCallback(() => {
    setBoard(createEmptyBoard())
    setCombo([])
    setHistory([createEmptyBoard()])
    setHistoryIndex(0)
    setRecording(false)
    setPlaybackVisualizing(false)
  }, [])

  const startRecording = useCallback(() => {
    setCombo([])
    setHistory([JSON.parse(JSON.stringify(board)) as BoardState])
    setHistoryIndex(0)
    setRecording(true)
    setPlaybackVisualizing(false)
  }, [board])

  const stopRecording = useCallback(() => {
    setRecording(false)
  }, [])

  const jumpToStep = useCallback((index: number) => {
    const targetHistoryIndex = index + 1
    if (targetHistoryIndex >= 0 && targetHistoryIndex < history.length) {
      setPlaybackVisualizing(true)
      setHistoryIndex(targetHistoryIndex)
    }
  }, [history])

  const resetCombo = useCallback(() => {
    setCombo([])
    setHistory(prev => prev.length > 0 ? [prev[0]] : [createEmptyBoard()])
    setHistoryIndex(0)
    setRecording(false)
    setPlaybackVisualizing(false)
  }, [])

  const value: GameContextValue = {
    board,
    recording,
    playbackVisualizing,
    combo,
    playbackIndex: historyIndex - 1,
    maxPlaybackIndex: combo.length - 1,
    initBoard,
    draw,
    shuffleDeck,
    sortDeck,
    moveCard,
    changePosition,
    setLP,
    sendToGY,
    sendToBanish,
    addToHand,
    returnToDeck,
    millCards,
    generateToken,
    removeToken,
    activateEffect,
    activateSkill,
    resetBoard,
    resetCombo,
    startRecording,
    stopRecording,
    jumpToStep,
    setPlaybackVisualizing,
    setCombo,
    setHistory,
    setHistoryIndex,
    returnAllToDecks,
  }

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}
